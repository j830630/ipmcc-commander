"""
IPMCC Commander - Market Data & Sentiment Router
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from datetime import date, timedelta

from app.services.sentiment_service import sentiment_service
from app.services.calendar_service import calendar_service
from app.services.scanner_service import scanner_service

router = APIRouter(prefix="/api/v1", tags=["Market Data"])


# ============ SENTIMENT ENDPOINTS ============

@router.get("/sentiment/fear-greed")
async def get_fear_greed():
    """Get CNN Fear & Greed Index."""
    return await sentiment_service.get_fear_greed_index()


@router.get("/sentiment/vix")
async def get_vix():
    """Get VIX (CBOE Volatility Index)."""
    return sentiment_service.get_vix()


@router.get("/sentiment/forex/{pair}")
async def get_forex(pair: str):
    """
    Get forex pair data.
    Pairs: AUDJPY, AUDUSD, DXY
    """
    pair_map = {
        "AUDJPY": "AUDJPY=X",
        "AUDUSD": "AUDUSD=X",
        "DXY": "DX-Y.NYB",
        "USDJPY": "USDJPY=X",
        "EURUSD": "EURUSD=X",
        "GBPUSD": "GBPUSD=X"
    }
    
    yahoo_pair = pair_map.get(pair.upper())
    if not yahoo_pair:
        raise HTTPException(status_code=400, detail=f"Unknown pair: {pair}")
    
    return sentiment_service.get_forex_pair(yahoo_pair)


@router.get("/sentiment/indices")
async def get_indices():
    """Get major market indices (SPY, QQQ, DIA, IWM)."""
    return sentiment_service.get_market_indices()


@router.get("/sentiment/all")
async def get_all_sentiment():
    """Get all market sentiment indicators in one call."""
    return await sentiment_service.get_all_sentiment()


# ============ ECONOMIC CALENDAR ENDPOINTS ============

@router.get("/calendar/events")
async def get_economic_events(
    from_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    country: Optional[str] = Query(None, description="Filter by country (US, EU, GB, JP, AU)")
):
    """Get economic calendar events."""
    return await calendar_service.get_economic_calendar(
        from_date=from_date,
        to_date=to_date,
        country=country
    )


@router.get("/calendar/today")
async def get_todays_events(
    country: Optional[str] = Query(None, description="Filter by country")
):
    """Get today's economic events."""
    return await calendar_service.get_todays_events(country=country)


@router.get("/calendar/high-impact")
async def get_high_impact_events(
    days: int = Query(7, ge=1, le=30, description="Number of days to look ahead")
):
    """Get high-impact economic events for the next N days."""
    return await calendar_service.get_high_impact_events(days=days)


@router.get("/calendar/important-events")
async def get_important_events():
    """Get list of important recurring economic events to watch."""
    return calendar_service.get_important_events_today()


# ============ SCANNER ENDPOINTS ============

@router.get("/scanner/ipmcc")
async def scan_ipmcc(
    symbols: Optional[str] = Query(None, description="Comma-separated symbols to scan")
):
    """
    Scan for IPMCC (Income Poor Man's Covered Call) setups.
    Leave symbols empty to use default large-cap watchlist.
    """
    symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()] if symbols else None
    return scanner_service.scan_for_ipmcc(symbol_list)


@router.get("/scanner/112-trade")
async def scan_112_trade(
    symbols: Optional[str] = Query(None, description="Comma-separated symbols to scan")
):
    """
    Scan for 112 Trade setups (1 Put Debit Spread + 2 Naked Puts).
    Leave symbols empty to use default high-IV watchlist.
    """
    symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()] if symbols else None
    return scanner_service.scan_for_112_trade(symbol_list)


@router.get("/scanner/strangles")
async def scan_strangles(
    symbols: Optional[str] = Query(None, description="Comma-separated symbols to scan")
):
    """
    Scan for Short Strangle setups.
    Leave symbols empty to use default ETF watchlist.
    """
    symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()] if symbols else None
    return scanner_service.scan_for_strangles(symbol_list)


@router.get("/scanner/watchlists")
async def get_watchlists():
    """Get available scanner watchlists."""
    return scanner_service.get_watchlists()
