"""
Macro Analysis & Event Horizon Endpoint
Provides macro context, earnings dates, sector rotation, and event blackouts
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime, timedelta
import httpx

router = APIRouter()

# ============================================================================
# CONSTANTS - Hard-coded per user specifications
# ============================================================================

# Mag 7 + Broadcom - These move the index
MAG8_TICKERS = ["NVDA", "AAPL", "MSFT", "AMZN", "META", "GOOGL", "TSLA", "AVGO"]

# Index tickers that need Mag 8 earnings check
INDEX_TICKERS = ["SPX", "SPY", "QQQ", "NDX", "IWM", "$SPX.X", "$NDX.X"]

# Sector ETF mapping for Relative Strength calculation
SECTOR_ETF_MAP = {
    # Technology
    "AAPL": "XLK", "NVDA": "XLK", "MSFT": "XLK", "AVGO": "XLK", "AMD": "XLK", 
    "INTC": "XLK", "CRM": "XLK", "ORCL": "XLK", "ADBE": "XLK", "CSCO": "XLK",
    # Consumer Discretionary  
    "AMZN": "XLY", "TSLA": "XLY", "HD": "XLY", "MCD": "XLY", "NKE": "XLY",
    "SBUX": "XLY", "TGT": "XLY", "LOW": "XLY",
    # Communication Services
    "GOOGL": "XLC", "GOOG": "XLC", "META": "XLC", "NFLX": "XLC", "DIS": "XLC",
    "CMCSA": "XLC", "VZ": "XLC", "T": "XLC",
    # Healthcare
    "UNH": "XLV", "JNJ": "XLV", "LLY": "XLV", "PFE": "XLV", "ABBV": "XLV",
    "MRK": "XLV", "TMO": "XLV",
    # Financials
    "JPM": "XLF", "BAC": "XLF", "WFC": "XLF", "GS": "XLF", "MS": "XLF",
    "V": "XLF", "MA": "XLF", "AXP": "XLF",
    # Energy
    "XOM": "XLE", "CVX": "XLE", "COP": "XLE", "SLB": "XLE", "EOG": "XLE",
    # Industrials
    "CAT": "XLI", "BA": "XLI", "HON": "XLI", "UPS": "XLI", "RTX": "XLI",
    "GE": "XLI", "DE": "XLI",
    # Consumer Staples
    "PG": "XLP", "KO": "XLP", "PEP": "XLP", "COST": "XLP", "WMT": "XLP",
    # Utilities
    "NEE": "XLU", "DUK": "XLU", "SO": "XLU",
    # Real Estate
    "AMT": "XLRE", "PLD": "XLRE", "SPG": "XLRE",
    # Materials
    "LIN": "XLB", "APD": "XLB", "ECL": "XLB",
    # Default for unknown
    "DEFAULT": "SPY"
}

# FOMC Meeting Dates 2025-2026 (Hard-coded, update annually)
FOMC_DATES = [
    # 2025
    "2025-01-29", "2025-03-19", "2025-05-07", "2025-06-18",
    "2025-07-30", "2025-09-17", "2025-11-05", "2025-12-17",
    # 2026
    "2026-01-28", "2026-03-18", "2026-04-29", "2026-06-17",
    "2026-07-29", "2026-09-16", "2026-11-04", "2026-12-16"
]

# User-configurable blackout dates (CPI, NFP, etc.)
# Update this weekly - "Sunday Ritual"
BLACKOUT_DATES = [
    # Format: {"date": "YYYY-MM-DD", "event": "Event Name"}
    {"date": "2026-02-14", "event": "CPI Release"},
    {"date": "2026-03-07", "event": "NFP Jobs Report"},
    {"date": "2026-03-12", "event": "CPI Release"},
    {"date": "2026-03-18", "event": "FOMC Decision"},
]

# ============================================================================
# MODELS
# ============================================================================

class MacroRequest(BaseModel):
    ticker: str
    current_price: Optional[float] = None
    vix: Optional[float] = None  # Can be passed from scanner
    spy_change: Optional[float] = None  # Can be passed from scanner

class EventInfo(BaseModel):
    event_type: str  # earnings, fomc, cpi, nfp, blackout
    ticker: Optional[str] = None
    date: str
    days_away: int
    impact: str  # high, medium, low
    description: str

class SectorAnalysis(BaseModel):
    sector_etf: str
    sector_name: str
    sector_change_pct: float
    spy_change_pct: float
    relative_strength: float  # > 1 = outperforming, < 1 = underperforming
    flow_direction: str  # inflow, outflow, neutral
    
class MacroContext(BaseModel):
    bond_yield_10y: Optional[float] = None
    bond_yield_change: Optional[float] = None
    vix_level: float
    vix_regime: str  # low, elevated, high, extreme
    market_trend: str  # bullish, bearish, neutral

class MacroResponse(BaseModel):
    ticker: str
    asset_type: str  # index, single_stock
    is_mag8: bool
    
    # Event Horizon
    events: List[EventInfo]
    has_binary_event: bool  # Within 5 days
    event_override: Optional[str] = None  # If binary event blocks trading
    
    # Sector Analysis
    sector: Optional[SectorAnalysis] = None
    sector_correlation: Optional[str] = None  # For single stocks: sector leader status
    
    # Macro Context
    macro: MacroContext
    
    # Mag 8 Earnings (for index only)
    mag8_earnings_risk: Optional[List[EventInfo]] = None
    
    # Final Macro Score Adjustment
    macro_adjustment: int  # Points to add/subtract from confidence
    macro_warnings: List[str]
    macro_status: str  # clear, caution, high_risk

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_days_until(date_str: str) -> int:
    """Calculate days until a given date"""
    target = datetime.strptime(date_str, "%Y-%m-%d").date()
    today = datetime.now().date()
    return (target - today).days

def get_next_fomc() -> Optional[Dict]:
    """Get the next FOMC meeting date"""
    today = datetime.now().date()
    for date_str in FOMC_DATES:
        fomc_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        if fomc_date >= today:
            days = (fomc_date - today).days
            return {"date": date_str, "days_away": days}
    return None

def get_blackout_events() -> List[Dict]:
    """Get upcoming blackout events within 14 days"""
    events = []
    today = datetime.now().date()
    
    for item in BLACKOUT_DATES:
        event_date = datetime.strptime(item["date"], "%Y-%m-%d").date()
        days = (event_date - today).days
        if 0 <= days <= 14:
            events.append({
                "event": item["event"],
                "date": item["date"],
                "days_away": days
            })
    return events

def get_sector_etf(ticker: str) -> str:
    """Get the sector ETF for a ticker"""
    return SECTOR_ETF_MAP.get(ticker.upper(), SECTOR_ETF_MAP["DEFAULT"])

def is_index_ticker(ticker: str) -> bool:
    """Check if ticker is an index/ETF"""
    return ticker.upper() in INDEX_TICKERS

def calculate_vix_regime(vix: float) -> str:
    """Categorize VIX level"""
    if vix < 15:
        return "low"
    elif vix < 20:
        return "elevated"
    elif vix < 30:
        return "high"
    else:
        return "extreme"

# ============================================================================
# DATA FETCHING (Uses existing zero-dte endpoint or defaults)
# ============================================================================

async def get_quote_data(symbol: str) -> Optional[Dict]:
    """
    Fetch quote data - tries internal API first, falls back to defaults.
    In production, this would call your existing Schwab-connected endpoint.
    """
    try:
        # Try to call the existing market-data endpoint
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"http://localhost:8000/api/v1/zero-dte/market-data/{symbol}",
                timeout=5.0
            )
            if response.status_code == 200:
                data = response.json()
                # Transform to expected format
                return {
                    "quote": {
                        "lastPrice": data.get("spot_price", 0),
                        "netPercentChangeInDouble": data.get("spot_change_percent", 0),
                        "netChange": data.get("spot_change", 0)
                    }
                }
    except Exception as e:
        print(f"Could not fetch quote for {symbol}: {e}")
    
    # Return None if we can't get data - will use defaults
    return None

async def get_earnings_date(symbol: str) -> Optional[Dict]:
    """
    Attempt to get earnings date.
    Note: Schwab doesn't provide this directly - use blackout dates instead.
    """
    # For now, rely on manual blackout dates
    return None

# ============================================================================
# MAIN ENDPOINT
# ============================================================================

@router.post("/macro-analysis", response_model=MacroResponse)
async def get_macro_analysis(request: MacroRequest):
    """
    Comprehensive macro analysis for a ticker
    Implements the decision hierarchy:
    1. Binary Events (highest) - override all signals
    2. Macro Trends (medium) - adjust confidence
    3. Technical/GEX (base) - validated only if tiers 1 & 2 clear
    """
    ticker = request.ticker.upper()
    events: List[EventInfo] = []
    warnings: List[str] = []
    macro_adjustment = 0
    
    # Determine asset type
    asset_type = "index" if is_index_ticker(ticker) else "single_stock"
    is_mag8 = ticker in MAG8_TICKERS
    
    # =========================================================================
    # TIER 1: BINARY EVENTS (Highest Priority)
    # =========================================================================
    
    # Check FOMC
    fomc = get_next_fomc()
    if fomc and fomc["days_away"] <= 14:
        impact = "high" if fomc["days_away"] <= 5 else "medium"
        events.append(EventInfo(
            event_type="fomc",
            date=fomc["date"],
            days_away=fomc["days_away"],
            impact=impact,
            description=f"FOMC Meeting in {fomc['days_away']} days"
        ))
        if fomc["days_away"] <= 5:
            warnings.append(f"FOMC in {fomc['days_away']} days - BINARY EVENT RISK")
            macro_adjustment -= 20
    
    # Check blackout dates
    blackouts = get_blackout_events()
    for b in blackouts:
        impact = "high" if b["days_away"] <= 2 else "medium"
        events.append(EventInfo(
            event_type="blackout",
            date=b["date"],
            days_away=b["days_away"],
            impact=impact,
            description=f"{b['event']} in {b['days_away']} days"
        ))
        if b["days_away"] <= 2:
            warnings.append(f"{b['event']} in {b['days_away']} days - HIGH RISK")
            macro_adjustment -= 25
    
    # For INDEX: Check Mag 8 earnings
    mag8_earnings: List[EventInfo] = []
    if asset_type == "index":
        # Note: In production, you'd check actual earnings dates
        # For now, this would require external data or manual input
        pass
    
    # For SINGLE STOCK: Check ticker's own earnings
    if asset_type == "single_stock":
        # Would need earnings calendar data
        # Placeholder - rely on blackout dates for now
        pass
    
    # Determine if binary event blocks trading
    has_binary_event = any(e.days_away <= 5 and e.impact == "high" for e in events)
    event_override = None
    if has_binary_event:
        blocking_events = [e for e in events if e.days_away <= 5 and e.impact == "high"]
        event_names = [e.description for e in blocking_events]
        event_override = f"HOLD/WAIT: Technical setup invalid due to: {', '.join(event_names)}"
    
    # =========================================================================
    # TIER 2: MACRO TRENDS (Medium Priority)
    # =========================================================================
    
    # Get VIX - prefer request value, then API, then default
    vix_level = 18.0  # Default
    if request.vix is not None:
        vix_level = request.vix
    else:
        vix_data = await get_quote_data("$VIX.X")
        if vix_data and "quote" in vix_data:
            vix_level = vix_data["quote"].get("lastPrice", 18.0)
    vix_regime = calculate_vix_regime(vix_level)
    
    # VIX regime adjustment
    if vix_regime == "extreme":
        warnings.append("VIX EXTREME (>30) - Unpredictable price action")
        macro_adjustment -= 15
    elif vix_regime == "high":
        warnings.append("VIX HIGH (20-30) - Elevated volatility")
        macro_adjustment -= 5
    
    # Get SPY change - prefer request value, then API, then default
    spy_change = 0.0
    market_trend = "neutral"
    
    if request.spy_change is not None:
        spy_change = request.spy_change
    else:
        spy_data = await get_quote_data("SPY")
        if spy_data and "quote" in spy_data:
            q = spy_data["quote"]
            spy_change = q.get("netPercentChangeInDouble", 0)
    
    if spy_change > 0.5:
        market_trend = "bullish"
    elif spy_change < -0.5:
        market_trend = "bearish"
    
    # Sector Analysis (for single stocks)
    sector_analysis = None
    if asset_type == "single_stock":
        sector_etf = get_sector_etf(ticker)
        sector_data = await get_quote_data(sector_etf)
        
        if sector_data and "quote" in sector_data:
            q = sector_data["quote"]
            sector_change = q.get("netPercentChangeInDouble", 0)
            
            # Calculate Relative Strength
            rs = 1.0
            if spy_change != 0:
                rs = sector_change / spy_change if spy_change != 0 else 1.0
            
            flow_direction = "neutral"
            if rs > 1.1:
                flow_direction = "inflow"
            elif rs < 0.9:
                flow_direction = "outflow"
                warnings.append(f"Sector ({sector_etf}) UNDERPERFORMING - Fighting the tide")
                macro_adjustment -= 15
            
            # Sector ETF name mapping
            sector_names = {
                "XLK": "Technology", "XLF": "Financials", "XLY": "Consumer Disc.",
                "XLV": "Healthcare", "XLE": "Energy", "XLC": "Communication",
                "XLI": "Industrials", "XLP": "Consumer Staples", "XLU": "Utilities",
                "XLRE": "Real Estate", "XLB": "Materials", "SPY": "S&P 500"
            }
            
            sector_analysis = SectorAnalysis(
                sector_etf=sector_etf,
                sector_name=sector_names.get(sector_etf, "Unknown"),
                sector_change_pct=round(sector_change, 2),
                spy_change_pct=round(spy_change, 2),
                relative_strength=round(rs, 2),
                flow_direction=flow_direction
            )
    
    # Get 10Y Treasury (TNX) - optional
    tnx_data = await get_quote_data("$TNX.X")
    bond_yield = None
    bond_change = None
    if tnx_data and "quote" in tnx_data:
        q = tnx_data["quote"]
        bond_yield = q.get("lastPrice")
        bond_change = q.get("netChange")
        
        # Rising yields = headwind for growth/tech
        if bond_change and bond_change > 0.05:
            if asset_type == "single_stock" and get_sector_etf(ticker) in ["XLK", "XLY", "XLC"]:
                warnings.append("Rising yields - Headwind for growth stocks")
                macro_adjustment -= 5
    
    # =========================================================================
    # FINAL SCORING
    # =========================================================================
    
    # Determine macro status
    if has_binary_event:
        macro_status = "high_risk"
    elif macro_adjustment <= -20:
        macro_status = "caution"
    else:
        macro_status = "clear"
    
    return MacroResponse(
        ticker=ticker,
        asset_type=asset_type,
        is_mag8=is_mag8,
        events=events,
        has_binary_event=has_binary_event,
        event_override=event_override,
        sector=sector_analysis,
        sector_correlation=None,  # Could add sector leader comparison
        macro=MacroContext(
            bond_yield_10y=bond_yield,
            bond_yield_change=bond_change,
            vix_level=round(vix_level, 2),
            vix_regime=vix_regime,
            market_trend=market_trend
        ),
        mag8_earnings_risk=mag8_earnings if mag8_earnings else None,
        macro_adjustment=macro_adjustment,
        macro_warnings=warnings,
        macro_status=macro_status
    )


@router.get("/blackout-dates")
async def get_blackout_dates():
    """Get current blackout dates configuration"""
    return {
        "blackout_dates": BLACKOUT_DATES,
        "fomc_dates": FOMC_DATES[:8],  # Next 8 FOMC dates
        "mag8_tickers": MAG8_TICKERS
    }


@router.post("/blackout-dates")
async def update_blackout_dates(dates: List[Dict]):
    """
    Update blackout dates - "Sunday Ritual" endpoint
    In production, this would persist to a database/file
    """
    global BLACKOUT_DATES
    BLACKOUT_DATES = dates
    return {"status": "updated", "blackout_dates": BLACKOUT_DATES}
