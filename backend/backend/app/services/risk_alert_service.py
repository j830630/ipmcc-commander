"""
IPMCC Commander - Risk Alerting Service
Real-time risk monitoring with assignment warnings, beta-weighted delta, and roll triggers
"""

from typing import Dict, Any, List, Optional
from datetime import date, datetime
from enum import Enum
import math
import logging

logger = logging.getLogger(__name__)


class AlertSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class AlertType(str, Enum):
    ASSIGNMENT_RISK = "assignment_risk"
    ROLL_TRIGGER = "roll_trigger"
    DELTA_EXPOSURE = "delta_exposure"
    EXPIRATION_WARNING = "expiration_warning"
    PROFIT_TARGET = "profit_target"
    STOP_LOSS = "stop_loss"
    IV_CHANGE = "iv_change"
    BETA_EXPOSURE = "beta_exposure"


class RiskAlert:
    """Individual risk alert."""
    
    def __init__(
        self,
        alert_type: AlertType,
        severity: AlertSeverity,
        ticker: str,
        message: str,
        details: Optional[Dict[str, Any]] = None,
        action_required: Optional[str] = None
    ):
        self.alert_type = alert_type
        self.severity = severity
        self.ticker = ticker
        self.message = message
        self.details = details or {}
        self.action_required = action_required
        self.created_at = datetime.now()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.alert_type.value,
            "severity": self.severity.value,
            "ticker": self.ticker,
            "message": self.message,
            "details": self.details,
            "action_required": self.action_required,
            "created_at": self.created_at.isoformat()
        }


class RiskAlertService:
    """
    Real-time risk monitoring and alerting service.
    
    Monitors:
    1. Assignment Risk - When short call is ITM or approaching ITM
    2. Roll Triggers - When to roll short calls (DTE < 7, Delta > 0.70)
    3. Beta-Weighted Delta - Portfolio exposure to SPY
    4. Expiration Warnings - Upcoming expirations
    5. P&L Alerts - Profit targets and stop losses
    """
    
    # Default thresholds
    DEFAULT_THRESHOLDS = {
        # Assignment risk
        "itm_warning_percent": 2.0,  # Warn if within 2% of ITM
        "itm_critical_percent": 0.0,  # Critical if ITM
        
        # Roll triggers
        "min_dte_warning": 7,  # Warn if DTE < 7
        "max_delta_warning": 0.70,  # Warn if delta > 0.70
        "max_delta_critical": 0.85,  # Critical if delta > 0.85
        
        # Beta exposure
        "max_portfolio_delta": 100,  # Max total delta exposure
        "max_beta_weighted_delta": 50,  # Max beta-weighted delta to SPY
        
        # P&L thresholds
        "profit_target_percent": 50,  # Take profit at 50% of max
        "stop_loss_percent": 200,  # Stop if loss exceeds 2x premium received
    }
    
    def __init__(self, thresholds: Optional[Dict[str, float]] = None):
        """Initialize with optional custom thresholds."""
        self.thresholds = {**self.DEFAULT_THRESHOLDS, **(thresholds or {})}
    
    def analyze_position(
        self,
        ticker: str,
        current_price: float,
        short_strike: float,
        short_dte: int,
        short_delta: float,
        short_premium_received: float,
        current_short_value: float,
        long_strike: Optional[float] = None,
        long_dte: Optional[int] = None,
        beta: float = 1.0,
        quantity: int = 1
    ) -> List[RiskAlert]:
        """
        Analyze a single IPMCC position for risk alerts.
        
        Args:
            ticker: Stock symbol
            current_price: Current stock price
            short_strike: Short call strike
            short_dte: Days to expiration for short call
            short_delta: Current delta of short call
            short_premium_received: Premium received when sold
            current_short_value: Current value to close short
            long_strike: LEAP strike (optional)
            long_dte: LEAP DTE (optional)
            beta: Stock beta relative to SPY
            quantity: Number of contracts
            
        Returns:
            List of RiskAlert objects
        """
        alerts = []
        
        # 1. Assignment Risk Check
        alerts.extend(self._check_assignment_risk(
            ticker, current_price, short_strike, short_delta, quantity
        ))
        
        # 2. Roll Trigger Check
        alerts.extend(self._check_roll_triggers(
            ticker, short_dte, short_delta, quantity
        ))
        
        # 3. P&L Alerts
        alerts.extend(self._check_pnl_alerts(
            ticker, short_premium_received, current_short_value, quantity
        ))
        
        # 4. Expiration Warning
        alerts.extend(self._check_expiration_warnings(
            ticker, short_dte, long_dte
        ))
        
        return alerts
    
    def _check_assignment_risk(
        self,
        ticker: str,
        current_price: float,
        short_strike: float,
        short_delta: float,
        quantity: int
    ) -> List[RiskAlert]:
        """Check for assignment risk on short calls."""
        alerts = []
        
        # Calculate how far OTM/ITM
        distance_percent = ((short_strike - current_price) / current_price) * 100
        
        # ITM Check (Critical)
        if current_price >= short_strike:
            alerts.append(RiskAlert(
                alert_type=AlertType.ASSIGNMENT_RISK,
                severity=AlertSeverity.CRITICAL,
                ticker=ticker,
                message=f"🚨 SHORT CALL IS ITM! Strike ${short_strike:.2f} vs Price ${current_price:.2f}",
                details={
                    "strike": short_strike,
                    "current_price": current_price,
                    "itm_amount": current_price - short_strike,
                    "delta": short_delta,
                    "contracts": quantity
                },
                action_required="Consider rolling up/out immediately or closing position"
            ))
        
        # Near ITM Warning
        elif distance_percent <= self.thresholds["itm_warning_percent"]:
            alerts.append(RiskAlert(
                alert_type=AlertType.ASSIGNMENT_RISK,
                severity=AlertSeverity.WARNING,
                ticker=ticker,
                message=f"⚠️ Short call approaching ITM ({distance_percent:.1f}% away)",
                details={
                    "strike": short_strike,
                    "current_price": current_price,
                    "distance_percent": distance_percent,
                    "delta": short_delta
                },
                action_required="Monitor closely, prepare roll strategy"
            ))
        
        return alerts
    
    def _check_roll_triggers(
        self,
        ticker: str,
        short_dte: int,
        short_delta: float,
        quantity: int
    ) -> List[RiskAlert]:
        """Check for roll trigger conditions."""
        alerts = []
        
        # DTE-based roll trigger
        if short_dte <= self.thresholds["min_dte_warning"]:
            severity = AlertSeverity.CRITICAL if short_dte <= 3 else AlertSeverity.WARNING
            alerts.append(RiskAlert(
                alert_type=AlertType.ROLL_TRIGGER,
                severity=severity,
                ticker=ticker,
                message=f"📅 Roll trigger: DTE = {short_dte} days",
                details={
                    "dte": short_dte,
                    "threshold": self.thresholds["min_dte_warning"],
                    "contracts": quantity
                },
                action_required="Roll short call to next expiration cycle"
            ))
        
        # Delta-based roll trigger
        if short_delta >= self.thresholds["max_delta_critical"]:
            alerts.append(RiskAlert(
                alert_type=AlertType.ROLL_TRIGGER,
                severity=AlertSeverity.CRITICAL,
                ticker=ticker,
                message=f"🎯 CRITICAL Delta: {short_delta:.2f} (threshold: {self.thresholds['max_delta_critical']:.2f})",
                details={
                    "delta": short_delta,
                    "threshold": self.thresholds["max_delta_critical"],
                    "contracts": quantity
                },
                action_required="Roll up immediately to reduce assignment risk"
            ))
        elif short_delta >= self.thresholds["max_delta_warning"]:
            alerts.append(RiskAlert(
                alert_type=AlertType.ROLL_TRIGGER,
                severity=AlertSeverity.WARNING,
                ticker=ticker,
                message=f"⚠️ High Delta: {short_delta:.2f} (threshold: {self.thresholds['max_delta_warning']:.2f})",
                details={
                    "delta": short_delta,
                    "threshold": self.thresholds["max_delta_warning"]
                },
                action_required="Consider rolling up to lower delta"
            ))
        
        return alerts
    
    def _check_pnl_alerts(
        self,
        ticker: str,
        premium_received: float,
        current_value: float,
        quantity: int
    ) -> List[RiskAlert]:
        """Check P&L-based alerts."""
        alerts = []
        
        if premium_received <= 0:
            return alerts
        
        # Current P&L (positive = profit, negative = loss)
        pnl = (premium_received - current_value) * quantity * 100
        pnl_percent = ((premium_received - current_value) / premium_received) * 100
        
        # Profit target hit
        if pnl_percent >= self.thresholds["profit_target_percent"]:
            alerts.append(RiskAlert(
                alert_type=AlertType.PROFIT_TARGET,
                severity=AlertSeverity.INFO,
                ticker=ticker,
                message=f"💰 Profit target reached: {pnl_percent:.0f}% of premium captured",
                details={
                    "premium_received": premium_received,
                    "current_value": current_value,
                    "pnl": pnl,
                    "pnl_percent": pnl_percent,
                    "contracts": quantity
                },
                action_required="Consider closing short call early to lock in profits"
            ))
        
        # Stop loss triggered
        if pnl_percent <= -self.thresholds["stop_loss_percent"]:
            alerts.append(RiskAlert(
                alert_type=AlertType.STOP_LOSS,
                severity=AlertSeverity.CRITICAL,
                ticker=ticker,
                message=f"🛑 STOP LOSS: Loss is {abs(pnl_percent):.0f}% of premium received",
                details={
                    "premium_received": premium_received,
                    "current_value": current_value,
                    "pnl": pnl,
                    "pnl_percent": pnl_percent,
                    "contracts": quantity
                },
                action_required="Consider closing position or rolling to reduce loss"
            ))
        
        return alerts
    
    def _check_expiration_warnings(
        self,
        ticker: str,
        short_dte: int,
        long_dte: Optional[int] = None
    ) -> List[RiskAlert]:
        """Check for expiration warnings."""
        alerts = []
        
        # Short call expiration warning
        if short_dte == 0:
            alerts.append(RiskAlert(
                alert_type=AlertType.EXPIRATION_WARNING,
                severity=AlertSeverity.CRITICAL,
                ticker=ticker,
                message="⏰ SHORT CALL EXPIRES TODAY!",
                details={"short_dte": short_dte},
                action_required="Close or let expire by market close"
            ))
        elif short_dte == 1:
            alerts.append(RiskAlert(
                alert_type=AlertType.EXPIRATION_WARNING,
                severity=AlertSeverity.WARNING,
                ticker=ticker,
                message="⏰ Short call expires tomorrow",
                details={"short_dte": short_dte},
                action_required="Plan roll or closure"
            ))
        
        # LEAP expiration warning (if less than 60 days)
        if long_dte is not None and long_dte < 60:
            alerts.append(RiskAlert(
                alert_type=AlertType.EXPIRATION_WARNING,
                severity=AlertSeverity.WARNING,
                ticker=ticker,
                message=f"📆 LEAP expires in {long_dte} days - consider rolling",
                details={"long_dte": long_dte},
                action_required="Roll LEAP to new expiration to maintain position"
            ))
        
        return alerts
    
    def calculate_portfolio_beta_delta(
        self,
        positions: List[Dict[str, Any]],
        spy_price: float = 500.0
    ) -> Dict[str, Any]:
        """
        Calculate portfolio-level beta-weighted delta.
        
        This shows your total directional exposure relative to SPY.
        
        Args:
            positions: List of positions with delta, beta, quantity, price
            spy_price: Current SPY price for normalization
            
        Returns:
            Portfolio risk metrics
        """
        total_delta = 0.0
        total_beta_weighted_delta = 0.0
        total_notional = 0.0
        position_details = []
        
        for pos in positions:
            ticker = pos.get("ticker", "???")
            delta = pos.get("delta", 0) or 0
            beta = pos.get("beta", 1.0) or 1.0
            quantity = pos.get("quantity", 1)
            stock_price = pos.get("price", 100)
            
            # Position delta (delta * quantity * 100 shares)
            pos_delta = delta * quantity * 100
            
            # Notional value
            notional = stock_price * quantity * 100
            
            # Beta-weighted delta = position delta * beta * (stock_price / spy_price)
            beta_weighted = pos_delta * beta * (stock_price / spy_price)
            
            total_delta += pos_delta
            total_beta_weighted_delta += beta_weighted
            total_notional += notional
            
            position_details.append({
                "ticker": ticker,
                "delta": round(delta, 3),
                "beta": round(beta, 2),
                "position_delta": round(pos_delta, 1),
                "beta_weighted_delta": round(beta_weighted, 1),
                "notional": round(notional, 0)
            })
        
        # Generate alerts if thresholds exceeded
        alerts = []
        
        if abs(total_delta) > self.thresholds["max_portfolio_delta"]:
            alerts.append(RiskAlert(
                alert_type=AlertType.DELTA_EXPOSURE,
                severity=AlertSeverity.WARNING,
                ticker="PORTFOLIO",
                message=f"⚠️ High portfolio delta: {total_delta:.0f} (threshold: {self.thresholds['max_portfolio_delta']})",
                details={"total_delta": total_delta},
                action_required="Consider reducing directional exposure"
            ))
        
        if abs(total_beta_weighted_delta) > self.thresholds["max_beta_weighted_delta"]:
            alerts.append(RiskAlert(
                alert_type=AlertType.BETA_EXPOSURE,
                severity=AlertSeverity.WARNING,
                ticker="PORTFOLIO",
                message=f"⚠️ High SPY-equivalent exposure: {total_beta_weighted_delta:.0f} deltas",
                details={"beta_weighted_delta": total_beta_weighted_delta},
                action_required="Portfolio is heavily correlated to market moves"
            ))
        
        return {
            "total_delta": round(total_delta, 1),
            "total_beta_weighted_delta": round(total_beta_weighted_delta, 1),
            "spy_equivalent_shares": round(total_beta_weighted_delta, 0),
            "total_notional": round(total_notional, 0),
            "position_count": len(positions),
            "positions": position_details,
            "alerts": [a.to_dict() for a in alerts],
            "interpretation": self._interpret_beta_delta(total_beta_weighted_delta)
        }
    
    def _interpret_beta_delta(self, beta_weighted_delta: float) -> str:
        """Interpret beta-weighted delta exposure."""
        abs_delta = abs(beta_weighted_delta)
        direction = "bullish" if beta_weighted_delta > 0 else "bearish"
        
        if abs_delta < 10:
            return f"Minimal directional exposure ({direction})"
        elif abs_delta < 30:
            return f"Moderate {direction} exposure - equivalent to {abs_delta:.0f} SPY shares"
        elif abs_delta < 50:
            return f"Significant {direction} exposure - equivalent to {abs_delta:.0f} SPY shares"
        else:
            return f"HIGH {direction.upper()} exposure - equivalent to {abs_delta:.0f} SPY shares. Consider hedging."
    
    def get_all_alerts(
        self,
        positions: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Get all alerts for all positions.
        
        Args:
            positions: List of position dicts with full details
            
        Returns:
            Summary of all alerts by severity
        """
        all_alerts = []
        
        for pos in positions:
            alerts = self.analyze_position(
                ticker=pos.get("ticker", "???"),
                current_price=pos.get("current_price", 0),
                short_strike=pos.get("short_strike", 0),
                short_dte=pos.get("short_dte", 30),
                short_delta=pos.get("short_delta", 0.3),
                short_premium_received=pos.get("short_premium", 0),
                current_short_value=pos.get("current_short_value", 0),
                long_strike=pos.get("long_strike"),
                long_dte=pos.get("long_dte"),
                beta=pos.get("beta", 1.0),
                quantity=pos.get("quantity", 1)
            )
            all_alerts.extend(alerts)
        
        # Sort by severity
        severity_order = {
            AlertSeverity.CRITICAL: 0,
            AlertSeverity.WARNING: 1,
            AlertSeverity.INFO: 2
        }
        all_alerts.sort(key=lambda a: severity_order[a.severity])
        
        # Group by severity
        critical = [a.to_dict() for a in all_alerts if a.severity == AlertSeverity.CRITICAL]
        warnings = [a.to_dict() for a in all_alerts if a.severity == AlertSeverity.WARNING]
        info = [a.to_dict() for a in all_alerts if a.severity == AlertSeverity.INFO]
        
        return {
            "total_alerts": len(all_alerts),
            "critical_count": len(critical),
            "warning_count": len(warnings),
            "info_count": len(info),
            "critical": critical,
            "warnings": warnings,
            "info": info,
            "has_action_required": len(critical) > 0 or len(warnings) > 0
        }


# Singleton instance
risk_alert_service = RiskAlertService()
