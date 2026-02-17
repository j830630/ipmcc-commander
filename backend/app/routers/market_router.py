"""
IPMCC Commander - Market Data Router
Uses Schwab API for real-time data with yfinance fallback.

Endpoints:
- /market/quote/{ticker} - Real-time quotes
- /market/iv/{ticker} - IV Rank and volatility metrics
- /market/sector/{ticker} - Sector relative strength
- /market/vix - VIX data
- /market/status - Check data source availability
"""

from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# RESPONSE MODELS
# ============================================================================

class QuoteResponse(BaseModel):
    ticker: str
    price: Optional[float] = None
    change: Optional[float] = None
    change_pct: Optional[float] = Field(None, alias="changePct")
    volume: Optional[int] = None
    bid: Optional[float] = None
    ask: Optional[float] = None
    data_source: str = Field(alias="dataSource")
    error: Optional[str] = None
    timestamp: str
    
    class Config:
        populate_by_name = True


class IVResponse(BaseModel):
    ticker: str
    iv_rank: Optional[int] = Field(None, alias="ivRank")
    iv_percentile: Optional[int] = Field(None, alias="ivPercentile")
    current_iv: Optional[float] = Field(None, alias="currentIV")
    hv_20: Optional[float] = Field(None, alias="hv20")
    data_source: str = Field(alias="dataSource")
    error: Optional[str] = None
    timestamp: str
    
    class Config:
        populate_by_name = True


class SectorResponse(BaseModel):
    ticker: str
    sector: str
    sector_etf: str = Field(alias="sectorEtf")
    relative_strength: Optional[float] = Field(None, alias="relativeStrength")
    sector_change_pct: Optional[float] = Field(None, alias="sectorChangePct")
    spy_change_pct: Optional[float] = Field(None, alias="spyChangePct")
    flow_direction: Optional[str] = Field(None, alias="flowDirection")
    data_source: str = Field(alias="dataSource")
    error: Optional[str] = None
    timestamp: str
    
    class Config:
        populate_by_name = True


class VIXResponse(BaseModel):
    vix: Optional[float] = None
    vix_change: Optional[float] = Field(None, alias="vixChange")
    regime: Optional[str] = None
    data_source: str = Field(alias="dataSource")
    error: Optional[str] = None
    timestamp: str
    
    class Config:
        populate_by_name = True


class EarningsResponse(BaseModel):
    ticker: str
    earnings_date: Optional[str] = Field(None, alias="earningsDate")
    days_until: Optional[int] = Field(None, alias="daysUntil")
    is_confirmed: bool = Field(False, alias="isConfirmed")
    data_source: str = Field(alias="dataSource")
    error: Optional[str] = None
    timestamp: str
    
    class Config:
        populate_by_name = True


class DataStatusResponse(BaseModel):
    schwab_authenticated: bool = Field(alias="schwabAuthenticated")
    schwab_status: str = Field(alias="schwabStatus")
    yfinance_available: bool = Field(alias="yfinanceAvailable")
    primary_source: str = Field(alias="primarySource")
    message: str
    timestamp: str
    
    class Config:
        populate_by_name = True


# ============================================================================
# SECTOR MAPPING
# ============================================================================

SECTOR_ETF_MAP = {
    # Technology
    "AAPL": "XLK", "MSFT": "XLK", "NVDA": "XLK", "AVGO": "XLK", "AMD": "XLK",
    "INTC": "XLK", "CRM": "XLK", "ORCL": "XLK", "ADBE": "XLK", "CSCO": "XLK",
    "QCOM": "XLK", "IBM": "XLK", "NOW": "XLK", "INTU": "XLK", "PLTR": "XLK",
    "SNOW": "XLK", "CRWD": "XLK", "PANW": "XLK", "DDOG": "XLK", "ZS": "XLK",
    "NET": "XLK", "SHOP": "XLK", "SQ": "XLK", "COIN": "XLK",
    # Consumer Discretionary
    "AMZN": "XLY", "TSLA": "XLY", "HD": "XLY", "MCD": "XLY", "NKE": "XLY",
    "SBUX": "XLY", "TGT": "XLY", "LOW": "XLY", "ABNB": "XLY", "UBER": "XLY",
    "DASH": "XLY", "RIVN": "XLY", "LCID": "XLY", "F": "XLY", "GM": "XLY",
    "NIO": "XLY", "XPEV": "XLY", "LI": "XLY", "RBLX": "XLY", "ROKU": "XLY",
    # Communication
    "GOOGL": "XLC", "GOOG": "XLC", "META": "XLC", "NFLX": "XLC", "DIS": "XLC",
    "CMCSA": "XLC", "VZ": "XLC", "T": "XLC",
    # Healthcare
    "UNH": "XLV", "JNJ": "XLV", "LLY": "XLV", "PFE": "XLV", "ABBV": "XLV",
    "MRK": "XLV", "TMO": "XLV", "ABT": "XLV", "DHR": "XLV",
    # Financials
    "JPM": "XLF", "BAC": "XLF", "WFC": "XLF", "GS": "XLF", "MS": "XLF",
    "V": "XLF", "MA": "XLF", "AXP": "XLF", "HOOD": "XLF", "SOFI": "XLF",
    # Energy
    "XOM": "XLE", "CVX": "XLE", "COP": "XLE", "SLB": "XLE", "EOG": "XLE",
    "OXY": "XLE", "DVN": "XLE", "MPC": "XLE", "VLO": "XLE", "PSX": "XLE",
    # Industrials
    "CAT": "XLI", "BA": "XLI", "HON": "XLI", "UPS": "XLI", "RTX": "XLI",
    "LMT": "XLI", "NOC": "XLI", "GD": "XLI", "GE": "XLI",
    # Consumer Staples
    "PG": "XLP", "KO": "XLP", "PEP": "XLP", "COST": "XLP", "WMT": "XLP",
    # International
    "BABA": "FXI", "JD": "FXI", "PDD": "FXI", "BIDU": "FXI",
    "MELI": "EWZ",
    # ETFs
    "SPY": "SPY", "QQQ": "QQQ", "IWM": "IWM", "DIA": "DIA",
}

SECTOR_NAMES = {
    "XLK": "Technology", "XLF": "Financials", "XLY": "Consumer Disc.",
    "XLV": "Healthcare", "XLE": "Energy", "XLC": "Communication",
    "XLI": "Industrials", "XLP": "Consumer Staples", "XLU": "Utilities",
    "XLRE": "Real Estate", "XLB": "Materials", "SPY": "S&P 500",
    "QQQ": "Nasdaq 100", "IWM": "Russell 2000", "DIA": "Dow Jones",
    "FXI": "China", "EWZ": "Brazil",
}


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def _get_schwab_service():
    """Get Schwab service instance."""
    try:
        from app.services.schwab_service import schwab_service
        return schwab_service
    except ImportError:
        return None


def _get_market_data():
    """Get yfinance market data instance."""
    try:
        from app.services.market_data import market_data
        return market_data
    except ImportError:
        return None


def _get_iv_service():
    """Get IV analytics service."""
    try:
        from app.services.iv_analytics_service import iv_analytics_service
        return iv_analytics_service
    except ImportError:
        return None


# ============================================================================
# STATUS ENDPOINT - Check what's available
# ============================================================================

@router.get("/status", response_model=DataStatusResponse)
async def get_data_status():
    """
    Check which data sources are available.
    Use this to diagnose why data might not be loading.
    """
    schwab = _get_schwab_service()
    market = _get_market_data()
    
    schwab_authenticated = False
    schwab_status = "not_configured"
    
    if schwab:
        if schwab.is_authenticated():
            schwab_authenticated = True
            schwab_status = "authenticated"
        elif schwab.access_token:
            schwab_status = "token_expired"
        else:
            schwab_status = "not_authenticated"
    
    yfinance_available = market is not None
    
    if schwab_authenticated:
        primary = "schwab"
        message = "Schwab API authenticated - using real-time data"
    elif yfinance_available:
        primary = "yfinance"
        message = "Schwab not authenticated - using yfinance (delayed data). Authenticate Schwab for real-time data."
    else:
        primary = "none"
        message = "No data sources available. Configure Schwab API or install yfinance."
    
    return DataStatusResponse(
        schwab_authenticated=schwab_authenticated,
        schwab_status=schwab_status,
        yfinance_available=yfinance_available,
        primary_source=primary,
        message=message,
        timestamp=datetime.now().isoformat()
    )


# ============================================================================
# QUOTE ENDPOINT
# ============================================================================

@router.get("/quote/{ticker}", response_model=QuoteResponse)
async def get_quote(ticker: str):
    """
    Get real-time quote. Uses Schwab if authenticated, falls back to yfinance.
    """
    ticker = ticker.upper()
    schwab = _get_schwab_service()
    
    # Try Schwab first
    if schwab and schwab.is_authenticated():
        try:
            quotes = await schwab.get_quotes([ticker])
            if quotes and ticker in quotes:
                q = quotes[ticker].get("quote", quotes[ticker])
                return QuoteResponse(
                    ticker=ticker,
                    price=q.get("lastPrice") or q.get("mark"),
                    change=q.get("netChange"),
                    change_pct=q.get("netPercentChangeInDouble"),
                    volume=q.get("totalVolume"),
                    bid=q.get("bidPrice"),
                    ask=q.get("askPrice"),
                    data_source="schwab",
                    timestamp=datetime.now().isoformat()
                )
        except Exception as e:
            logger.warning(f"Schwab quote failed for {ticker}: {e}")
    
    # Fallback to yfinance
    market = _get_market_data()
    if market:
        try:
            quote = market.get_quote(ticker)
            if quote and quote.get("price"):
                return QuoteResponse(
                    ticker=ticker,
                    price=quote.get("price"),
                    change=quote.get("change"),
                    change_pct=quote.get("change_percent"),
                    volume=quote.get("volume"),
                    bid=quote.get("bid"),
                    ask=quote.get("ask"),
                    data_source="yfinance",
                    timestamp=datetime.now().isoformat()
                )
        except Exception as e:
            logger.error(f"yfinance quote failed for {ticker}: {e}")
    
    # Return error
    error_msg = "Schwab not authenticated" if schwab and not schwab.is_authenticated() else "No data source available"
    return QuoteResponse(
        ticker=ticker,
        data_source="unavailable",
        error=error_msg,
        timestamp=datetime.now().isoformat()
    )


# ============================================================================
# IV ENDPOINT
# ============================================================================

@router.get("/iv/{ticker}", response_model=IVResponse)
async def get_iv_metrics(ticker: str):
    """
    Get IV Rank and volatility metrics.
    Uses Schwab options chain if authenticated, falls back to yfinance.
    """
    ticker = ticker.upper()
    iv_service = _get_iv_service()
    
    if iv_service:
        try:
            metrics = await iv_service.get_iv_metrics(ticker)
            return IVResponse(
                ticker=ticker,
                iv_rank=metrics.get("iv_rank"),
                iv_percentile=metrics.get("iv_percentile"),
                current_iv=metrics.get("current_iv"),
                hv_20=metrics.get("hv_20"),
                data_source=metrics.get("data_source", "unknown"),
                error=metrics.get("error"),
                timestamp=datetime.now().isoformat()
            )
        except Exception as e:
            logger.error(f"IV service error for {ticker}: {e}")
    
    # Return unavailable with clear message
    schwab = _get_schwab_service()
    if schwab and not schwab.is_authenticated():
        error = "Schwab API not authenticated - cannot fetch options chain for IV calculation"
    else:
        error = "IV analytics service not available"
    
    return IVResponse(
        ticker=ticker,
        data_source="unavailable",
        error=error,
        timestamp=datetime.now().isoformat()
    )


# ============================================================================
# SECTOR ENDPOINT
# ============================================================================

@router.get("/sector/{ticker}", response_model=SectorResponse)
async def get_sector_analysis(ticker: str):
    """
    Get sector relative strength vs SPY.
    """
    ticker = ticker.upper()
    sector_etf = SECTOR_ETF_MAP.get(ticker, "SPY")
    sector_name = SECTOR_NAMES.get(sector_etf, "Unknown")
    
    schwab = _get_schwab_service()
    market = _get_market_data()
    
    sector_change = None
    spy_change = None
    data_source = "unavailable"
    error = None
    
    # Try Schwab
    if schwab and schwab.is_authenticated():
        try:
            quotes = await schwab.get_quotes([sector_etf, "SPY"])
            if quotes:
                if sector_etf in quotes:
                    q = quotes[sector_etf].get("quote", quotes[sector_etf])
                    sector_change = q.get("netPercentChangeInDouble", 0)
                if "SPY" in quotes:
                    q = quotes["SPY"].get("quote", quotes["SPY"])
                    spy_change = q.get("netPercentChangeInDouble", 0)
                data_source = "schwab"
        except Exception as e:
            logger.warning(f"Schwab sector fetch failed: {e}")
    
    # Fallback to yfinance
    if data_source == "unavailable" and market:
        try:
            sector_quote = market.get_quote(sector_etf)
            spy_quote = market.get_quote("SPY")
            
            if sector_quote and sector_quote.get("price"):
                sector_change = sector_quote.get("change_percent", 0)
            if spy_quote and spy_quote.get("price"):
                spy_change = spy_quote.get("change_percent", 0)
            
            if sector_change is not None:
                data_source = "yfinance"
        except Exception as e:
            logger.error(f"yfinance sector fetch failed: {e}")
    
    if data_source == "unavailable":
        if schwab and not schwab.is_authenticated():
            error = "Schwab not authenticated and yfinance unavailable"
        else:
            error = "Could not fetch sector data"
        
        return SectorResponse(
            ticker=ticker,
            sector=sector_name,
            sector_etf=sector_etf,
            data_source="unavailable",
            error=error,
            timestamp=datetime.now().isoformat()
        )
    
    # Calculate relative strength
    if spy_change == 0 or spy_change is None:
        rs = 1.0 + ((sector_change or 0) / 10)
    else:
        rs = 1.0 + (((sector_change or 0) - spy_change) / max(abs(spy_change), 0.5))
    
    rs = max(0.5, min(1.5, rs))
    flow = "inflow" if rs > 1.05 else "outflow" if rs < 0.95 else "neutral"
    
    return SectorResponse(
        ticker=ticker,
        sector=sector_name,
        sector_etf=sector_etf,
        relative_strength=round(rs, 2),
        sector_change_pct=round(sector_change, 2) if sector_change else 0,
        spy_change_pct=round(spy_change, 2) if spy_change else 0,
        flow_direction=flow,
        data_source=data_source,
        timestamp=datetime.now().isoformat()
    )


# ============================================================================
# VIX ENDPOINT
# ============================================================================

@router.get("/vix", response_model=VIXResponse)
async def get_vix():
    """Get VIX level and regime classification."""
    schwab = _get_schwab_service()
    market = _get_market_data()
    
    vix = None
    vix_change = None
    data_source = "unavailable"
    error = None
    
    # Try Schwab
    if schwab and schwab.is_authenticated():
        try:
            quotes = await schwab.get_quotes(["$VIX.X"])
            if quotes and "$VIX.X" in quotes:
                q = quotes["$VIX.X"].get("quote", quotes["$VIX.X"])
                vix = q.get("lastPrice")
                vix_change = q.get("netChange")
                data_source = "schwab"
        except Exception as e:
            logger.warning(f"Schwab VIX fetch failed: {e}")
    
    # Fallback to yfinance
    if data_source == "unavailable" and market:
        try:
            quote = market.get_quote("^VIX")
            if quote and quote.get("price"):
                vix = quote.get("price")
                vix_change = quote.get("change")
                data_source = "yfinance"
        except Exception as e:
            logger.error(f"yfinance VIX fetch failed: {e}")
    
    if vix is None:
        if schwab and not schwab.is_authenticated():
            error = "Schwab not authenticated and yfinance VIX unavailable"
        else:
            error = "Could not fetch VIX data"
        
        return VIXResponse(
            data_source="unavailable",
            error=error,
            timestamp=datetime.now().isoformat()
        )
    
    # Classify regime
    if vix < 15:
        regime = "low"
    elif vix < 20:
        regime = "elevated"
    elif vix < 30:
        regime = "high"
    else:
        regime = "extreme"
    
    return VIXResponse(
        vix=round(vix, 2),
        vix_change=round(vix_change, 2) if vix_change else 0,
        regime=regime,
        data_source=data_source,
        timestamp=datetime.now().isoformat()
    )


# ============================================================================
# EARNINGS ENDPOINT
# ============================================================================

@router.get("/earnings/{ticker}", response_model=EarningsResponse)
async def get_earnings(ticker: str):
    """
    Get next earnings date.
    Uses yfinance calendar data.
    """
    ticker = ticker.upper()
    
    try:
        import yfinance as yf
        stock = yf.Ticker(ticker)
        calendar = stock.calendar
        
        if calendar is not None and not calendar.empty:
            earnings_date = None
            if "Earnings Date" in calendar.index:
                ed = calendar.loc["Earnings Date"]
                if hasattr(ed, 'iloc'):
                    earnings_date = str(ed.iloc[0])[:10]
                else:
                    earnings_date = str(ed)[:10]
            
            if earnings_date:
                try:
                    ed_dt = datetime.strptime(earnings_date, "%Y-%m-%d")
                    days_until = (ed_dt - datetime.now()).days
                    
                    return EarningsResponse(
                        ticker=ticker,
                        earnings_date=earnings_date,
                        days_until=days_until if days_until >= 0 else None,
                        is_confirmed=False,
                        data_source="yfinance",
                        timestamp=datetime.now().isoformat()
                    )
                except:
                    pass
    except Exception as e:
        logger.warning(f"Earnings fetch failed for {ticker}: {e}")
    
    return EarningsResponse(
        ticker=ticker,
        is_confirmed=False,
        data_source="unavailable",
        error="Earnings data not available - requires Schwab fundamentals or earnings calendar service",
        timestamp=datetime.now().isoformat()
    )


# ============================================================================
# BULK QUOTES
# ============================================================================

@router.get("/quotes")
async def get_quotes(tickers: str):
    """Get quotes for multiple tickers (comma-separated)."""
    ticker_list = [t.strip().upper() for t in tickers.split(",")]
    results = {}
    data_source = "unavailable"
    
    schwab = _get_schwab_service()
    market = _get_market_data()
    
    # Try Schwab batch
    if schwab and schwab.is_authenticated():
        try:
            quotes = await schwab.get_quotes(ticker_list)
            for ticker, data in quotes.items():
                q = data.get("quote", data)
                results[ticker] = {
                    "price": q.get("lastPrice"),
                    "change": q.get("netChange"),
                    "change_pct": q.get("netPercentChangeInDouble"),
                }
            data_source = "schwab"
        except Exception as e:
            logger.warning(f"Schwab batch quotes failed: {e}")
    
    # Fill missing with yfinance
    if market:
        for ticker in ticker_list:
            if ticker not in results:
                try:
                    quote = market.get_quote(ticker)
                    if quote and quote.get("price"):
                        results[ticker] = {
                            "price": quote.get("price"),
                            "change": quote.get("change"),
                            "change_pct": quote.get("change_percent"),
                        }
                        if data_source == "unavailable":
                            data_source = "yfinance"
                except:
                    pass
    
    return {
        "quotes": results,
        "data_source": data_source,
        "timestamp": datetime.now().isoformat()
    }
