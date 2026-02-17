"""
IPMCC Commander - Enhanced Scanner Router
Comprehensive strategy scanning with full guide rule validation.

Endpoints:
- /api/v1/scanner/enhanced/ipmcc - Full IPMCC scan with trade setups
- /api/v1/scanner/enhanced/112 - Full 112 Trade scan with setups
- /api/v1/scanner/enhanced/strangles - Full Strangle scan with setups
- /api/v1/scanner/enhanced/watchlists - Available watchlists
- /api/v1/scanner/enhanced/single/{strategy}/{symbol} - Single symbol analysis
"""

from fastapi import APIRouter, Query, HTTPException
from typing import Optional, List
from datetime import datetime
import logging

from app.services.enhanced_scanner_service import enhanced_scanner_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/scanner/enhanced", tags=["Enhanced Scanner"])


@router.get("/ipmcc")
async def scan_ipmcc(
    symbols: Optional[str] = Query(
        None, 
        description="Comma-separated symbols (e.g., 'AAPL,MSFT,GOOGL'). Leave empty for default quality stocks."
    ),
    min_score: int = Query(50, ge=0, le=100, description="Minimum score threshold (0-100)")
):
    """
    Scan for IPMCC (Income Poor Man's Covered Call) setups.
    
    Validates ALL guide rules:
    - Weekly uptrend (21 EMA > 50 EMA > 200 EMA)
    - RSI < 50 or reversing from oversold
    - Price at support level
    - LEAP: 70-90 delta, 180+ DTE
    - Short: ATM, 7 DTE (3-14 acceptable)
    - No earnings before short expiration
    - Income Velocity target: 1.5-2.5% weekly
    
    Returns actionable trade setups with specific strikes and premiums.
    """
    try:
        symbol_list = None
        if symbols:
            symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
        
        results = await enhanced_scanner_service.scan_ipmcc(symbol_list)
        
        # Filter by min_score
        if min_score > 0:
            results["results"] = [r for r in results["results"] if r.get("score", 0) >= min_score]
            results["matches_found"] = len(results["results"])
        
        return results
        
    except Exception as e:
        logger.error(f"IPMCC scan error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/112")
async def scan_112_trade(
    symbols: Optional[str] = Query(
        None,
        description="Comma-separated symbols. Leave empty for default high-IV stocks."
    ),
    min_score: int = Query(50, ge=0, le=100, description="Minimum score threshold")
):
    """
    Scan for 112 Trade (1:1:2 Put Ratio Spread) setups.
    
    Validates guide rules:
    - Elevated IV (>35% ideal)
    - 14-17 DTE options available
    - Clear support levels
    - RSI > 30 (not oversold)
    - No earnings before expiration
    - Price > $20 for decent spreads
    
    Returns complete 1:1:2 structure with strikes and expected P&L.
    """
    try:
        symbol_list = None
        if symbols:
            symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
        
        results = await enhanced_scanner_service.scan_112_trade(symbol_list)
        
        if min_score > 0:
            results["results"] = [r for r in results["results"] if r.get("score", 0) >= min_score]
            results["matches_found"] = len(results["results"])
        
        return results
        
    except Exception as e:
        logger.error(f"112 Trade scan error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/strangles")
async def scan_strangles(
    symbols: Optional[str] = Query(
        None,
        description="Comma-separated symbols. Leave empty for default liquid ETFs."
    ),
    min_score: int = Query(50, ge=0, le=100, description="Minimum score threshold")
):
    """
    Scan for Short Strangle setups.
    
    Validates guide rules:
    - High IV (>30%)
    - Neutral RSI (40-60)
    - 30-45 DTE available
    - Range-bound price action
    - No earnings before expiration
    
    Returns strangle setup with 15-30 delta options on each side.
    """
    try:
        symbol_list = None
        if symbols:
            symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
        
        results = await enhanced_scanner_service.scan_strangles(symbol_list)
        
        if min_score > 0:
            results["results"] = [r for r in results["results"] if r.get("score", 0) >= min_score]
            results["matches_found"] = len(results["results"])
        
        return results
        
    except Exception as e:
        logger.error(f"Strangle scan error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/single/ipmcc/{symbol}")
async def analyze_single_ipmcc(symbol: str):
    """
    Analyze a single symbol for IPMCC setup.
    
    Returns detailed analysis with:
    - All rule checks with pass/fail
    - Technical analysis (EMA, RSI, support/resistance)
    - IV metrics
    - Earnings check
    - Recommended trade setup with specific strikes
    - Income Velocity calculation
    """
    try:
        symbol = symbol.upper().strip()
        result = await enhanced_scanner_service._analyze_ipmcc_setup(symbol)
        
        if not result:
            raise HTTPException(
                status_code=404, 
                detail=f"Could not analyze {symbol}. Check if symbol is valid and has options."
            )
        
        return {
            "symbol": symbol,
            "strategy": "IPMCC",
            "analysis": result,
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Single IPMCC analysis error for {symbol}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/single/112/{symbol}")
async def analyze_single_112(symbol: str):
    """
    Analyze a single symbol for 112 Trade setup.
    """
    try:
        symbol = symbol.upper().strip()
        result = await enhanced_scanner_service._analyze_112_setup(symbol)
        
        if not result:
            raise HTTPException(
                status_code=404,
                detail=f"Could not analyze {symbol}. Check if symbol is valid and has options."
            )
        
        return {
            "symbol": symbol,
            "strategy": "112_Trade",
            "analysis": result,
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Single 112 analysis error for {symbol}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/single/strangle/{symbol}")
async def analyze_single_strangle(symbol: str):
    """
    Analyze a single symbol for Strangle setup.
    """
    try:
        symbol = symbol.upper().strip()
        result = await enhanced_scanner_service._analyze_strangle_setup(symbol)
        
        if not result:
            raise HTTPException(
                status_code=404,
                detail=f"Could not analyze {symbol}. Check if symbol is valid and has options."
            )
        
        return {
            "symbol": symbol,
            "strategy": "Strangle",
            "analysis": result,
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Single strangle analysis error for {symbol}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/watchlists")
async def get_watchlists():
    """
    Get available watchlists for scanning.
    
    Returns:
    - quality_stocks: High-quality stocks suitable for IPMCC
    - high_iv: High volatility stocks good for 112 trades
    - liquid_etfs: Liquid ETFs good for strangles
    """
    return {
        "watchlists": enhanced_scanner_service.get_watchlists(),
        "descriptions": {
            "quality_stocks": "High-quality, stable growth stocks ideal for IPMCC strategy",
            "high_iv": "High volatility stocks with elevated IV - good for 112 trades",
            "liquid_etfs": "Liquid ETFs with tight spreads - ideal for strangles",
            "all": "Combined list of all symbols"
        }
    }


@router.get("/rules")
async def get_strategy_rules():
    """
    Get the strategy rules being validated by the scanner.
    
    This documents exactly what criteria the scanner checks for each strategy.
    """
    return {
        "IPMCC": {
            "name": "Income Poor Man's Covered Call",
            "entry_criteria": [
                {"rule": "Weekly Uptrend", "description": "21 EMA > 50 EMA > 200 EMA", "weight": 25},
                {"rule": "RSI Entry", "description": "RSI < 50 or reversing from oversold", "weight": 15},
                {"rule": "Support Proximity", "description": "Price near support level (within 3%)", "weight": 15},
                {"rule": "IV Level", "description": "IV >= 20% for adequate premium", "weight": 10},
                {"rule": "Earnings Safety", "description": "No earnings within 21 days", "weight": 10},
                {"rule": "Income Velocity", "description": "Weekly extrinsic >= 1.5% of capital", "weight": 25},
            ],
            "leap_requirements": {
                "delta": "70-90 (prefer 80)",
                "dte": "180+ days (LEAP)",
            },
            "short_requirements": {
                "strike": "ATM or slightly ITM",
                "dte": "7 days (3-14 acceptable)",
            },
            "targets": {
                "income_velocity": "1.5-2.5% weekly",
                "weeks_to_breakeven": "< 30 weeks ideal",
            }
        },
        "112_Trade": {
            "name": "1:1:2 Put Ratio Spread",
            "entry_criteria": [
                {"rule": "High IV", "description": "IV >= 35% (45%+ ideal)", "weight": 30},
                {"rule": "RSI > 30", "description": "Not oversold", "weight": 15},
                {"rule": "Support Levels", "description": "Clear support identified", "weight": 20},
                {"rule": "No Earnings", "description": "No earnings before expiration", "weight": 15},
                {"rule": "Price >= $20", "description": "Adequate for spread widths", "weight": 5},
                {"rule": "Net Credit", "description": "Trade should be net credit", "weight": 15},
            ],
            "structure": {
                "long_put": "1 ATM or slightly OTM put",
                "short_put_1": "1 put at 5-10% OTM (at support)",
                "short_put_2": "2 puts at 10-15% OTM (at stronger support)",
            },
            "dte": "14-17 days ideal",
        },
        "Strangles": {
            "name": "Short Strangle",
            "entry_criteria": [
                {"rule": "High IV", "description": "IV >= 30% (40%+ ideal)", "weight": 30},
                {"rule": "Neutral RSI", "description": "RSI 40-60", "weight": 25},
                {"rule": "Neutral Trend", "description": "Range-bound price action", "weight": 15},
                {"rule": "No Earnings", "description": "No earnings within 45 days", "weight": 15},
                {"rule": "Premium Target", "description": "Total credit >= 1% of underlying", "weight": 15},
            ],
            "structure": {
                "short_put": "15-30 delta OTM put",
                "short_call": "15-30 delta OTM call",
            },
            "dte": "30-45 days",
            "management": {
                "profit_target": "50% of max profit",
                "close_at": "21 DTE regardless",
            }
        }
    }


@router.get("/health")
async def scanner_health():
    """Check scanner health and data source availability."""
    from app.services.schwab_service import schwab_service
    
    schwab_authenticated = schwab_service.is_authenticated()
    schwab_expiry = schwab_service.get_token_expiry()
    
    return {
        "status": "healthy",
        "data_sources": {
            "schwab": {
                "available": schwab_authenticated,
                "token_expiry": schwab_expiry.isoformat() if schwab_expiry else None,
                "note": "Primary source for live options data with Greeks"
            },
            "yfinance": {
                "available": True,
                "note": "Fallback for historical data and basic options"
            }
        },
        "recommendation": "Schwab API provides better data (real-time Greeks)" if not schwab_authenticated else "All systems operational",
        "timestamp": datetime.now().isoformat()
    }
