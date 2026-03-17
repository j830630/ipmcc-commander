"""
IPMCC Commander - Risk Alerts & Portfolio Analytics
Assignment risk, roll triggers, beta-weighted delta, and portfolio monitoring
"""

from dataclasses import dataclass
from datetime import date, datetime
from typing import Dict, Any, List, Optional
from enum import Enum
import logging
import yfinance as yf

logger = logging.getLogger(__name__)


class AlertLevel(str, Enum):
    """Alert severity levels."""
    CRITICAL = "critical"  # Immediate action required
    WARNING = "warning"    # Attention needed soon
    INFO = "info"          # Informational
    OK = "ok"              # All clear


class AlertType(str, Enum):
    """Types of risk alerts."""
    ASSIGNMENT_RISK = "assignment_risk"
    ROLL_TRIGGER = "roll_trigger"
    DTE_WARNING = "dte_warning"
    DELTA_EXPOSURE = "delta_exposure"
    LOSS_THRESHOLD = "loss_threshold"
    PROFIT_TARGET = "profit_target"
    EARNINGS_WARNING = "earnings_warning"
    DIVIDEND_WARNING = "dividend_warning"


@dataclass
class RiskAlert:
    """Single risk alert."""
    alert_type: AlertType
    level: AlertLevel
    symbol: str
    message: str
    value: float
    threshold: float
    action_required: str
    timestamp: datetime = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.alert_type.value,
            "level": self.level.value,
            "symbol": self.symbol,
            "message": self.message,
            "value": self.value,
            "threshold": self.threshold,
            "action": self.action_required,
            "timestamp": self.timestamp.isoformat()
        }


class RiskAlertService:
    """
    Monitors positions and generates risk alerts.
    
    Alerts for:
    - Assignment risk (short call ITM or high delta)
    - Roll triggers (DTE < threshold, extrinsic < threshold)
    - Delta exposure (portfolio too bullish/bearish)
    - Loss thresholds (position down X%)
    - Profit targets (take profit opportunities)
    """
    
    # Alert thresholds
    ASSIGNMENT_DELTA_THRESHOLD = 0.70  # Short call delta > 70%
    ROLL_DTE_THRESHOLD = 7             # Roll when DTE < 7
    ROLL_EXTRINSIC_PCT_THRESHOLD = 0.20  # Roll when extrinsic < 20% of max
    EMERGENCY_LOSS_PCT = 0.30          # Alert at 30% loss
    PROFIT_TARGET_PCT = 0.50           # Alert at 50% profit
    LEAP_DTE_WARNING = 60              # Warn when LEAP < 60 DTE
    
    def check_assignment_risk(
        self,
        symbol: str,
        short_strike: float,
        underlying_price: float,
        short_delta: Optional[float] = None,
        dte: int = 0
    ) -> Optional[RiskAlert]:
        """
        Check for early assignment risk on short call.
        
        Risk factors:
        - Short call is ITM
        - Short delta > 0.70
        - Near expiration with ITM
        - Approaching ex-dividend date
        """
        alerts = []
        
        # Calculate moneyness
        itm_amount = underlying_price - short_strike
        itm_pct = itm_amount / short_strike * 100 if short_strike > 0 else 0
        is_itm = itm_amount > 0
        
        # Check 1: Deep ITM
        if is_itm and itm_pct > 5:
            return RiskAlert(
                alert_type=AlertType.ASSIGNMENT_RISK,
                level=AlertLevel.CRITICAL,
                symbol=symbol,
                message=f"Short call is {itm_pct:.1f}% ITM - HIGH assignment risk",
                value=itm_pct,
                threshold=5.0,
                action_required="Consider rolling up and out immediately"
            )
        
        # Check 2: ITM near expiration
        if is_itm and dte <= 3:
            return RiskAlert(
                alert_type=AlertType.ASSIGNMENT_RISK,
                level=AlertLevel.CRITICAL,
                symbol=symbol,
                message=f"Short call ITM with only {dte} DTE - Assignment likely",
                value=float(dte),
                threshold=3.0,
                action_required="Roll or close position before expiration"
            )
        
        # Check 3: High delta
        if short_delta and short_delta > self.ASSIGNMENT_DELTA_THRESHOLD:
            level = AlertLevel.CRITICAL if short_delta > 0.85 else AlertLevel.WARNING
            return RiskAlert(
                alert_type=AlertType.ASSIGNMENT_RISK,
                level=level,
                symbol=symbol,
                message=f"Short delta ({short_delta:.2f}) exceeds threshold",
                value=short_delta,
                threshold=self.ASSIGNMENT_DELTA_THRESHOLD,
                action_required="Monitor closely or roll to lower delta strike"
            )
        
        # Check 4: Just ITM (yellow alert)
        if is_itm:
            return RiskAlert(
                alert_type=AlertType.ASSIGNMENT_RISK,
                level=AlertLevel.WARNING,
                symbol=symbol,
                message=f"Short call is {itm_pct:.1f}% ITM",
                value=itm_pct,
                threshold=0.0,
                action_required="Monitor for further movement"
            )
        
        return None
    
    def check_roll_trigger(
        self,
        symbol: str,
        dte: int,
        current_extrinsic: float,
        max_extrinsic: float
    ) -> Optional[RiskAlert]:
        """
        Check if position should be rolled.
        
        Roll triggers:
        - DTE < 7
        - Extrinsic value < 20% of max
        """
        extrinsic_pct = current_extrinsic / max_extrinsic if max_extrinsic > 0 else 0
        
        # Check 1: DTE threshold
        if dte <= self.ROLL_DTE_THRESHOLD:
            level = AlertLevel.CRITICAL if dte <= 2 else AlertLevel.WARNING
            return RiskAlert(
                alert_type=AlertType.ROLL_TRIGGER,
                level=level,
                symbol=symbol,
                message=f"DTE ({dte}) at or below roll threshold",
                value=float(dte),
                threshold=float(self.ROLL_DTE_THRESHOLD),
                action_required="Roll to next expiration cycle"
            )
        
        # Check 2: Extrinsic value depleted
        if extrinsic_pct < self.ROLL_EXTRINSIC_PCT_THRESHOLD:
            return RiskAlert(
                alert_type=AlertType.ROLL_TRIGGER,
                level=AlertLevel.WARNING,
                symbol=symbol,
                message=f"Extrinsic value ({extrinsic_pct*100:.1f}%) below threshold",
                value=extrinsic_pct * 100,
                threshold=self.ROLL_EXTRINSIC_PCT_THRESHOLD * 100,
                action_required="Consider rolling to capture more premium"
            )
        
        return None
    
    def check_leap_dte(self, symbol: str, leap_dte: int) -> Optional[RiskAlert]:
        """Check if LEAP is getting too short."""
        if leap_dte < self.LEAP_DTE_WARNING:
            level = AlertLevel.CRITICAL if leap_dte < 30 else AlertLevel.WARNING
            return RiskAlert(
                alert_type=AlertType.DTE_WARNING,
                level=level,
                symbol=symbol,
                message=f"LEAP DTE ({leap_dte}) is below warning threshold",
                value=float(leap_dte),
                threshold=float(self.LEAP_DTE_WARNING),
                action_required="Consider rolling LEAP to later expiration or closing position"
            )
        return None
    
    def check_pnl_thresholds(
        self,
        symbol: str,
        current_pnl_pct: float,
        unrealized_pnl: float
    ) -> Optional[RiskAlert]:
        """Check P&L against loss/profit thresholds."""
        
        # Emergency loss
        if current_pnl_pct < -self.EMERGENCY_LOSS_PCT:
            return RiskAlert(
                alert_type=AlertType.LOSS_THRESHOLD,
                level=AlertLevel.CRITICAL,
                symbol=symbol,
                message=f"Position down {abs(current_pnl_pct)*100:.1f}% - Emergency threshold breached",
                value=current_pnl_pct * 100,
                threshold=-self.EMERGENCY_LOSS_PCT * 100,
                action_required="Evaluate position for emergency exit"
            )
        
        # Profit target
        if current_pnl_pct >= self.PROFIT_TARGET_PCT:
            return RiskAlert(
                alert_type=AlertType.PROFIT_TARGET,
                level=AlertLevel.INFO,
                symbol=symbol,
                message=f"Position up {current_pnl_pct*100:.1f}% - Profit target reached",
                value=current_pnl_pct * 100,
                threshold=self.PROFIT_TARGET_PCT * 100,
                action_required="Consider taking profits or rolling up"
            )
        
        return None
    
    def check_all_risks(self, position: Dict[str, Any]) -> List[RiskAlert]:
        """
        Run all risk checks on a position.
        
        Position dict should contain:
        - symbol, short_strike, underlying_price
        - short_delta (optional)
        - short_dte, long_dte
        - current_extrinsic, max_extrinsic
        - pnl_pct, unrealized_pnl
        """
        alerts = []
        symbol = position.get("symbol", "UNKNOWN")
        
        # Assignment risk
        assignment_alert = self.check_assignment_risk(
            symbol=symbol,
            short_strike=position.get("short_strike", 0),
            underlying_price=position.get("underlying_price", 0),
            short_delta=position.get("short_delta"),
            dte=position.get("short_dte", 999)
        )
        if assignment_alert:
            alerts.append(assignment_alert)
        
        # Roll trigger
        roll_alert = self.check_roll_trigger(
            symbol=symbol,
            dte=position.get("short_dte", 999),
            current_extrinsic=position.get("current_extrinsic", 0),
            max_extrinsic=position.get("max_extrinsic", 1)
        )
        if roll_alert:
            alerts.append(roll_alert)
        
        # LEAP DTE
        leap_alert = self.check_leap_dte(
            symbol=symbol,
            leap_dte=position.get("long_dte", 999)
        )
        if leap_alert:
            alerts.append(leap_alert)
        
        # P&L thresholds
        pnl_alert = self.check_pnl_thresholds(
            symbol=symbol,
            current_pnl_pct=position.get("pnl_pct", 0),
            unrealized_pnl=position.get("unrealized_pnl", 0)
        )
        if pnl_alert:
            alerts.append(pnl_alert)
        
        return alerts


class PortfolioAnalytics:
    """
    Portfolio-level analytics and risk metrics.
    
    Provides:
    - Beta-weighted delta (exposure to SPY)
    - Portfolio Greeks aggregation
    - Sector/strategy concentration
    - Risk metrics
    """
    
    def __init__(self):
        self._beta_cache: Dict[str, float] = {}
        self._spy_price: Optional[float] = None
        self._last_spy_fetch: Optional[datetime] = None
    
    def get_spy_price(self) -> float:
        """Get current SPY price (cached for 5 minutes)."""
        now = datetime.now()
        if (self._spy_price is None or 
            self._last_spy_fetch is None or
            (now - self._last_spy_fetch).seconds > 300):
            try:
                spy = yf.Ticker("SPY")
                hist = spy.history(period="1d")
                if not hist.empty:
                    self._spy_price = hist['Close'].iloc[-1]
                    self._last_spy_fetch = now
            except Exception as e:
                logger.error(f"Error fetching SPY price: {e}")
                if self._spy_price is None:
                    self._spy_price = 500.0  # Fallback
        
        return self._spy_price
    
    def get_stock_beta(self, symbol: str) -> float:
        """
        Get stock's beta to SPY.
        Uses yfinance info or calculates from price history.
        """
        if symbol in self._beta_cache:
            return self._beta_cache[symbol]
        
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info
            beta = info.get("beta", 1.0)
            
            if beta is None or beta == 0:
                beta = 1.0  # Default to market beta
            
            self._beta_cache[symbol] = beta
            return beta
            
        except Exception as e:
            logger.warning(f"Error fetching beta for {symbol}: {e}")
            return 1.0
    
    def calculate_beta_weighted_delta(
        self,
        positions: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Calculate portfolio's beta-weighted delta.
        
        This shows your effective exposure to SPY movements.
        
        Formula per position:
        BW Delta = Position Delta * Stock Beta * (Stock Price / SPY Price) * Contracts * 100
        
        Returns:
        - Total beta-weighted delta
        - Per-position breakdown
        - Equivalent SPY shares exposure
        """
        spy_price = self.get_spy_price()
        
        total_bw_delta = 0.0
        position_details = []
        
        for pos in positions:
            symbol = pos.get("symbol", "")
            stock_price = pos.get("underlying_price", 0)
            position_delta = pos.get("net_delta", 0)  # Long delta - Short delta
            contracts = pos.get("contracts", 1)
            beta = self.get_stock_beta(symbol)
            
            # Calculate beta-weighted delta
            if spy_price > 0:
                bw_delta = position_delta * beta * (stock_price / spy_price) * contracts * 100
            else:
                bw_delta = 0
            
            total_bw_delta += bw_delta
            
            position_details.append({
                "symbol": symbol,
                "raw_delta": position_delta * contracts * 100,
                "beta": beta,
                "beta_weighted_delta": round(bw_delta, 2),
                "spy_equivalent_shares": round(bw_delta, 0)
            })
        
        # Calculate equivalent SPY exposure
        spy_equivalent = total_bw_delta  # Already in share terms
        spy_notional = spy_equivalent * spy_price
        
        return {
            "total_beta_weighted_delta": round(total_bw_delta, 2),
            "spy_equivalent_shares": round(spy_equivalent, 0),
            "spy_notional_exposure": round(spy_notional, 2),
            "spy_price": round(spy_price, 2),
            "interpretation": self._interpret_bw_delta(total_bw_delta),
            "positions": position_details
        }
    
    def _interpret_bw_delta(self, bw_delta: float) -> str:
        """Generate human-readable interpretation of beta-weighted delta."""
        abs_delta = abs(bw_delta)
        direction = "bullish" if bw_delta > 0 else "bearish" if bw_delta < 0 else "neutral"
        
        if abs_delta < 10:
            exposure = "minimal"
        elif abs_delta < 50:
            exposure = "light"
        elif abs_delta < 100:
            exposure = "moderate"
        elif abs_delta < 200:
            exposure = "significant"
        else:
            exposure = "heavy"
        
        return f"Portfolio has {exposure} {direction} exposure (equivalent to {abs_delta:.0f} SPY shares)"
    
    def calculate_portfolio_greeks(
        self,
        positions: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Aggregate Greeks across all positions.
        """
        total_delta = 0.0
        total_gamma = 0.0
        total_theta = 0.0
        total_vega = 0.0
        total_notional = 0.0
        
        for pos in positions:
            contracts = pos.get("contracts", 1)
            multiplier = contracts * 100
            
            # Sum up Greeks (assuming they're per-contract values)
            total_delta += pos.get("net_delta", 0) * multiplier
            total_gamma += pos.get("net_gamma", 0) * multiplier
            total_theta += pos.get("net_theta", 0) * multiplier
            total_vega += pos.get("net_vega", 0) * multiplier
            
            # Notional value
            total_notional += pos.get("underlying_price", 0) * pos.get("net_delta", 0) * multiplier
        
        return {
            "net_delta": round(total_delta, 2),
            "net_gamma": round(total_gamma, 4),
            "net_theta": round(total_theta, 2),
            "net_vega": round(total_vega, 2),
            "notional_exposure": round(total_notional, 2),
            "daily_theta_decay": round(total_theta, 2),  # Theta = daily decay
            "1pct_move_pnl": round(total_delta + total_gamma * 0.5, 2)  # Approximate
        }
    
    def calculate_risk_metrics(
        self,
        positions: List[Dict[str, Any]],
        account_value: float
    ) -> Dict[str, Any]:
        """
        Calculate portfolio risk metrics.
        """
        bw_delta = self.calculate_beta_weighted_delta(positions)
        greeks = self.calculate_portfolio_greeks(positions)
        spy_price = self.get_spy_price()
        
        # Max theoretical loss (rough estimate)
        max_loss = sum(
            pos.get("max_loss", 0) 
            for pos in positions
        )
        
        # Risk as % of account
        risk_pct = (max_loss / account_value * 100) if account_value > 0 else 0
        
        # 1 standard deviation move impact (assume ~1% daily move)
        one_sd_impact = greeks["net_delta"] * (spy_price * 0.01) if spy_price else 0
        
        # Concentration check
        position_count = len(positions)
        
        return {
            "portfolio_beta_weighted_delta": bw_delta["total_beta_weighted_delta"],
            "spy_equivalent_shares": bw_delta["spy_equivalent_shares"],
            "max_theoretical_loss": round(max_loss, 2),
            "risk_as_pct_of_account": round(risk_pct, 2),
            "daily_theta_income": round(greeks["net_theta"], 2),
            "one_sd_move_impact": round(one_sd_impact, 2),
            "position_count": position_count,
            "greeks": greeks,
            "interpretation": bw_delta["interpretation"]
        }


# Singleton instances
risk_alert_service = RiskAlertService()
portfolio_analytics = PortfolioAnalytics()
