"""
IPMCC Commander - Analysis Router
Trade Lab validation and Greeks calculation endpoints
"""

from fastapi import APIRouter, HTTPException
from typing import Optional
from datetime import date

from app.services.greeks_engine import greeks_engine
from app.services.validation_engine import validation_engine
from app.services.market_data import market_data
from app.schemas.analysis import (
    ValidationRequest,
    ValidationResponse,
    ValidationCheck,
    ValidationWarning,
    ValidationMetrics,
    GreeksRequest,
    GreeksResponse,
    OptionGreeks,
    IPMCCGreeksRequest,
    IPMCCGreeksResponse
)

router = APIRouter()


@router.post("/validate", response_model=ValidationResponse)
async def validate_ipmcc_setup(request: ValidationRequest):
    """
    Validate a potential IPMCC trade against strategy rules.
    
    Checks:
    - Weekly uptrend
    - Long delta (70-90)
    - Long DTE (>= 180)
    - Daily RSI (prefer < 50)
    - Short strike ATM
    - Short DTE (7-14)
    - Support proximity
    
    Returns a score out of 100 with individual check results.
    """
    result = validation_engine.validate_setup(
        ticker=request.ticker,
        long_strike=request.long_strike,
        long_expiration=request.long_expiration,
        short_strike=request.short_strike,
        short_expiration=request.short_expiration,
        quantity=request.quantity
    )
    
    # Convert to response model
    checks = [
        ValidationCheck(**check) for check in result.get("checks", [])
    ]
    warnings = [
        ValidationWarning(**warn) for warn in result.get("warnings", [])
    ]
    
    metrics = None
    if result.get("metrics"):
        metrics = ValidationMetrics(**result["metrics"])
    
    return ValidationResponse(
        valid=result.get("valid", False),
        score=result.get("score", 0),
        checks=checks,
        warnings=warnings,
        metrics=metrics,
        error=result.get("error")
    )


@router.post("/greeks", response_model=GreeksResponse)
async def calculate_greeks(request: GreeksRequest):
    """
    Calculate Greeks for a single option.
    
    Uses Black-Scholes model via mibian library.
    """
    dte = greeks_engine.calculate_days_to_expiry(request.expiration)
    
    if request.option_type == "call":
        result = greeks_engine.calculate_call_greeks(
            stock_price=request.stock_price,
            strike=request.strike,
            days_to_expiry=dte,
            volatility=request.volatility
        )
    else:
        result = greeks_engine.calculate_put_greeks(
            stock_price=request.stock_price,
            strike=request.strike,
            days_to_expiry=dte,
            volatility=request.volatility
        )
    
    if result.get("error"):
        return GreeksResponse(greeks=None, error=result["error"])
    
    return GreeksResponse(
        greeks=OptionGreeks(**result),
        error=None
    )


@router.post("/ipmcc-greeks", response_model=IPMCCGreeksResponse)
async def calculate_ipmcc_greeks(request: IPMCCGreeksRequest):
    """
    Calculate combined Greeks for an IPMCC position.
    
    Returns:
    - Long leg Greeks
    - Short leg Greeks  
    - Net position Greeks
    - Position metrics (capital required, weekly extrinsic, etc.)
    """
    long_dte = greeks_engine.calculate_days_to_expiry(request.long_expiration)
    short_dte = greeks_engine.calculate_days_to_expiry(request.short_expiration)
    
    result = greeks_engine.calculate_ipmcc_position(
        stock_price=request.stock_price,
        long_strike=request.long_strike,
        long_dte=long_dte,
        long_iv=request.long_iv,
        short_strike=request.short_strike,
        short_dte=short_dte,
        short_iv=request.short_iv,
        quantity=request.quantity
    )
    
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    
    return IPMCCGreeksResponse(
        long=OptionGreeks(**result["long"]),
        short=OptionGreeks(**result["short"]),
        net=result["net"],
        metrics=result["metrics"],
        error=None
    )


@router.get("/scenario/{ticker}")
async def get_scenario_data(
    ticker: str,
    long_strike: float,
    long_expiration: str,
    short_strike: float,
    short_expiration: str,
    quantity: int = 1
):
    """
    Get scenario analysis data for P&L chart.
    
    Returns P&L at various stock prices for the short call expiration.
    """
    # Get current data
    quote = market_data.get_quote(ticker)
    if quote.get("error") or not quote.get("price"):
        raise HTTPException(status_code=400, detail=f"Could not fetch quote: {quote.get('error')}")
    
    stock_price = quote["price"]
    
    # Get chain for IV estimates
    chain = market_data.get_options_chain(ticker, short_expiration)
    short_iv = 25.0  # Default if not found
    
    for opt in chain.get("calls", []):
        if abs(opt.get("strike", 0) - short_strike) < 1:
            short_iv = opt.get("implied_volatility", 25.0)
            break
    
    # Calculate current position value
    long_dte = greeks_engine.calculate_days_to_expiry(long_expiration)
    short_dte = greeks_engine.calculate_days_to_expiry(short_expiration)
    
    position = greeks_engine.calculate_ipmcc_position(
        stock_price=stock_price,
        long_strike=long_strike,
        long_dte=long_dte,
        long_iv=short_iv,  # Approximate
        short_strike=short_strike,
        short_dte=short_dte,
        short_iv=short_iv,
        quantity=quantity
    )
    
    if position.get("error"):
        raise HTTPException(status_code=400, detail=position["error"])
    
    entry_cost = position["long"]["price"] - position["short"]["price"]
    
    # Generate P&L curve at expiration (short_dte = 0)
    scenarios = []
    price_range = stock_price * 0.15  # ±15% range
    
    for price_offset in range(-10, 11):
        test_price = stock_price + (price_range * price_offset / 10)
        
        # Calculate LEAP value at this price (still has time)
        long_at_test = greeks_engine.calculate_call_greeks(
            stock_price=test_price,
            strike=long_strike,
            days_to_expiry=long_dte - short_dte,  # After short expiry
            volatility=short_iv
        )
        
        # Short call at expiration
        short_intrinsic = max(0, test_price - short_strike)
        
        # P&L calculation
        # Long value changed + short call P&L
        long_pnl = (long_at_test["price"] - position["long"]["price"]) * 100 * quantity
        short_pnl = (position["short"]["price"] - short_intrinsic) * 100 * quantity
        total_pnl = long_pnl + short_pnl
        
        scenarios.append({
            "stock_price": round(test_price, 2),
            "long_value": round(long_at_test["price"], 2),
            "short_value": round(short_intrinsic, 2),
            "long_pnl": round(long_pnl, 2),
            "short_pnl": round(short_pnl, 2),
            "total_pnl": round(total_pnl, 2)
        })
    
    return {
        "ticker": ticker.upper(),
        "current_price": stock_price,
        "entry_cost_per_share": round(entry_cost, 2),
        "entry_cost_total": round(entry_cost * 100 * quantity, 2),
        "breakeven": round(long_strike + entry_cost, 2),
        "max_profit_at_expiry": round(position["short"]["extrinsic"] * 100 * quantity, 2),
        "scenarios": scenarios
    }


@router.get("/signals/{position_id}")
async def check_position_signals(
    position_id: str,
    long_value: float,
    long_entry_price: float,
    short_extrinsic_remaining: float,
    short_entry_extrinsic: float,
    long_dte: int,
    cumulative_short_pnl: float = 0
):
    """
    Check management signals for an existing position.
    
    Returns alerts for:
    - Roll due (extrinsic < 20%)
    - Assignment risk (extrinsic < 10%)
    - Emergency exit (loss > 30%)
    - LEAP expiring (< 60 DTE)
    - Profit target (> 50% gain)
    """
    signals = validation_engine.check_management_signals(
        position_id=position_id,
        long_value=long_value,
        long_entry_price=long_entry_price,
        short_extrinsic_remaining=short_extrinsic_remaining,
        short_entry_extrinsic=short_entry_extrinsic,
        long_dte=long_dte,
        cumulative_short_pnl=cumulative_short_pnl
    )
    
    return {
        "position_id": position_id,
        "signals": signals,
        "signal_count": len(signals),
        "has_critical": any(s["priority"] == "critical" for s in signals),
        "has_high": any(s["priority"] == "high" for s in signals)
    }
