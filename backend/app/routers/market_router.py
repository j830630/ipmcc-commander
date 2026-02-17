"""
IPMCC Commander - Market Data Router
Provides endpoints for:
- /market/quote/{ticker} - Real-time quotes
- /market/iv/{ticker} - IV Rank, IV Percentile, HV
- /market/sector/{ticker} - Sector relative strength
- /market/vix - VIX data with regime
- /earnings/{ticker} - Earnings dates and days until
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# RESPONSE MODELS
# ============================================================================

class QuoteResponse(BaseModel):
    """Stock quote response."""
    ticker: str
    price: float
    change: float
    change_pct: float = Field(alias="changePct")
    high: Optional[float] = None
    low: Optional[float] = None
    open: Optional[float] = None
    volume: Optional[int] = None
    bid: Optional[float] = None
    ask: Optional[float] = None
    timestamp: str
    
    class Config:
        populate_by_name = True


class IVResponse(BaseModel):
    """IV analytics response."""
    ticker: str
    iv_rank: Optional[int] = Field(None, alias="ivRank", description="IV Rank 0-100")
    iv_percentile: Optional[int] = Field(None, alias="ivPercentile", description="IV Percentile 0-100")
    current_iv: Optional[float] = Field(None, alias="currentIV", description="Current ATM IV %")
    iv_52w_high: Optional[float] = Field(None, alias="iv52wHigh")
    iv_52w_low: Optional[float] = Field(None, alias="iv52wLow")
    hv_20: Optional[float] = Field(None, alias="hv20", description="20-day historical volatility")
    hv_50: Optional[float] = Field(None, alias="hv50", description="50-day historical volatility")
    iv_hv_ratio: Optional[float] = Field(None, alias="ivHvRatio")
    iv_term_structure: Optional[str] = Field(None, alias="ivTermStructure")
    data_source: str = Field(alias="dataSource")
    timestamp: str
    
    class Config:
        populate_by_name = True


class SectorResponse(BaseModel):
    """Sector analysis response."""
    ticker: str
    sector: str
    sector_etf: str = Field(alias="sectorEtf")
    relative_strength: float = Field(alias="relativeStrength", description="RS vs SPY, >1 = outperforming")
    sector_change_pct: float = Field(alias="sectorChangePct")
    spy_change_pct: float = Field(alias="spyChangePct")
    flow_direction: str = Field(alias="flowDirection", description="inflow, outflow, or neutral")
    timestamp: str
    
    class Config:
        populate_by_name = True


class VIXResponse(BaseModel):
    """VIX data response."""
    vix: float
    vix_change: float = Field(alias="vixChange")
    vix_change_pct: float = Field(alias="vixChangePct")
    regime: str = Field(description="low, elevated, high, or extreme")
    timestamp: str
    
    class Config:
        populate_by_name = True


class EarningsResponse(BaseModel):
    """Earnings data response."""
    ticker: str
    earnings_date: Optional[str] = Field(None, alias="earningsDate")
    days_until: Optional[int] = Field(None, alias="daysUntil")
    earnings_time: Optional[str] = Field(None, alias="earningsTime", description="before_market, after_market, or unknown")
    is_confirmed: bool = Field(alias="isConfirmed")
    data_source: str = Field(alias="dataSource")
    timestamp: str
    
    class Config:
        populate_by_name = True


# ============================================================================
# SERVICE IMPORTS (lazy to avoid circular imports)
# ============================================================================

def get_market_service():
    """Get market data service instance."""
    from app.services.market_data_service import market_data_service
    return market_data_service


def get_iv_service():
    """Get IV analytics service instance."""
    try:
        from app.services.iv_analytics_service import iv_analytics_service
        return iv_analytics_service
    except ImportError:
        return None


def get_earnings_service():
    """Get earnings service instance."""
    try:
        from app.services.earnings_service_v2 import earnings_service
        return earnings_service
    except ImportError:
        try:
            from app.services.earnings_service import earnings_service
            return earnings_service
        except ImportError:
            return None


# ============================================================================
# QUOTE ENDPOINT
# ============================================================================

@router.get("/quote/{ticker}", response_model=QuoteResponse)
async def get_quote(ticker: str):
    """
    Get real-time quote for a ticker.
    
    Returns price, change, change %, high, low, volume.
    """
    ticker = ticker.upper()
    service = get_market_service()
    
    try:
        quote = await service.get_quote(ticker)
        
        if not quote:
            # Return minimal data with price=0 instead of 404
            # This allows the scanner to continue with other tickers
            return QuoteResponse(
                ticker=ticker,
                price=0,
                change=0,
                change_pct=0,
                timestamp=datetime.now().isoformat()
            )
        
        return QuoteResponse(
            ticker=ticker,
            price=quote.get("price", 0),
            change=quote.get("change", 0),
            change_pct=quote.get("change_pct", 0),
            high=quote.get("high"),
            low=quote.get("low"),
            open=quote.get("open"),
            volume=quote.get("volume"),
            bid=quote.get("bid"),
            ask=quote.get("ask"),
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Error fetching quote for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# IV ENDPOINT
# ============================================================================

@router.get("/iv/{ticker}", response_model=IVResponse)
async def get_iv_metrics(ticker: str):
    """
    Get IV Rank, IV Percentile, and historical volatility metrics.
    
    - **iv_rank**: Current IV position relative to 52-week range (0-100)
    - **iv_percentile**: % of days in past year with lower IV (0-100)
    - **hv_20**: 20-day historical volatility
    - **hv_50**: 50-day historical volatility
    """
    ticker = ticker.upper()
    
    # Try IV analytics service first
    iv_service = get_iv_service()
    
    if iv_service:
        try:
            metrics = await iv_service.get_iv_metrics(ticker)
            
            return IVResponse(
                ticker=ticker,
                iv_rank=metrics.get("iv_rank"),
                iv_percentile=metrics.get("iv_percentile"),
                current_iv=metrics.get("current_iv"),
                iv_52w_high=metrics.get("iv_52w_high"),
                iv_52w_low=metrics.get("iv_52w_low"),
                hv_20=metrics.get("hv_20"),
                hv_50=metrics.get("hv_50"),
                iv_hv_ratio=metrics.get("iv_hv_ratio"),
                iv_term_structure=metrics.get("iv_term_structure"),
                data_source=metrics.get("data_source", "iv_analytics_service"),
                timestamp=datetime.now().isoformat()
            )
            
        except Exception as e:
            logger.error(f"IV service error for {ticker}: {e}")
    
    # Fallback: try market data service
    market_service = get_market_service()
    
    try:
        iv_data = await market_service.get_iv_rank(ticker)
        
        return IVResponse(
            ticker=ticker,
            iv_rank=iv_data.get("iv_rank"),
            iv_percentile=iv_data.get("iv_percentile"),
            current_iv=iv_data.get("current_iv"),
            iv_52w_high=iv_data.get("iv_52w_high"),
            iv_52w_low=iv_data.get("iv_52w_low"),
            hv_20=iv_data.get("hv_20"),
            hv_50=iv_data.get("hv_50"),
            iv_hv_ratio=iv_data.get("iv_hv_ratio"),
            iv_term_structure=iv_data.get("iv_term_structure"),
            data_source=iv_data.get("source", "market_data_service"),
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Error fetching IV for {ticker}: {e}")
        # Return empty response instead of error - let scanner handle missing data
        return IVResponse(
            ticker=ticker,
            iv_rank=None,
            iv_percentile=None,
            current_iv=None,
            iv_52w_high=None,
            iv_52w_low=None,
            hv_20=None,
            hv_50=None,
            iv_hv_ratio=None,
            iv_term_structure=None,
            data_source="unavailable",
            timestamp=datetime.now().isoformat()
        )


# ============================================================================
# SECTOR ENDPOINT
# ============================================================================

@router.get("/sector/{ticker}", response_model=SectorResponse)
async def get_sector_analysis(ticker: str):
    """
    Get sector relative strength analysis.
    
    Compares the ticker's sector ETF performance to SPY.
    - **relative_strength > 1.0**: Sector outperforming
    - **relative_strength < 1.0**: Sector underperforming
    """
    ticker = ticker.upper()
    market_service = get_market_service()
    
    try:
        sector_data = await market_service.get_sector_analysis(ticker)
        
        if not sector_data:
            # Return default neutral data
            return SectorResponse(
                ticker=ticker,
                sector="Unknown",
                sector_etf="SPY",
                relative_strength=1.0,
                sector_change_pct=0.0,
                spy_change_pct=0.0,
                flow_direction="neutral",
                timestamp=datetime.now().isoformat()
            )
        
        return SectorResponse(
            ticker=ticker,
            sector=sector_data.get("sector_name", "Unknown"),
            sector_etf=sector_data.get("sector_etf", "SPY"),
            relative_strength=sector_data.get("relative_strength", 1.0),
            sector_change_pct=sector_data.get("sector_change_pct", 0.0),
            spy_change_pct=sector_data.get("spy_change_pct", 0.0),
            flow_direction=sector_data.get("flow_direction", "neutral"),
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Error fetching sector data for {ticker}: {e}")
        # Return neutral defaults
        return SectorResponse(
            ticker=ticker,
            sector="Unknown",
            sector_etf="SPY",
            relative_strength=1.0,
            sector_change_pct=0.0,
            spy_change_pct=0.0,
            flow_direction="neutral",
            timestamp=datetime.now().isoformat()
        )


# ============================================================================
# VIX ENDPOINT
# ============================================================================

@router.get("/vix", response_model=VIXResponse)
async def get_vix():
    """
    Get current VIX level and regime classification.
    
    Regimes:
    - **low**: VIX < 15 (complacent)
    - **elevated**: VIX 15-20 (normal)
    - **high**: VIX 20-30 (elevated fear)
    - **extreme**: VIX > 30 (panic)
    """
    market_service = get_market_service()
    
    try:
        vix_data = await market_service.get_vix()
        
        return VIXResponse(
            vix=vix_data.get("vix", 18.0),
            vix_change=vix_data.get("vix_change", 0),
            vix_change_pct=vix_data.get("vix_change_pct", 0),
            regime=vix_data.get("regime", "elevated"),
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Error fetching VIX: {e}")
        # Return default
        return VIXResponse(
            vix=18.0,
            vix_change=0,
            vix_change_pct=0,
            regime="elevated",
            timestamp=datetime.now().isoformat()
        )


# ============================================================================
# EARNINGS ENDPOINT
# ============================================================================

@router.get("/earnings/{ticker}", response_model=EarningsResponse)
async def get_earnings(ticker: str):
    """
    Get earnings date information for a ticker.
    
    Returns next earnings date and days until.
    Critical for options trading - avoid selling premium through earnings.
    """
    ticker = ticker.upper()
    
    earnings_svc = get_earnings_service()
    
    if earnings_svc:
        try:
            earnings_data = await earnings_svc.get_earnings_info(ticker)
            
            return EarningsResponse(
                ticker=ticker,
                earnings_date=earnings_data.get("next_earnings_date"),
                days_until=earnings_data.get("days_until"),
                earnings_time=earnings_data.get("earnings_time"),
                is_confirmed=earnings_data.get("is_confirmed", False),
                data_source=earnings_data.get("data_source", "earnings_service"),
                timestamp=datetime.now().isoformat()
            )
            
        except Exception as e:
            logger.error(f"Earnings service error for {ticker}: {e}")
    
    # Return unknown if service unavailable
    return EarningsResponse(
        ticker=ticker,
        earnings_date=None,
        days_until=None,
        earnings_time=None,
        is_confirmed=False,
        data_source="unavailable",
        timestamp=datetime.now().isoformat()
    )


# ============================================================================
# BULK ENDPOINTS
# ============================================================================

@router.get("/quotes")
async def get_quotes(tickers: str = Query(..., description="Comma-separated tickers")):
    """
    Get quotes for multiple tickers.
    
    Example: /market/quotes?tickers=AAPL,MSFT,NVDA
    """
    ticker_list = [t.strip().upper() for t in tickers.split(",")]
    market_service = get_market_service()
    
    quotes = await market_service.get_quotes(ticker_list)
    
    return {
        "quotes": quotes,
        "timestamp": datetime.now().isoformat()
    }


@router.get("/snapshot/{ticker}")
async def get_market_snapshot(ticker: str):
    """
    Get comprehensive market snapshot for a ticker.
    
    Includes quote, VIX, SPY data, and sector analysis.
    """
    ticker = ticker.upper()
    market_service = get_market_service()
    
    try:
        snapshot = await market_service.get_market_snapshot(ticker)
        return snapshot
    except Exception as e:
        logger.error(f"Error fetching snapshot for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/earnings/calendar")
async def get_earnings_calendar(
    tickers: str = Query(..., description="Comma-separated tickers"),
    days: int = Query(30, description="Days ahead to check")
):
    """
    Get earnings calendar for multiple tickers.
    
    Returns tickers with upcoming earnings within the specified days.
    """
    ticker_list = [t.strip().upper() for t in tickers.split(",")]
    
    earnings_svc = get_earnings_service()
    
    if not earnings_svc:
        return {"calendar": [], "error": "Earnings service unavailable"}
    
    try:
        calendar = await earnings_svc.get_earnings_calendar(ticker_list, days)
        return {
            "calendar": calendar,
            "days_ahead": days,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error fetching earnings calendar: {e}")
        return {"calendar": [], "error": str(e)}
