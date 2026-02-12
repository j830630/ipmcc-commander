"""
IPMCC Commander - Risk Monitoring Router
Endpoints for risk alerts, portfolio analytics, and beta-weighted delta
"""

from fastapi import APIRouter, HTTPException, Body
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import date
import logging

from app.services.risk_alert_service import risk_alert_service, RiskAlertService
from app.schemas.validation_schemas import IPMCCSetupInput, Trade112Input, StrangleInput

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/risk", tags=["Risk Monitoring"])


class PositionRiskInput(BaseModel):
    """Input for analyzing a single position's risk."""
    ticker: str
    current_price: float = Field(..., gt=0)
    short_strike: float = Field(..., gt=0)
    short_dte: int = Field(..., ge=0)
    short_delta: float = Field(..., ge=0, le=1)
    short_premium_received: float = Field(0, ge=0)
    current_short_value: float = Field(0, ge=0)
    long_strike: Optional[float] = Field(None, gt=0)
    long_dte: Optional[int] = Field(None, ge=0)
    beta: float = Field(1.0, ge=0, le=5)
    quantity: int = Field(1, ge=1)


class PortfolioPositionInput(BaseModel):
    """Input for portfolio-level analysis."""
    ticker: str
    delta: float = Field(..., ge=-1, le=1)
    beta: float = Field(1.0, ge=0, le=5)
    price: float = Field(..., gt=0)
    quantity: int = Field(1, ge=1)


class ThresholdUpdateInput(BaseModel):
    """Update risk thresholds."""
    itm_warning_percent: Optional[float] = Field(None, ge=0, le=10)
    min_dte_warning: Optional[int] = Field(None, ge=1, le=30)
    max_delta_warning: Optional[float] = Field(None, ge=0.3, le=0.95)
    max_delta_critical: Optional[float] = Field(None, ge=0.5, le=1.0)
    max_portfolio_delta: Optional[float] = Field(None, ge=10, le=500)
    max_beta_weighted_delta: Optional[float] = Field(None, ge=10, le=500)
    profit_target_percent: Optional[float] = Field(None, ge=10, le=100)
    stop_loss_percent: Optional[float] = Field(None, ge=50, le=500)


# ============ VALIDATION ENDPOINTS ============

@router.post("/validate/ipmcc")
async def validate_ipmcc_setup(setup: IPMCCSetupInput):
    """
    Validate an IPMCC trade setup against strategy rules.
    
    Enforces:
    - Long Strike < Short Strike (bullish diagonal)
    - Long DTE > Short DTE (calendar spread)
    - Long DTE >= 180 days (LEAP requirement)
    - Short DTE 3-21 days (weekly income)
    - Delta constraints if provided
    
    Returns validation result with any errors.
    """
    # If we get here, Pydantic validation passed
    dte = setup.get_dte()
    
    return {
        "valid": True,
        "ticker": setup.ticker,
        "structure": {
            "long_strike": setup.long_strike,
            "short_strike": setup.short_strike,
            "spread_width": setup.short_strike - setup.long_strike,
            "long_dte": dte["long_dte"],
            "short_dte": dte["short_dte"]
        },
        "validation_checks": [
            {"check": "Long Strike < Short Strike", "passed": True},
            {"check": "Long DTE > Short DTE", "passed": True},
            {"check": "Long DTE >= 180 days", "passed": dte["long_dte"] >= 180},
            {"check": "Short DTE 3-21 days", "passed": 3 <= dte["short_dte"] <= 21}
        ]
    }


@router.post("/validate/112")
async def validate_112_setup(setup: Trade112Input):
    """Validate a 112 Trade setup."""
    today = date.today()
    dte = (setup.expiration - today).days
    
    return {
        "valid": True,
        "ticker": setup.ticker,
        "structure": {
            "long_put_strike": setup.long_put_strike,
            "short_put_strike": setup.short_put_strike,
            "spread_width": setup.long_put_strike - setup.short_put_strike,
            "dte": dte,
            "quantity": setup.quantity
        }
    }


@router.post("/validate/strangle")
async def validate_strangle_setup(setup: StrangleInput):
    """Validate a strangle setup."""
    today = date.today()
    dte = (setup.expiration - today).days
    
    return {
        "valid": True,
        "ticker": setup.ticker,
        "structure": {
            "call_strike": setup.call_strike,
            "put_strike": setup.put_strike,
            "width": setup.call_strike - setup.put_strike,
            "dte": dte,
            "quantity": setup.quantity
        }
    }


# ============ RISK ALERT ENDPOINTS ============

@router.post("/analyze/position")
async def analyze_position_risk(position: PositionRiskInput):
    """
    Analyze a single position for risk alerts.
    
    Returns alerts for:
    - Assignment risk (ITM warnings)
    - Roll triggers (DTE, Delta)
    - P&L alerts (profit target, stop loss)
    - Expiration warnings
    """
    alerts = risk_alert_service.analyze_position(
        ticker=position.ticker,
        current_price=position.current_price,
        short_strike=position.short_strike,
        short_dte=position.short_dte,
        short_delta=position.short_delta,
        short_premium_received=position.short_premium_received,
        current_short_value=position.current_short_value,
        long_strike=position.long_strike,
        long_dte=position.long_dte,
        beta=position.beta,
        quantity=position.quantity
    )
    
    return {
        "ticker": position.ticker,
        "alert_count": len(alerts),
        "alerts": [a.to_dict() for a in alerts],
        "position_summary": {
            "itm_distance": ((position.short_strike - position.current_price) / position.current_price) * 100,
            "short_dte": position.short_dte,
            "short_delta": position.short_delta
        }
    }


@router.post("/analyze/portfolio")
async def analyze_portfolio_risk(positions: List[PositionRiskInput]):
    """
    Analyze all positions for risk alerts.
    
    Returns aggregated alerts sorted by severity.
    """
    position_dicts = [
        {
            "ticker": p.ticker,
            "current_price": p.current_price,
            "short_strike": p.short_strike,
            "short_dte": p.short_dte,
            "short_delta": p.short_delta,
            "short_premium": p.short_premium_received,
            "current_short_value": p.current_short_value,
            "long_strike": p.long_strike,
            "long_dte": p.long_dte,
            "beta": p.beta,
            "quantity": p.quantity
        }
        for p in positions
    ]
    
    return risk_alert_service.get_all_alerts(position_dicts)


@router.post("/analyze/beta-delta")
async def analyze_portfolio_beta_delta(
    positions: List[PortfolioPositionInput],
    spy_price: float = 500.0
):
    """
    Calculate portfolio beta-weighted delta.
    
    This shows your total directional exposure relative to SPY.
    
    A beta-weighted delta of 50 means your portfolio will move
    roughly like 50 shares of SPY.
    """
    position_dicts = [
        {
            "ticker": p.ticker,
            "delta": p.delta,
            "beta": p.beta,
            "price": p.price,
            "quantity": p.quantity
        }
        for p in positions
    ]
    
    return risk_alert_service.calculate_portfolio_beta_delta(position_dicts, spy_price)


# ============ THRESHOLD MANAGEMENT ============

@router.get("/thresholds")
async def get_risk_thresholds():
    """Get current risk alert thresholds."""
    return {
        "thresholds": risk_alert_service.thresholds,
        "descriptions": {
            "itm_warning_percent": "Warn when short call is within X% of ITM",
            "min_dte_warning": "Warn when DTE < X days",
            "max_delta_warning": "Warn when short delta > X",
            "max_delta_critical": "Critical alert when short delta > X",
            "max_portfolio_delta": "Warn when total portfolio delta exceeds X",
            "max_beta_weighted_delta": "Warn when beta-weighted delta exceeds X",
            "profit_target_percent": "Alert when profit reaches X% of premium",
            "stop_loss_percent": "Alert when loss exceeds X% of premium"
        }
    }


@router.put("/thresholds")
async def update_risk_thresholds(updates: ThresholdUpdateInput):
    """Update risk alert thresholds."""
    update_dict = updates.model_dump(exclude_none=True)
    
    for key, value in update_dict.items():
        if key in risk_alert_service.thresholds:
            risk_alert_service.thresholds[key] = value
    
    return {
        "updated": list(update_dict.keys()),
        "thresholds": risk_alert_service.thresholds
    }


# ============ QUICK CHECKS ============

@router.get("/check/assignment/{ticker}")
async def quick_assignment_check(
    ticker: str,
    current_price: float,
    short_strike: float,
    short_delta: float = 0.3
):
    """Quick check for assignment risk on a position."""
    distance_percent = ((short_strike - current_price) / current_price) * 100
    
    status = "safe"
    if current_price >= short_strike:
        status = "critical"
    elif distance_percent <= 2:
        status = "warning"
    
    return {
        "ticker": ticker.upper(),
        "status": status,
        "current_price": current_price,
        "short_strike": short_strike,
        "distance_percent": round(distance_percent, 2),
        "short_delta": short_delta,
        "is_itm": current_price >= short_strike,
        "recommendation": {
            "safe": "No action needed",
            "warning": "Monitor closely, prepare roll strategy",
            "critical": "Consider rolling up/out immediately"
        }[status]
    }


@router.get("/check/roll/{ticker}")
async def quick_roll_check(
    ticker: str,
    short_dte: int,
    short_delta: float
):
    """Quick check if a position should be rolled."""
    should_roll = False
    reasons = []
    
    if short_dte <= 7:
        should_roll = True
        reasons.append(f"DTE ({short_dte}) is at or below 7 days")
    
    if short_delta >= 0.70:
        should_roll = True
        reasons.append(f"Delta ({short_delta:.2f}) is at or above 0.70")
    
    return {
        "ticker": ticker.upper(),
        "should_roll": should_roll,
        "short_dte": short_dte,
        "short_delta": short_delta,
        "reasons": reasons,
        "recommendation": "Roll to next expiration and/or higher strike" if should_roll else "No roll needed"
    }
