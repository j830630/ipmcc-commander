"""
IPMCC Commander - Unified Market Data Service
Single source of truth for all market data from Schwab API

Provides:
- Real-time quotes
- VIX data with regime classification
- Sector relative strength analysis
- IV estimation (basic - use IV Analytics Service for full calculation)
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
import httpx

logger = logging.getLogger(__name__)


class CacheService:
    """Simple in-memory cache."""
    
    def __init__(self):
        self._cache: Dict[str, Dict] = {}
    
    def get(self, key: str) -> Optional[Any]:
        if key in self._cache:
            entry = self._cache[key]
            if (datetime.now() - entry["timestamp"]).seconds < entry["ttl"]:
                return entry["value"]
            del self._cache[key]
        return None
    
    def set(self, key: str, value: Any, ttl: int = 60):
        self._cache[key] = {
            "value": value,
            "timestamp": datetime.now(),
            "ttl": ttl
        }
    
    def clear(self):
        self._cache.clear()


# Global cache instance
cache_service = CacheService()


def cached(ttl: int = 60, key_prefix: str = ""):
    """Caching decorator."""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Build cache key from function name and args
            cache_key = f"{key_prefix}:{func.__name__}:{str(args[1:])}"
            
            # Check cache
            cached_value = cache_service.get(cache_key)
            if cached_value is not None:
                return cached_value
            
            # Call function
            result = await func(*args, **kwargs)
            
            # Cache result
            if result is not None:
                cache_service.set(cache_key, result, ttl)
            
            return result
        return wrapper
    return decorator


class MarketDataService:
    """
    Unified service for all market data needs.
    Consolidates Schwab API calls with caching.
    """
    
    # Comprehensive sector ETF mapping (120+ tickers)
    SECTOR_ETF_MAP = {
        # ===== TECHNOLOGY (XLK) =====
        "AAPL": "XLK", "MSFT": "XLK", "NVDA": "XLK", "AVGO": "XLK", "AMD": "XLK",
        "INTC": "XLK", "CRM": "XLK", "ORCL": "XLK", "ADBE": "XLK", "CSCO": "XLK",
        "QCOM": "XLK", "TXN": "XLK", "IBM": "XLK", "NOW": "XLK", "INTU": "XLK",
        "ACN": "XLK", "PLTR": "XLK", "SNOW": "XLK", "CRWD": "XLK", "PANW": "XLK",
        "DDOG": "XLK", "ZS": "XLK", "NET": "XLK", "SHOP": "XLK", "SQ": "XLK",
        "COIN": "XLK",
        
        # ===== CONSUMER DISCRETIONARY (XLY) =====
        "AMZN": "XLY", "TSLA": "XLY", "HD": "XLY", "MCD": "XLY", "NKE": "XLY",
        "SBUX": "XLY", "TGT": "XLY", "LOW": "XLY", "BKNG": "XLY", "ABNB": "XLY",
        "UBER": "XLY", "DASH": "XLY", "RIVN": "XLY", "LCID": "XLY", "F": "XLY",
        "GM": "XLY", "TM": "XLY", "NIO": "XLY", "XPEV": "XLY", "LI": "XLY",
        "RBLX": "XLY", "ROKU": "XLY",
        
        # ===== COMMUNICATION SERVICES (XLC) =====
        "GOOGL": "XLC", "GOOG": "XLC", "META": "XLC", "NFLX": "XLC", "DIS": "XLC",
        "CMCSA": "XLC", "VZ": "XLC", "T": "XLC", "TMUS": "XLC",
        
        # ===== HEALTHCARE (XLV) =====
        "UNH": "XLV", "JNJ": "XLV", "LLY": "XLV", "PFE": "XLV", "ABBV": "XLV",
        "MRK": "XLV", "TMO": "XLV", "ABT": "XLV", "DHR": "XLV", "AMGN": "XLV",
        
        # ===== FINANCIALS (XLF) =====
        "JPM": "XLF", "BAC": "XLF", "WFC": "XLF", "GS": "XLF", "MS": "XLF",
        "V": "XLF", "MA": "XLF", "AXP": "XLF", "BLK": "XLF", "SCHW": "XLF",
        "C": "XLF", "HOOD": "XLF", "SOFI": "XLF", "AFRM": "XLF",
        
        # ===== ENERGY (XLE) =====
        "XOM": "XLE", "CVX": "XLE", "COP": "XLE", "SLB": "XLE", "EOG": "XLE",
        "OXY": "XLE", "DVN": "XLE", "MPC": "XLE", "VLO": "XLE", "PSX": "XLE",
        
        # ===== INDUSTRIALS (XLI) =====
        "CAT": "XLI", "BA": "XLI", "HON": "XLI", "UPS": "XLI", "RTX": "XLI",
        "LMT": "XLI", "NOC": "XLI", "GD": "XLI", "GE": "XLI", "DE": "XLI",
        "TDG": "XLI", "LHX": "XLI", "HWM": "XLI",
        
        # ===== CONSUMER STAPLES (XLP) =====
        "PG": "XLP", "KO": "XLP", "PEP": "XLP", "COST": "XLP", "WMT": "XLP",
        "PM": "XLP", "MO": "XLP", "MDLZ": "XLP", "CL": "XLP",
        
        # ===== UTILITIES (XLU) =====
        "NEE": "XLU", "DUK": "XLU", "SO": "XLU", "D": "XLU",
        
        # ===== REAL ESTATE (XLRE) =====
        "AMT": "XLRE", "PLD": "XLRE", "CCI": "XLRE", "EQIX": "XLRE",
        
        # ===== MATERIALS (XLB) =====
        "LIN": "XLB", "APD": "XLB", "SHW": "XLB", "FCX": "XLB", "NEM": "XLB",
        
        # ===== INTERNATIONAL =====
        "BABA": "FXI", "JD": "FXI", "PDD": "FXI", "BIDU": "FXI",
        "MELI": "EWZ", "SE": "EWT", "GRAB": "EWT",
        
        # ===== ETFs =====
        "SPY": "SPY", "QQQ": "QQQ", "IWM": "IWM", "DIA": "DIA",
        "VTI": "SPY", "VOO": "SPY",
        "XLK": "XLK", "XLF": "XLF", "XLE": "XLE", "XLV": "XLV",
        "XLI": "XLI", "XLY": "XLY", "XLP": "XLP", "XLU": "XLU",
        "XLRE": "XLRE", "XLB": "XLB", "XLC": "XLC",
        "GLD": "GLD", "SLV": "SLV", "TLT": "TLT",
        
        "DEFAULT": "SPY"
    }
    
    # Sector names
    SECTOR_NAMES = {
        "XLK": "Technology",
        "XLF": "Financials", 
        "XLY": "Consumer Discretionary",
        "XLV": "Healthcare",
        "XLE": "Energy",
        "XLC": "Communication Services",
        "XLI": "Industrials",
        "XLP": "Consumer Staples",
        "XLU": "Utilities",
        "XLRE": "Real Estate",
        "XLB": "Materials",
        "SPY": "S&P 500",
        "QQQ": "Nasdaq 100",
        "IWM": "Russell 2000",
        "DIA": "Dow Jones",
        "GLD": "Gold",
        "TLT": "Treasury Bonds",
        "FXI": "China",
        "EWZ": "Brazil",
        "EWT": "Taiwan"
    }
    
    # Mag 7 tickers
    MAG7_TICKERS = ["NVDA", "AAPL", "MSFT", "AMZN", "META", "GOOGL", "TSLA"]
    
    # Index tickers
    INDEX_TICKERS = ["SPX", "SPY", "QQQ", "NDX", "IWM", "DIA", "$SPX.X", "$NDX.X", "$VIX.X"]
    
    def __init__(self, schwab_client=None):
        self.schwab_client = schwab_client
    
    @cached(ttl=30, key_prefix="quote")
    async def get_quote(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Get current quote for a symbol."""
        try:
            if self.schwab_client:
                quotes = self.schwab_client.get_quotes([symbol])
                if quotes and symbol in quotes:
                    return self._normalize_quote(quotes[symbol])
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"http://localhost:8000/api/v1/schwab/quotes/{symbol}",
                    timeout=5.0
                )
                if response.status_code == 200:
                    return self._normalize_quote(response.json())
            
            return None
        except Exception as e:
            logger.error(f"Error fetching quote for {symbol}: {e}")
            return None
    
    async def get_quotes(self, symbols: List[str]) -> Dict[str, Dict[str, Any]]:
        """Get quotes for multiple symbols."""
        results = {}
        for symbol in symbols:
            quote = await self.get_quote(symbol)
            if quote:
                results[symbol] = quote
        return results
    
    @cached(ttl=60, key_prefix="vix")
    async def get_vix(self) -> Dict[str, Any]:
        """Get VIX data with regime classification."""
        quote = await self.get_quote("$VIX.X")
        
        if not quote:
            for vix_symbol in ["VIX", "^VIX"]:
                quote = await self.get_quote(vix_symbol)
                if quote:
                    break
        
        vix_level = quote.get("price", 18.0) if quote else 18.0
        
        return {
            "vix": vix_level,
            "vix_change": quote.get("change", 0) if quote else 0,
            "vix_change_pct": quote.get("change_pct", 0) if quote else 0,
            "regime": self._classify_vix_regime(vix_level)
        }
    
    @cached(ttl=60, key_prefix="spy")
    async def get_spy_data(self) -> Dict[str, Any]:
        """Get SPY quote for market trend."""
        quote = await self.get_quote("SPY")
        
        if not quote:
            return {"price": 0, "change_pct": 0, "trend": "neutral"}
        
        change_pct = quote.get("change_pct", 0)
        trend = "bullish" if change_pct > 0.5 else "bearish" if change_pct < -0.5 else "neutral"
        
        return {
            "price": quote.get("price", 0),
            "change": quote.get("change", 0),
            "change_pct": change_pct,
            "trend": trend
        }
    
    def get_sector_etf(self, ticker: str) -> str:
        """Get the sector ETF for a ticker."""
        return self.SECTOR_ETF_MAP.get(ticker.upper(), self.SECTOR_ETF_MAP["DEFAULT"])
    
    def get_sector_name(self, ticker: str) -> str:
        """Get sector name for a ticker."""
        sector_etf = self.get_sector_etf(ticker)
        return self.SECTOR_NAMES.get(sector_etf, "Unknown")
    
    async def get_sector_analysis(self, ticker: str) -> Optional[Dict[str, Any]]:
        """Get sector relative strength analysis."""
        sector_etf = self.get_sector_etf(ticker)
        sector_quote = await self.get_quote(sector_etf)
        spy_data = await self.get_spy_data()
        
        if not sector_quote:
            return {
                "sector_etf": sector_etf,
                "sector_name": self.SECTOR_NAMES.get(sector_etf, "Unknown"),
                "sector_change_pct": 0,
                "spy_change_pct": spy_data.get("change_pct", 0),
                "relative_strength": 1.0,
                "flow_direction": "neutral"
            }
        
        sector_change = sector_quote.get("change_pct", 0)
        spy_change = spy_data.get("change_pct", 0)
        
        if spy_change == 0:
            rs = 1.0 + (sector_change / 10)
        else:
            rs = 1.0 + ((sector_change - spy_change) / max(abs(spy_change), 0.5))
        
        rs = max(0.5, min(1.5, rs))
        flow_direction = "inflow" if rs > 1.05 else "outflow" if rs < 0.95 else "neutral"
        
        return {
            "sector_etf": sector_etf,
            "sector_name": self.SECTOR_NAMES.get(sector_etf, "Unknown"),
            "sector_change_pct": round(sector_change, 2),
            "spy_change_pct": round(spy_change, 2),
            "relative_strength": round(rs, 2),
            "flow_direction": flow_direction
        }
    
    async def get_iv_rank(self, symbol: str) -> Dict[str, Any]:
        """Get estimated IV Rank based on VIX."""
        vix_data = await self.get_vix()
        vix = vix_data.get("vix", 18)
        
        base_iv_rank = min(100, max(0, (vix - 12) * 5))
        
        volatility_adjustments = {
            "TSLA": 15, "NVDA": 10, "AMD": 10, "COIN": 20, "RIVN": 20,
            "PLTR": 10, "SNOW": 10, "SHOP": 10, "SQ": 10, "ROKU": 15,
            "JNJ": -10, "PG": -10, "KO": -10, "PEP": -10, "WMT": -8,
            "MCD": -8, "V": -5, "MA": -5,
            "SPY": -5, "QQQ": 0, "IWM": 5,
        }
        
        adjustment = volatility_adjustments.get(symbol.upper(), 0)
        estimated_iv_rank = max(0, min(100, base_iv_rank + adjustment))
        
        return {
            "iv_rank": round(estimated_iv_rank),
            "iv_percentile": round(estimated_iv_rank * 0.95),
            "current_iv": None,
            "hv_20": None,
            "source": "estimated_from_vix"
        }
    
    async def get_market_snapshot(self, ticker: str) -> Dict[str, Any]:
        """Get comprehensive market snapshot."""
        ticker = ticker.upper()
        is_index = ticker in self.INDEX_TICKERS
        is_mag7 = ticker in self.MAG7_TICKERS
        
        quote = await self.get_quote(ticker)
        vix_data = await self.get_vix()
        spy_data = await self.get_spy_data()
        sector = None if is_index else await self.get_sector_analysis(ticker)
        
        return {
            "ticker": ticker,
            "asset_type": "index" if is_index else "single_stock",
            "is_mag7": is_mag7,
            "quote": quote,
            "vix": vix_data,
            "spy": spy_data,
            "sector": sector,
            "timestamp": datetime.now().isoformat()
        }
    
    def _normalize_quote(self, raw_quote: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize quote data."""
        if "quote" in raw_quote:
            q = raw_quote["quote"]
            return {
                "price": q.get("lastPrice", 0),
                "change": q.get("netChange", 0),
                "change_pct": q.get("netPercentChangeInDouble", 0),
                "high": q.get("highPrice", 0),
                "low": q.get("lowPrice", 0),
                "volume": q.get("totalVolume", 0),
            }
        
        return {
            "price": raw_quote.get("lastPrice") or raw_quote.get("price") or raw_quote.get("mark", 0),
            "change": raw_quote.get("netChange") or raw_quote.get("change", 0),
            "change_pct": raw_quote.get("netPercentChangeInDouble") or raw_quote.get("change_pct") or raw_quote.get("percentChange", 0),
            "high": raw_quote.get("highPrice") or raw_quote.get("high", 0),
            "low": raw_quote.get("lowPrice") or raw_quote.get("low", 0),
            "volume": raw_quote.get("totalVolume") or raw_quote.get("volume", 0),
        }
    
    def _classify_vix_regime(self, vix: float) -> str:
        """Classify VIX into regime."""
        if vix < 15:
            return "low"
        elif vix < 20:
            return "elevated"
        elif vix < 30:
            return "high"
        return "extreme"


market_data_service = MarketDataService()
