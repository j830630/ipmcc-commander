"""
IPMCC Commander - Validation Engine
Validates potential IPMCC trades against strategy rules from the source material
"""

from datetime import date
from typing import Dict, Any, List, Optional
from app.config import settings
from app.services.market_data import market_data
from app.services.greeks_engine import greeks_engine
import logging

logger = logging.getLogger(__name__)


class ValidationEngine:
    """
    Validates IPMCC trade setups against the strategy rules.
    
    Strategy Rules (from source material):
    
    ENTRY CRITERIA:
    1. Weekly chart uptrend (21 EMA > 50 EMA)
    2. Daily RSI < 50 or reversing from oversold
    3. Price near support (lower BB, 50 EMA, 100/200 MA)
    4. High-quality, stable growth stocks/ETFs
    
    LONG LEG:
    - Delta: 70-90 (prefer 80)
    - DTE: 180-365+ days
    
    SHORT LEG:
    - Strike: ATM (or ITM in downtrends)
    - DTE: 7 days (can go 3-14)
    """
    
    def __init__(self):
        self.min_long_delta = settings.min_long_delta
        self.max_long_delta = settings.max_long_delta
        self.preferred_long_delta = settings.preferred_long_delta
        self.min_long_dte = settings.min_long_dte
        self.preferred_short_dte = settings.preferred_short_dte
        self.max_short_dte = settings.max_short_dte
    
    def validate_setup(
        self,
        ticker: str,
        long_strike: float,
        long_expiration: str,
        short_strike: float,
        short_expiration: str,
        quantity: int = 1
    ) -> Dict[str, Any]:
        """
        Validate an IPMCC setup against strategy rules.
        
        Args:
            ticker: Stock symbol
            long_strike: LEAP strike price
            long_expiration: LEAP expiration (YYYY-MM-DD)
            short_strike: Short call strike
            short_expiration: Short call expiration (YYYY-MM-DD)
            quantity: Number of contracts
            
        Returns:
            ValidationResponse with score, checks, warnings, and metrics
        """
        
        checks: List[Dict[str, Any]] = []
        warnings: List[Dict[str, str]] = []
        score = 100  # Start at 100, deduct for failures
        
        try:
            # Get market data
            quote = market_data.get_quote(ticker)
            if quote.get("error") or not quote.get("price"):
                return {
                    "valid": False,
                    "score": 0,
                    "checks": [],
                    "warnings": [],
                    "metrics": None,
                    "error": f"Could not fetch quote for {ticker}: {quote.get('error', 'No price available')}"
                }
            
            stock_price = quote["price"]
            
            # Get technical indicators
            technicals = market_data.get_technical_indicators(ticker)
            
            # Get options chain for IV
            chain = market_data.get_options_chain(ticker, long_expiration)
            long_iv = self._find_option_iv(chain, long_strike, "call") or 25.0
            
            short_chain = market_data.get_options_chain(ticker, short_expiration)
            short_iv = self._find_option_iv(short_chain, short_strike, "call") or 25.0
            
            # Calculate DTEs
            long_dte = greeks_engine.calculate_days_to_expiry(long_expiration)
            short_dte = greeks_engine.calculate_days_to_expiry(short_expiration)
            
            # Calculate position Greeks
            position_greeks = greeks_engine.calculate_ipmcc_position(
                stock_price=stock_price,
                long_strike=long_strike,
                long_dte=long_dte,
                long_iv=long_iv,
                short_strike=short_strike,
                short_dte=short_dte,
                short_iv=short_iv,
                quantity=quantity
            )
            
            if position_greeks.get("error"):
                return {
                    "valid": False,
                    "score": 0,
                    "checks": [],
                    "warnings": [],
                    "metrics": None,
                    "error": position_greeks["error"]
                }
            
            long_delta = position_greeks["long"]["delta"]
            
            # ================================================================
            # VALIDATION CHECKS
            # ================================================================
            
            # 1. Weekly Uptrend Check
            weekly_uptrend = technicals.get("weekly_uptrend", False) if not technicals.get("error") else None
            if weekly_uptrend is not None:
                checks.append({
                    "rule": "weekly_uptrend",
                    "passed": weekly_uptrend,
                    "value": None,
                    "target": "21 EMA > 50 EMA",
                    "message": "Weekly uptrend confirmed" if weekly_uptrend else "Weekly uptrend not confirmed"
                })
                if not weekly_uptrend:
                    score -= 15
                    warnings.append({
                        "code": "WEAK_TREND",
                        "message": "Weekly trend is not bullish (21 EMA not above 50 EMA)",
                        "severity": "warning"
                    })
            else:
                checks.append({
                    "rule": "weekly_uptrend",
                    "passed": True,  # Can't verify, don't penalize
                    "value": None,
                    "target": "21 EMA > 50 EMA",
                    "message": "Could not verify weekly trend (insufficient data)"
                })
            
            # 2. Long Delta Check
            delta_passed = self.min_long_delta <= long_delta <= self.max_long_delta
            checks.append({
                "rule": "long_delta",
                "passed": delta_passed,
                "value": long_delta,
                "target": f"{self.min_long_delta}-{self.max_long_delta}",
                "message": f"Long delta {long_delta} {'within' if delta_passed else 'outside'} target range"
            })
            if not delta_passed:
                score -= 25  # Critical rule
            
            # 3. Long DTE Check
            dte_passed = long_dte >= self.min_long_dte
            checks.append({
                "rule": "long_dte",
                "passed": dte_passed,
                "value": long_dte,
                "target": f">= {self.min_long_dte} days",
                "message": f"Long DTE {long_dte} days {'meets' if dte_passed else 'below'} minimum"
            })
            if not dte_passed:
                score -= 25  # Critical rule
            
            # 4. Daily RSI Check (prefer < 50)
            rsi = technicals.get("rsi_14") if not technicals.get("error") else None
            if rsi is not None:
                rsi_optimal = rsi < 50
                checks.append({
                    "rule": "daily_rsi",
                    "passed": rsi_optimal,
                    "value": rsi,
                    "target": "< 50",
                    "message": f"Daily RSI at {rsi}" + (" (pullback zone)" if rsi_optimal else " (elevated)")
                })
                if not rsi_optimal:
                    score -= 10
                    warnings.append({
                        "code": "RSI_ELEVATED",
                        "message": f"Daily RSI at {rsi}, prefer entry below 50 for better risk/reward",
                        "severity": "warning"
                    })
            
            # 5. Short Strike ATM Check
            atm_distance = abs(short_strike - stock_price) / stock_price
            is_atm = atm_distance <= 0.02  # Within 2% of ATM
            is_itm = short_strike < stock_price
            is_otm = short_strike > stock_price
            
            if is_atm:
                strike_message = "Short strike is ATM (optimal for income)"
                strike_passed = True
            elif is_itm:
                strike_message = f"Short strike is ITM by {(stock_price - short_strike):.2f} (acceptable in downtrends)"
                strike_passed = True
            else:
                strike_message = f"Short strike is OTM by {(short_strike - stock_price):.2f} (reduces income)"
                strike_passed = False
                score -= 20
                warnings.append({
                    "code": "OTM_SHORT",
                    "message": "Short strike is OTM - Income PMCC prefers ATM for maximum extrinsic",
                    "severity": "warning"
                })
            
            checks.append({
                "rule": "short_strike_atm",
                "passed": strike_passed,
                "value": short_strike,
                "target": f"ATM (~{stock_price:.2f})",
                "message": strike_message
            })
            
            # 6. Short DTE Check
            short_dte_passed = 3 <= short_dte <= self.max_short_dte
            checks.append({
                "rule": "short_dte",
                "passed": short_dte_passed,
                "value": short_dte,
                "target": f"3-{self.max_short_dte} days",
                "message": f"Short DTE {short_dte} days" + (" (optimal)" if short_dte == 7 else "")
            })
            if not short_dte_passed:
                score -= 10
            
            # 7. Support Proximity Check (if we have technicals)
            if not technicals.get("error"):
                near_support = self._check_support_proximity(stock_price, technicals)
                checks.append({
                    "rule": "support_proximity",
                    "passed": near_support,
                    "value": None,
                    "target": "Near support level",
                    "message": "Price near support level" if near_support else "Price not near key support"
                })
                if not near_support:
                    score -= 5
                    warnings.append({
                        "code": "NOT_AT_SUPPORT",
                        "message": "Price not near key support levels (50 EMA, lower BB)",
                        "severity": "info"
                    })
            
            # ================================================================
            # CALCULATE METRICS
            # ================================================================
            
            metrics = {
                "capital_required": position_greeks["metrics"]["capital_required"],
                "weekly_extrinsic": position_greeks["metrics"]["weekly_extrinsic"],
                "weeks_to_payback": position_greeks["metrics"]["weeks_to_breakeven"],
                "theoretical_annual_roi": position_greeks["metrics"]["theoretical_annual_roi"],
                "breakeven_price": round(long_strike + position_greeks["long"]["price"] - position_greeks["short"]["extrinsic"], 2),
                "max_weekly_profit": position_greeks["metrics"]["weekly_extrinsic"],
                "downside_vs_stock": position_greeks["metrics"]["downside_vs_stock_percent"],
                "net_theta_daily": position_greeks["net"]["theta"],
                "net_delta": position_greeks["net"]["delta"]
            }
            
            # Ensure score is within bounds
            score = max(0, min(100, score))
            
            # Determine if valid (score >= 60 and no critical failures)
            critical_failures = not delta_passed or not dte_passed
            is_valid = score >= 60 and not critical_failures
            
            return {
                "valid": is_valid,
                "score": score,
                "checks": checks,
                "warnings": warnings,
                "metrics": metrics,
                "error": None
            }
            
        except Exception as e:
            logger.error(f"Validation error: {e}")
            return {
                "valid": False,
                "score": 0,
                "checks": checks,
                "warnings": warnings,
                "metrics": None,
                "error": str(e)
            }
    
    def _find_option_iv(
        self, 
        chain: Dict[str, Any], 
        strike: float, 
        option_type: str
    ) -> Optional[float]:
        """Find IV for a specific strike in the options chain."""
        if chain.get("error"):
            return None
        
        options = chain.get("calls" if option_type == "call" else "puts", [])
        
        # Find exact strike or closest
        for opt in options:
            if abs(opt.get("strike", 0) - strike) < 0.01:
                return opt.get("implied_volatility")
        
        # If not found, return average IV
        ivs = [opt.get("implied_volatility", 0) for opt in options if opt.get("implied_volatility", 0) > 0]
        return sum(ivs) / len(ivs) if ivs else None
    
    def _check_support_proximity(
        self, 
        price: float, 
        technicals: Dict[str, Any]
    ) -> bool:
        """Check if price is near support levels."""
        tolerance = 0.03  # Within 3% of support
        
        support_levels = [
            technicals.get("bb_lower"),
            technicals.get("ema_50"),
            technicals.get("ema_200")
        ]
        
        for level in support_levels:
            if level and abs(price - level) / price <= tolerance:
                return True
        
        # Also check if below ema_21 (pullback)
        ema_21 = technicals.get("ema_21")
        if ema_21 and price < ema_21:
            return True
        
        return False
    
    def check_management_signals(
        self,
        position_id: str,
        long_value: float,
        long_entry_price: float,
        short_extrinsic_remaining: float,
        short_entry_extrinsic: float,
        long_dte: int,
        cumulative_short_pnl: float
    ) -> List[Dict[str, Any]]:
        """
        Check for management signals on an existing position.
        
        Returns list of signals with priority and recommended action.
        """
        signals = []
        
        # Calculate metrics
        leap_pnl = long_value - long_entry_price
        leap_pnl_pct = (leap_pnl / long_entry_price) * 100 if long_entry_price > 0 else 0
        extrinsic_remaining_pct = (short_extrinsic_remaining / short_entry_extrinsic) if short_entry_extrinsic > 0 else 1.0
        
        # Total position P&L (per share)
        total_pnl = leap_pnl + cumulative_short_pnl
        total_pnl_pct = (total_pnl / long_entry_price) * 100 if long_entry_price > 0 else 0
        
        # 1. Emergency Exit: Net loss > 30%
        if total_pnl_pct < -30:
            signals.append({
                "type": "emergency_exit",
                "priority": "critical",
                "message": f"Position down {total_pnl_pct:.1f}% - exceeds 30% threshold",
                "action": "Consider closing entire position"
            })
        
        # 2. Roll Due: Extrinsic < 20%
        if extrinsic_remaining_pct < 0.20:
            signals.append({
                "type": "roll_due",
                "priority": "high",
                "message": f"Only {extrinsic_remaining_pct*100:.0f}% extrinsic remaining",
                "action": "Roll to next week"
            })
        elif extrinsic_remaining_pct < 0.10:
            signals.append({
                "type": "assignment_risk",
                "priority": "critical",
                "message": f"Only {extrinsic_remaining_pct*100:.0f}% extrinsic - assignment risk",
                "action": "Close short call immediately"
            })
        
        # 3. LEAP Expiring: < 60 DTE
        if long_dte < 60:
            signals.append({
                "type": "leap_expiring",
                "priority": "high",
                "message": f"LEAP only has {long_dte} days remaining",
                "action": "Close position - theta acceleration zone"
            })
        elif long_dte < 90:
            signals.append({
                "type": "leap_expiring",
                "priority": "medium",
                "message": f"LEAP has {long_dte} days remaining",
                "action": "Plan exit strategy"
            })
        
        # 4. Profit Target: > 50% gain
        if total_pnl_pct > 50:
            signals.append({
                "type": "profit_target",
                "priority": "medium",
                "message": f"Position up {total_pnl_pct:.1f}%",
                "action": "Consider taking profits"
            })
        
        return signals


# Singleton instance
validation_engine = ValidationEngine()
