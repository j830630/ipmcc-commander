"""
IPMCC Commander - Strategy Scanner Router
Scanning for IPMCC/112/Strangle strategies with macro validation.
"""

from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal

from app.services.market_data_service import market_data_service
from app.services.event_position_service import position_event_service

router = APIRouter()


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class StrategyScanRequest(BaseModel):
    """Strategy scan request."""
    ticker: str
    strategy: Literal["ipmcc", "112", "strangle"]
    current_price: Optional[float] = None
    iv_rank: Optional[int] = 50
    days_to_expiration: Optional[int] = 30
    expiration_date: Optional[str] = None  # For earnings check


class StrategyScanResponse(BaseModel):
    """Strategy scan response."""
    ticker: str
    strategy: str
    # Signal
    signal: Literal["strong_buy", "buy", "neutral", "avoid", "strong_avoid"]
    signal_reason: str
    final_confidence: int
    macro_override: bool
    # Scores
    iv_rank_score: int
    trend_score: int
    premium_score: int
    risk_score: int
    # Recommendation
    recommendation: str
    strikes: str
    target_premium: str
    max_risk: str
    expected_return: str
    days_to_expiration: int
    # Earnings check
    earnings_risk: Optional[Dict[str, Any]] = None
    # Warnings
    warnings: List[str]
    # Macro context
    macro: Optional[Dict[str, Any]] = None


class MacroContextResponse(BaseModel):
    """Macro context for a ticker."""
    vix_level: float
    vix_regime: str
    market_trend: str
    sector: Optional[Dict[str, Any]] = None
    macro_adjustment: int
    macro_warnings: List[str]
    macro_status: Literal["clear", "caution", "high_risk"]


# ============================================================================
# ANALYSIS FUNCTIONS
# ============================================================================

def analyze_strategy_signal(data: StrategyScanRequest) -> Dict[str, Any]:
    """
    Analyze strategy signal based on IV, trend, and macro factors.
    """
    warnings = []
    iv_rank = data.iv_rank or 50
    dte = data.days_to_expiration or 30
    price = data.current_price or 100
    
    # Score based on strategy
    if data.strategy == "ipmcc":
        # IPMCC: Good between IV 40-70
        if iv_rank >= 40 and iv_rank <= 70:
            iv_score = 30
        elif iv_rank >= 30 and iv_rank <= 80:
            iv_score = 20
        else:
            iv_score = 10
            warnings.append(f"IV Rank {iv_rank}% outside optimal 40-70 range")
        
        # DTE: 30-45 optimal
        if dte >= 30 and dte <= 45:
            trend_score = 25
        elif dte >= 21 and dte <= 60:
            trend_score = 15
        else:
            trend_score = 5
            warnings.append(f"DTE {dte} outside optimal 30-45 range")
        
        premium_score = 20
        risk_score = 15
        
        atm = round(price / 5) * 5
        strikes = f"LEAP {atm - 20}C (0.80Δ) / Short {atm + 10}C (0.25Δ)"
        target_premium = f"${price * 0.015:.2f} weekly"
        max_risk = f"${price * 0.10:.0f} (LEAP extrinsic)"
        expected_return = "1-2% weekly income velocity"
        recommendation = "Sell short call at 30-45 DTE, 0.20-0.30 delta"
        
    elif data.strategy == "112":
        # 112: Good between IV 35-60
        if iv_rank >= 35 and iv_rank <= 60:
            iv_score = 30
        elif iv_rank >= 25 and iv_rank <= 70:
            iv_score = 20
        else:
            iv_score = 10
            warnings.append(f"IV Rank {iv_rank}% outside optimal 35-60 range")
        
        trend_score = 20
        premium_score = 20
        risk_score = 20
        
        atm = round(price / 5) * 5
        strikes = f"Buy 1x {atm}C / Sell 1x {atm+5}C / Sell 2x {atm+15}C"
        target_premium = f"${price * 0.01:.2f} credit"
        max_risk = f"${(price * 0.02):.0f}"
        expected_return = "15-30% on risk"
        recommendation = "Bullish bias with credit. Profit if price moves moderately."
        
    else:  # strangle
        # Strangle: High IV preferred (50+)
        if iv_rank >= 50:
            iv_score = 35
        elif iv_rank >= 40:
            iv_score = 25
        else:
            iv_score = 10
            warnings.append(f"IV Rank {iv_rank}% below optimal 50+ for strangles")
        
        trend_score = 15
        premium_score = 25
        risk_score = 15
        
        atm = round(price / 5) * 5
        put_strike = atm - round(price * 0.08 / 5) * 5
        call_strike = atm + round(price * 0.08 / 5) * 5
        strikes = f"Sell {put_strike}P / Sell {call_strike}C"
        target_premium = f"${price * 0.025:.2f} total credit"
        max_risk = "Undefined - use stop loss"
        expected_return = "50% profit target on credit"
        recommendation = "Neutral position. Exit at 50% profit or 200% loss."
    
    # Calculate confidence
    confidence = iv_score + trend_score + premium_score + risk_score
    
    # Determine signal
    if confidence >= 80:
        signal = "strong_buy"
        signal_reason = "All criteria strongly met"
    elif confidence >= 65:
        signal = "buy"
        signal_reason = "Most criteria met"
    elif confidence >= 50:
        signal = "neutral"
        signal_reason = "Mixed signals"
    elif confidence >= 35:
        signal = "avoid"
        signal_reason = "Below threshold"
    else:
        signal = "strong_avoid"
        signal_reason = "Fails key criteria"
    
    return {
        "signal": signal,
        "signal_reason": signal_reason,
        "confidence": confidence,
        "iv_rank_score": iv_score,
        "trend_score": trend_score,
        "premium_score": premium_score,
        "risk_score": risk_score,
        "recommendation": recommendation,
        "strikes": strikes,
        "target_premium": target_premium,
        "max_risk": max_risk,
        "expected_return": expected_return,
        "days_to_expiration": dte,
        "warnings": warnings
    }


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/strategy", response_model=StrategyScanResponse)
async def scan_strategy(request: StrategyScanRequest):
    """
    Run strategy scan (IPMCC/112/Strangle).
    Includes macro validation and earnings checking.
    """
    # Get market snapshot
    try:
        market_snapshot = await market_data_service.get_market_snapshot(request.ticker)
    except:
        market_snapshot = None
    
    # Run technical analysis
    technical = analyze_strategy_signal(request)
    
    # Check earnings risk if expiration provided
    earnings_risk = None
    if request.expiration_date:
        earnings_risk = position_event_service.check_position_earnings_risk(
            request.ticker,
            request.expiration_date,
            request.strategy
        )
        if earnings_risk.get("has_risk") and earnings_risk.get("risk_level") == "high":
            technical["warnings"].append(f"⚠️ EARNINGS RISK: {earnings_risk.get('reason')}")
    
    # Calculate macro adjustment
    macro_adjustment = 0
    
    # VIX regime
    vix_data = market_snapshot.get("vix", {}) if market_snapshot else {}
    if vix_data.get("regime") == "extreme":
        macro_adjustment -= 15
        technical["warnings"].append("VIX EXTREME - high uncertainty")
    elif vix_data.get("regime") == "high":
        macro_adjustment -= 5
    
    # Sector analysis
    if market_snapshot and market_snapshot.get("sector"):
        sector = market_snapshot["sector"]
        if sector.get("flow_direction") == "outflow":
            macro_adjustment -= 10
            technical["warnings"].append(f"Sector ({sector['sector_etf']}) underperforming")
    
    # Earnings adjustment
    if earnings_risk and earnings_risk.get("risk_level") == "high":
        macro_adjustment -= 20
    
    # Final confidence
    final_confidence = max(0, min(100, technical["confidence"] + macro_adjustment))
    
    # Adjust signal based on confidence
    final_signal = technical["signal"]
    macro_override = False
    
    if final_confidence < 30:
        final_signal = "strong_avoid"
        macro_override = True
    elif final_confidence < 45 and final_signal in ["strong_buy", "buy"]:
        final_signal = "avoid" if final_confidence < 35 else "neutral"
        macro_override = True
    
    # Build macro context
    macro_context = {
        "vix_level": vix_data.get("vix", 18),
        "vix_regime": vix_data.get("regime", "elevated"),
        "market_trend": market_snapshot.get("spy", {}).get("trend", "neutral") if market_snapshot else "neutral",
        "sector": market_snapshot.get("sector") if market_snapshot else None,
        "macro_adjustment": macro_adjustment,
        "macro_warnings": [w for w in technical["warnings"] if "⚠️" in w or "VIX" in w or "Sector" in w],
        "macro_status": "high_risk" if macro_adjustment < -20 else "caution" if macro_adjustment < -10 else "clear"
    }
    
    return StrategyScanResponse(
        ticker=request.ticker,
        strategy=request.strategy,
        signal=final_signal,
        signal_reason=technical["signal_reason"],
        final_confidence=final_confidence,
        macro_override=macro_override,
        iv_rank_score=technical["iv_rank_score"],
        trend_score=technical["trend_score"],
        premium_score=technical["premium_score"],
        risk_score=technical["risk_score"],
        recommendation=technical["recommendation"],
        strikes=technical["strikes"],
        target_premium=technical["target_premium"],
        max_risk=technical["max_risk"],
        expected_return=technical["expected_return"],
        days_to_expiration=technical["days_to_expiration"],
        earnings_risk=earnings_risk,
        warnings=technical["warnings"],
        macro=macro_context
    )


@router.get("/macro/{ticker}")
async def get_macro_context(ticker: str):
    """
    Get macro context for a ticker.
    """
    # Get market snapshot
    try:
        market_snapshot = await market_data_service.get_market_snapshot(ticker)
    except Exception as e:
        market_snapshot = {"error": str(e)}
    
    vix_data = market_snapshot.get("vix", {}) if isinstance(market_snapshot, dict) else {}
    
    macro_adjustment = 0
    macro_warnings = []
    
    if vix_data.get("regime") == "extreme":
        macro_adjustment -= 15
        macro_warnings.append("VIX in extreme regime")
    elif vix_data.get("regime") == "high":
        macro_adjustment -= 5
        macro_warnings.append("VIX elevated")
    
    if market_snapshot and market_snapshot.get("sector", {}).get("flow_direction") == "outflow":
        macro_adjustment -= 10
        macro_warnings.append("Sector underperforming")
    
    return MacroContextResponse(
        vix_level=vix_data.get("vix", 18),
        vix_regime=vix_data.get("regime", "elevated"),
        market_trend=market_snapshot.get("spy", {}).get("trend", "neutral") if isinstance(market_snapshot, dict) else "neutral",
        sector=market_snapshot.get("sector") if isinstance(market_snapshot, dict) else None,
        macro_adjustment=macro_adjustment,
        macro_warnings=macro_warnings,
        macro_status="high_risk" if macro_adjustment < -20 else "caution" if macro_adjustment < -10 else "clear"
    )
