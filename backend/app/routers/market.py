"""
IPMCC Commander - Market Data Router
Stock quotes, options chains, and technical indicators
"""

from fastapi import APIRouter, Query
from typing import Optional

from app.services.market_data import market_data

router = APIRouter()


@router.get("/quote/{ticker}")
async def get_quote(ticker: str):
    """
    Get current stock quote.
    
    Data is delayed 15-20 minutes (Yahoo Finance).
    """
    return market_data.get_quote(ticker.upper())


@router.get("/chain/{ticker}")
async def get_options_chain(
    ticker: str,
    expiration: Optional[str] = Query(None, description="Expiration date (YYYY-MM-DD)")
):
    """
    Get options chain for a ticker.
    
    If expiration is not specified, returns the nearest expiration.
    """
    return market_data.get_options_chain(ticker.upper(), expiration)


@router.get("/expirations/{ticker}")
async def get_expirations(ticker: str):
    """Get available options expiration dates."""
    expirations = market_data.get_options_expirations(ticker.upper())
    return {
        "ticker": ticker.upper(),
        "expirations": expirations,
        "count": len(expirations)
    }


@router.get("/history/{ticker}")
async def get_history(
    ticker: str,
    period: str = Query("1y", description="Period: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, max")
):
    """
    Get historical price data for charts.
    
    Returns OHLCV data for the specified period.
    """
    data = market_data.get_historical_data(ticker.upper(), period)
    return {
        "ticker": ticker.upper(),
        "period": period,
        "data_points": len(data),
        "data": data
    }


@router.get("/technicals/{ticker}")
async def get_technicals(ticker: str):
    """
    Get technical indicators for entry analysis.
    
    Returns:
    - RSI (14-period)
    - EMAs (21, 50, 200)
    - Bollinger Bands
    - Trend assessment
    """
    return market_data.get_technical_indicators(ticker.upper())


@router.get("/leaps/{ticker}")
async def get_leap_options(ticker: str):
    """
    Get LEAP-eligible options (expirations > 180 days).
    
    Filters to show only long-dated expirations suitable for IPMCC.
    """
    from datetime import date, timedelta
    
    expirations = market_data.get_options_expirations(ticker.upper())
    quote = market_data.get_quote(ticker.upper())
    
    min_date = date.today() + timedelta(days=180)
    
    leap_expirations = [
        exp for exp in expirations
        if date.fromisoformat(exp) >= min_date
    ]
    
    # Get chain for first LEAP expiration to show available strikes
    leap_chain = None
    if leap_expirations:
        leap_chain = market_data.get_options_chain(ticker.upper(), leap_expirations[0])
    
    return {
        "ticker": ticker.upper(),
        "current_price": quote.get("price"),
        "leap_expirations": leap_expirations,
        "sample_chain": leap_chain
    }


@router.get("/weekly/{ticker}")
async def get_weekly_options(ticker: str):
    """
    Get weekly options (expirations <= 14 days).
    
    Filters to show only short-dated expirations for short calls.
    """
    from datetime import date, timedelta
    
    expirations = market_data.get_options_expirations(ticker.upper())
    quote = market_data.get_quote(ticker.upper())
    
    max_date = date.today() + timedelta(days=14)
    
    weekly_expirations = [
        exp for exp in expirations
        if date.fromisoformat(exp) <= max_date
    ]
    
    # Get chain for first weekly expiration
    weekly_chain = None
    if weekly_expirations:
        weekly_chain = market_data.get_options_chain(ticker.upper(), weekly_expirations[0])
    
    return {
        "ticker": ticker.upper(),
        "current_price": quote.get("price"),
        "weekly_expirations": weekly_expirations,
        "sample_chain": weekly_chain
    }


@router.post("/refresh-cache")
async def refresh_cache():
    """Clear the market data cache to force fresh data."""
    market_data.clear_cache()
    return {"success": True, "message": "Cache cleared"}
