"""
IPMCC Commander - Unified Scanner Router
Consolidates 0-DTE (The Desk) and Strategy (IPMCC/112/Strangle) scanning
Both share macro context validation.
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.market_data_service import market_data_service
from app.services.event_0dte_service import event_0dte_service
from app.services.event_position_service import position_event_service

router = APIRouter()


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class ScanRequest(BaseModel):
    """Common scan request."""
    ticker: str
    current_price: Optional[float] = None
    # GEX data (for 0-DTE)
    zero_gamma: Optional[float] = None
    call_wall: Optional[float] = None
    put_wall: Optional[float] = None
    net_gex: Optional[float] = None
    # Flow data
    volume_delta: Optional[float] = 0
    net_delta: Optional[Literal["bullish", "bearish", "neutral"]] = "neutral"
    vanna_flow: Optional[Literal["supportive", "hostile", "neutral"]] = "neutral"
    charm_effect: Optional[Literal["pinning", "unpinning", "neutral"]] = "neutral"
    dark_pool: Optional[Literal["bullish", "bearish", "mixed", "none"]] = "none"
    institutional: Optional[Literal["accumulation", "distribution", "neutral"]] = "neutral"
    # Volatility
    vix: Optional[float] = None
    vix_change: Optional[float] = 0
    iv_rank: Optional[int] = 50
    # Strategy-specific
    days_to_expiration: Optional[int] = 30
    expiration_date: Optional[str] = None  # For earnings check


class DeskScanResponse(BaseModel):
    """0-DTE scan response."""
    ticker: str
    # Status
    status: Literal["green_light", "caution", "no_trade"]
    status_reason: str
    final_confidence: int
    macro_override: bool
    # Regime
    regime: str
    regime_description: str
    # Trade details
    direction: Literal["bullish", "bearish", "neutral", "none"]
    structural_thesis: str
    structure: Optional[str] = None
    strikes: Optional[str] = None
    entry_zone: Optional[Dict[str, float]] = None
    profit_target: Optional[float] = None
    invalidation_level: Optional[float] = None
    invalidation_reason: Optional[str] = None
    hold_time: Optional[str] = None
    # Risk
    fakeout_risk: Literal["low", "medium", "high"]
    warnings: List[str]
    # Macro context
    macro: Optional[Dict[str, Any]] = None


class StrategyScanRequest(ScanRequest):
    """Strategy-specific scan request."""
    strategy: Literal["ipmcc", "112", "strangle"]


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
    """Shared macro context."""
    # Events
    events: List[Dict[str, Any]]
    has_binary_event: bool
    event_override: Optional[str] = None
    # Market
    vix_level: float
    vix_regime: str
    market_trend: str
    # Sector (for single stocks)
    sector: Optional[Dict[str, Any]] = None
    # Adjustments
    macro_adjustment: int
    macro_warnings: List[str]
    macro_status: Literal["clear", "caution", "high_risk"]


# ============================================================================
# ANALYSIS FUNCTIONS
# ============================================================================

def analyze_desk_signal(data: ScanRequest) -> Dict[str, Any]:
    """
    Analyze 0-DTE signal using The Desk methodology.
    """
    warnings = []
    
    # REGIME DETECTION
    regime = "choppy_fakeout"
    regime_description = "Conflicting signals"
    
    net_gex = data.net_gex or 0
    volume_delta = data.volume_delta or 0
    vix_change = data.vix_change or 0
    
    if net_gex < -3 and abs(volume_delta) > 1.5:
        regime = "trend_day"
        regime_description = "Dealers SHORT gamma + strong flow = TREND DAY"
    elif net_gex > 4 and data.charm_effect == "pinning":
        regime = "mean_reversion"
        regime_description = "Dealers LONG gamma + charm pinning = MEAN REVERSION"
    elif vix_change > 8:
        regime = "volatility_breakout"
        regime_description = "VIX expanding = VOLATILITY BREAKOUT"
    elif data.vanna_flow == "hostile" and data.charm_effect == "unpinning":
        regime = "gamma_squeeze"
        regime_description = "Vanna hostile + charm unpinning = GAMMA SQUEEZE"
    else:
        regime = "choppy_fakeout"
        regime_description = "Conflicting signals = NO TRADE stance"
    
    # FAKEOUT DETECTION
    fakeout_risk = "low"
    price = data.current_price or 0
    prev_close = price - (price * 0.001)  # Estimate if not provided
    price_bullish = price > prev_close
    flow_bullish = volume_delta > 0.5
    
    if price_bullish and not flow_bullish:
        warnings.append("DIVERGENCE: Price up but flow negative - bull trap risk")
        fakeout_risk = "high"
    if not price_bullish and flow_bullish:
        warnings.append("DIVERGENCE: Price down but flow positive - bear trap risk")
        fakeout_risk = "high"
    if data.dark_pool == "mixed":
        warnings.append("DARK POOL: Mixed prints - no conviction")
        fakeout_risk = "medium" if fakeout_risk == "low" else fakeout_risk
    
    # STATUS
    if regime == "choppy_fakeout":
        status = "no_trade"
        status_reason = "Choppy regime. Capital preservation."
    elif fakeout_risk == "high":
        status = "no_trade"
        status_reason = "High fakeout risk."
    elif fakeout_risk == "medium":
        status = "caution"
        status_reason = "Setup present but needs confirmation."
    else:
        status = "green_light"
        status_reason = "Flow confirmed, structure aligned."
    
    # DIRECTION & STRUCTURE
    direction = "none"
    structural_thesis = ""
    structure = None
    strikes = None
    atm = round((price or 5000) / 5) * 5
    
    if status != "no_trade":
        if regime == "trend_day":
            if volume_delta > 0 and data.net_delta == "bullish":
                direction = "bullish"
                structural_thesis = f"Trend UP: Target Call Wall {data.call_wall}"
                structure = "Bull Call Vertical"
                strikes = f"Buy {atm}C / Sell {atm + 10}C"
            elif volume_delta < 0 and data.net_delta == "bearish":
                direction = "bearish"
                structural_thesis = f"Trend DOWN: Target Put Wall {data.put_wall}"
                structure = "Bear Put Vertical"
                strikes = f"Buy {atm}P / Sell {atm - 10}P"
        elif regime == "mean_reversion":
            zg = data.zero_gamma or atm
            if price > zg + 15:
                direction = "bearish"
                structural_thesis = f"FADE: Extended above Zero Gamma"
                structure = "Put Butterfly"
            elif price < zg - 15:
                direction = "bullish"
                structural_thesis = f"BUY DIP: Below Zero Gamma"
                structure = "Call Butterfly"
            else:
                direction = "neutral"
                structural_thesis = "Range-bound near Zero Gamma"
                structure = "Iron Condor"
    
    # CONFIDENCE
    confidence = 50
    if data.net_delta == ("bullish" if direction == "bullish" else "bearish"):
        confidence += 15
    if fakeout_risk == "low":
        confidence += 10
    if fakeout_risk == "high":
        confidence -= 15
    confidence = max(0, min(100, confidence))
    
    # LEVELS
    entry_zone = {"low": price - 3, "high": price + 2} if price else None
    zg = data.zero_gamma or atm
    profit_target = data.call_wall if direction == "bullish" else data.put_wall if direction == "bearish" else zg
    invalidation = zg - 10 if direction == "bullish" else zg + 10 if direction == "bearish" else None
    
    hold_time = {
        "trend_day": "1-3 hours",
        "mean_reversion": "30 min - 2 hours",
        "gamma_squeeze": "15-45 min"
    }.get(regime, "1-2 hours")
    
    return {
        "status": status,
        "status_reason": status_reason,
        "regime": regime,
        "regime_description": regime_description,
        "direction": direction,
        "structural_thesis": structural_thesis,
        "structure": structure,
        "strikes": strikes,
        "entry_zone": entry_zone,
        "profit_target": profit_target,
        "invalidation_level": invalidation,
        "invalidation_reason": "Break beyond Zero Gamma" if invalidation else None,
        "hold_time": hold_time,
        "confidence": confidence,
        "fakeout_risk": fakeout_risk,
        "warnings": warnings
    }


def analyze_strategy_signal(data: StrategyScanRequest) -> Dict[str, Any]:
    """
    Analyze strategy signal (IPMCC/112/Strangle).
    """
    warnings = []
    strategy = data.strategy
    iv_rank = data.iv_rank or 50
    price = data.current_price or 100
    atm = round(price / 5) * 5
    
    # Score components
    iv_rank_score = min(100, iv_rank + 20) if iv_rank >= 50 else iv_rank
    trend_score = 50  # Would need more data
    premium_score = iv_rank_score
    risk_score = 50
    
    signal = "neutral"
    signal_reason = ""
    recommendation = ""
    strikes = ""
    target_premium = ""
    max_risk = ""
    expected_return = ""
    
    if strategy == "ipmcc":
        if iv_rank >= 40:
            overall = (iv_rank_score * 0.5 + premium_score * 0.3 + 20)
            if overall >= 70:
                signal = "strong_buy"
                signal_reason = "Elevated IV = optimal IPMCC entry"
            elif overall >= 55:
                signal = "buy"
                signal_reason = "Decent setup for covered calls"
            else:
                signal = "neutral"
                signal_reason = "Wait for better IV"
        else:
            signal = "avoid"
            signal_reason = "IV too low for meaningful premium"
            warnings.append("IV Rank < 40: Premium insufficient")
        
        otm_strike = round((price * 1.05) / 5) * 5
        strikes = f"Sell {otm_strike} Call (0.20-0.30 delta)"
        target_premium = f"${price * 0.01 * (iv_rank/50):.2f} - ${price * 0.02 * (iv_rank/50):.2f}/share"
        max_risk = "Stock ownership risk below cost basis"
        expected_return = f"{(iv_rank/50) * 1.5:.1f}% - {(iv_rank/50) * 2.5:.1f}% monthly"
        recommendation = f"Sell {data.days_to_expiration}DTE call at {otm_strike}"
        
    elif strategy == "112":
        overall = (iv_rank_score * 0.4 + premium_score * 0.3 + 30)
        if overall >= 65 and iv_rank >= 35:
            signal = "strong_buy"
            signal_reason = "Good IV + structure for 112"
        elif overall >= 50:
            signal = "buy"
            signal_reason = "Acceptable 112 conditions"
        else:
            signal = "neutral"
            signal_reason = "Wait for clearer setup"
        
        strikes = f"Buy 1x {atm}C / Sell 1x {atm+5}C / Sell 2x {atm+15}C"
        target_premium = "Net credit or small debit"
        max_risk = "Defined: Inner spread width minus credit"
        expected_return = "50-100% of credit at expiration"
        recommendation = f"Bullish 112 with {data.days_to_expiration}DTE"
        
    elif strategy == "strangle":
        if iv_rank < 40:
            signal = "avoid"
            signal_reason = "IV too low for strangle risk"
            warnings.append("IV Rank < 40: Premium doesn't justify risk")
        elif iv_rank >= 60:
            signal = "strong_buy"
            signal_reason = "High IV = prime strangle conditions"
        elif iv_rank >= 45:
            signal = "buy"
            signal_reason = "Decent strangle setup"
        else:
            signal = "neutral"
            signal_reason = "Consider iron condor for defined risk"
        
        call_strike = round((price * 1.10) / 5) * 5
        put_strike = round((price * 0.90) / 5) * 5
        strikes = f"Sell {put_strike}P / Sell {call_strike}C"
        target_premium = f"${price * 0.015 * (iv_rank/50):.2f} - ${price * 0.03 * (iv_rank/50):.2f} credit"
        max_risk = "Undefined - position size max 2-3% of portfolio"
        expected_return = f"{(iv_rank/50) * 2:.1f}% - {(iv_rank/50) * 4:.1f}% monthly"
        recommendation = f"{data.days_to_expiration}DTE strangle at {put_strike}P/{call_strike}C"
    
    confidence = round((iv_rank_score * 0.4 + premium_score * 0.3 + trend_score * 0.3))
    
    return {
        "strategy": strategy,
        "signal": signal,
        "signal_reason": signal_reason,
        "confidence": max(0, min(100, confidence)),
        "iv_rank_score": iv_rank_score,
        "trend_score": trend_score,
        "premium_score": premium_score,
        "risk_score": risk_score,
        "recommendation": recommendation,
        "strikes": strikes,
        "target_premium": target_premium,
        "max_risk": max_risk,
        "expected_return": expected_return,
        "days_to_expiration": data.days_to_expiration or 30,
        "warnings": warnings
    }


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/desk", response_model=DeskScanResponse)
async def scan_0dte(request: ScanRequest):
    """
    Run 0-DTE scan using The Desk methodology.
    Includes macro validation and event checking.
    """
    # Get 0-DTE event horizon
    event_horizon = event_0dte_service.get_event_horizon()
    
    # Get market snapshot for macro context
    try:
        market_snapshot = await market_data_service.get_market_snapshot(request.ticker)
    except:
        market_snapshot = None
    
    # Run technical analysis
    technical = analyze_desk_signal(request)
    
    # Apply macro validation
    macro_adjustment = event_horizon.macro_adjustment
    macro_override = event_horizon.has_binary_event
    
    # Adjust for sector underperformance
    if market_snapshot and market_snapshot.get("sector"):
        sector = market_snapshot["sector"]
        if sector.get("flow_direction") == "outflow":
            macro_adjustment -= 10
            technical["warnings"].append(f"Sector ({sector['sector_etf']}) underperforming")
    
    # Final confidence
    final_confidence = max(0, min(100, technical["confidence"] + macro_adjustment))
    
    # Override status if macro blocks
    final_status = technical["status"]
    if macro_override:
        final_status = "no_trade"
        technical["warnings"].insert(0, f"⚠️ {event_horizon.event_override}")
    elif final_confidence < 30:
        final_status = "no_trade"
    elif final_confidence < 50 and final_status == "green_light":
        final_status = "caution"
    
    # Build macro context
    vix_data = market_snapshot.get("vix", {}) if market_snapshot else {}
    macro_context = {
        "events": [e.dict() for e in event_horizon.events],
        "has_binary_event": event_horizon.has_binary_event,
        "event_override": event_horizon.event_override,
        "vix_level": vix_data.get("vix", 18),
        "vix_regime": vix_data.get("regime", "elevated"),
        "market_trend": market_snapshot.get("spy", {}).get("trend", "neutral") if market_snapshot else "neutral",
        "sector": market_snapshot.get("sector") if market_snapshot else None,
        "macro_adjustment": macro_adjustment,
        "macro_warnings": event_horizon.warnings,
        "macro_status": "high_risk" if macro_override else "caution" if macro_adjustment < -15 else "clear"
    }
    
    return DeskScanResponse(
        ticker=request.ticker,
        status=final_status,
        status_reason=technical["status_reason"] if not macro_override else event_horizon.event_override,
        final_confidence=final_confidence,
        macro_override=macro_override,
        regime=technical["regime"],
        regime_description=technical["regime_description"],
        direction=technical["direction"],
        structural_thesis=technical["structural_thesis"],
        structure=technical["structure"],
        strikes=technical["strikes"],
        entry_zone=technical["entry_zone"],
        profit_target=technical["profit_target"],
        invalidation_level=technical["invalidation_level"],
        invalidation_reason=technical["invalidation_reason"],
        hold_time=technical["hold_time"],
        fakeout_risk=technical["fakeout_risk"],
        warnings=technical["warnings"],
        macro=macro_context
    )


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
        "events": [],
        "has_binary_event": False,
        "event_override": None,
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
    # Get 0-DTE events
    event_horizon = event_0dte_service.get_event_horizon()
    
    # Get market snapshot
    try:
        market_snapshot = await market_data_service.get_market_snapshot(ticker)
    except Exception as e:
        market_snapshot = {"error": str(e)}
    
    vix_data = market_snapshot.get("vix", {}) if isinstance(market_snapshot, dict) else {}
    
    macro_adjustment = event_horizon.macro_adjustment
    if market_snapshot and market_snapshot.get("sector", {}).get("flow_direction") == "outflow":
        macro_adjustment -= 10
    
    return MacroContextResponse(
        events=[e.dict() for e in event_horizon.events],
        has_binary_event=event_horizon.has_binary_event,
        event_override=event_horizon.event_override,
        vix_level=vix_data.get("vix", 18),
        vix_regime=vix_data.get("regime", "elevated"),
        market_trend=market_snapshot.get("spy", {}).get("trend", "neutral") if isinstance(market_snapshot, dict) else "neutral",
        sector=market_snapshot.get("sector") if isinstance(market_snapshot, dict) else None,
        macro_adjustment=macro_adjustment,
        macro_warnings=event_horizon.warnings,
        macro_status="high_risk" if event_horizon.has_binary_event else "caution" if macro_adjustment < -15 else "clear"
    )


@router.get("/events/0dte")
async def get_0dte_events():
    """Get 0-DTE event horizon."""
    horizon = event_0dte_service.get_event_horizon()
    return {
        "events": [e.dict() for e in horizon.events],
        "has_binary_event": horizon.has_binary_event,
        "event_override": horizon.event_override,
        "config": event_0dte_service.get_config()
    }


@router.post("/events/blackout")
async def update_blackout_dates(dates: List[Dict[str, str]]):
    """Update blackout dates (Sunday Ritual)."""
    event_0dte_service.update_blackout_dates(dates)
    return {"status": "updated", "dates": dates}
