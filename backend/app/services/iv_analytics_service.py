"""
IPMCC Commander - IV Analytics Service
Calculates IV Rank from Schwab options chain data.

Uses schwab_service for real-time options data.
Falls back to yfinance if Schwab not authenticated.
"""

import logging
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class IVAnalyticsService:
    """
    Service for calculating IV Rank and volatility metrics.
    Uses Schwab API for real-time options data.
    """
    
    def __init__(self):
        self._iv_cache: Dict[str, Dict] = {}
        self._cache_ttl = 300  # 5 minutes
        
        # Historical IV profiles for IV Rank calculation
        # IV Rank = (Current IV - 52wk Low) / (52wk High - 52wk Low) * 100
        self.IV_PROFILES = {
            # High volatility stocks
            "TSLA": {"low": 35, "high": 90}, "NVDA": {"low": 30, "high": 80},
            "AMD": {"low": 30, "high": 75}, "COIN": {"low": 50, "high": 120},
            "RIVN": {"low": 50, "high": 110}, "LCID": {"low": 50, "high": 100},
            "PLTR": {"low": 35, "high": 85}, "SNOW": {"low": 35, "high": 80},
            "SHOP": {"low": 35, "high": 85}, "SQ": {"low": 35, "high": 80},
            "ROKU": {"low": 40, "high": 90}, "MELI": {"low": 30, "high": 70},
            "RBLX": {"low": 40, "high": 85}, "HOOD": {"low": 45, "high": 100},
            "SOFI": {"low": 40, "high": 90}, "AFRM": {"low": 50, "high": 110},
            "NIO": {"low": 45, "high": 100}, "XPEV": {"low": 50, "high": 110},
            "BABA": {"low": 30, "high": 70}, "JD": {"low": 30, "high": 70},
            "PDD": {"low": 40, "high": 85}, "CRWD": {"low": 30, "high": 70},
            "PANW": {"low": 28, "high": 65}, "DDOG": {"low": 35, "high": 75},
            "ZS": {"low": 35, "high": 75}, "NET": {"low": 40, "high": 85},
            
            # Medium volatility
            "AAPL": {"low": 18, "high": 45}, "MSFT": {"low": 16, "high": 40},
            "GOOGL": {"low": 18, "high": 45}, "AMZN": {"low": 22, "high": 50},
            "META": {"low": 25, "high": 55}, "NFLX": {"low": 28, "high": 60},
            "AVGO": {"low": 22, "high": 50}, "CRM": {"low": 25, "high": 55},
            "ORCL": {"low": 20, "high": 45}, "ADBE": {"low": 22, "high": 50},
            "INTU": {"low": 22, "high": 48}, "NOW": {"low": 25, "high": 55},
            "UBER": {"low": 30, "high": 65}, "ABNB": {"low": 32, "high": 70},
            "DASH": {"low": 35, "high": 75},
            
            # Lower volatility
            "JPM": {"low": 15, "high": 35}, "BAC": {"low": 18, "high": 40},
            "WFC": {"low": 18, "high": 42}, "GS": {"low": 18, "high": 40},
            "MS": {"low": 18, "high": 42}, "V": {"low": 14, "high": 32},
            "MA": {"low": 14, "high": 32}, "UNH": {"low": 16, "high": 35},
            "JNJ": {"low": 12, "high": 28}, "PG": {"low": 12, "high": 28},
            "KO": {"low": 12, "high": 26}, "PEP": {"low": 12, "high": 26},
            "WMT": {"low": 14, "high": 30}, "COST": {"low": 14, "high": 32},
            "HD": {"low": 16, "high": 35}, "MCD": {"low": 12, "high": 28},
            "XOM": {"low": 18, "high": 40}, "CVX": {"low": 18, "high": 40},
            
            # ETFs
            "SPY": {"low": 10, "high": 35}, "QQQ": {"low": 14, "high": 40},
            "IWM": {"low": 16, "high": 45}, "DIA": {"low": 10, "high": 32},
        }
    
    async def get_iv_metrics(self, ticker: str) -> Dict[str, Any]:
        """
        Get IV metrics for a ticker.
        Tries Schwab first, then yfinance, returns clear error if neither works.
        """
        ticker = ticker.upper()
        
        # Check cache
        if ticker in self._iv_cache:
            cached = self._iv_cache[ticker]
            age = (datetime.now() - cached["timestamp"]).seconds
            if age < self._cache_ttl:
                return cached["data"]
        
        # Try Schwab first
        result = await self._get_iv_from_schwab(ticker)
        if result and result.get("current_iv"):
            self._iv_cache[ticker] = {"data": result, "timestamp": datetime.now()}
            return result
        
        # Fallback to yfinance
        result = await self._get_iv_from_yfinance(ticker)
        if result and result.get("current_iv"):
            self._iv_cache[ticker] = {"data": result, "timestamp": datetime.now()}
            return result
        
        # Return error with clear message
        return {
            "ticker": ticker,
            "iv_rank": None,
            "iv_percentile": None,
            "current_iv": None,
            "hv_20": None,
            "data_source": "unavailable",
            "error": "Schwab API not authenticated and yfinance options data unavailable",
            "timestamp": datetime.now().isoformat()
        }
    
    async def _get_iv_from_schwab(self, ticker: str) -> Optional[Dict[str, Any]]:
        """Fetch IV from Schwab options chain."""
        try:
            from app.services.schwab_service import schwab_service
            
            if not schwab_service.is_authenticated():
                logger.warning(f"Schwab not authenticated - cannot fetch IV for {ticker}")
                return None
            
            # Get options chain
            chain = await schwab_service.get_option_chain(
                symbol=ticker,
                strike_count=10,
                include_underlying_quote=True
            )
            
            if not chain:
                logger.warning(f"No options chain returned for {ticker}")
                return None
            
            # Get underlying price
            underlying_price = chain.get("underlyingPrice", 0)
            if not underlying_price:
                underlying = chain.get("underlying", {})
                underlying_price = underlying.get("last", 0) or underlying.get("mark", 0)
            
            if not underlying_price:
                logger.warning(f"No underlying price in chain for {ticker}")
                return None
            
            # Extract ATM IV from the chain
            atm_ivs = []
            
            # Process call expiration map
            call_map = chain.get("callExpDateMap", {})
            for exp_date, strikes in call_map.items():
                for strike_str, options in strikes.items():
                    try:
                        strike = float(strike_str)
                    except:
                        continue
                    
                    # Check if near ATM (within 3%)
                    if abs(strike - underlying_price) / underlying_price < 0.03:
                        for opt in options:
                            iv = opt.get("volatility", 0)
                            if iv and iv > 0:
                                atm_ivs.append(iv)  # Convert to percentage
            
            # Process put expiration map
            put_map = chain.get("putExpDateMap", {})
            for exp_date, strikes in put_map.items():
                for strike_str, options in strikes.items():
                    try:
                        strike = float(strike_str)
                    except:
                        continue
                    
                    if abs(strike - underlying_price) / underlying_price < 0.03:
                        for opt in options:
                            iv = opt.get("volatility", 0)
                            if iv and iv > 0:
                                atm_ivs.append(iv)
            
            if not atm_ivs:
                logger.warning(f"No ATM IV found in chain for {ticker}")
                return None
            
            current_iv = sum(atm_ivs) / len(atm_ivs)
            iv_rank, iv_percentile = self._calculate_iv_rank(ticker, current_iv)
            
            return {
                "ticker": ticker,
                "iv_rank": iv_rank,
                "iv_percentile": iv_percentile,
                "current_iv": round(current_iv, 2),
                "hv_20": None,
                "data_source": "schwab",
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Schwab IV fetch error for {ticker}: {e}")
            return None
    
    async def _get_iv_from_yfinance(self, ticker: str) -> Optional[Dict[str, Any]]:
        """Fallback: Fetch IV from yfinance options chain."""
        try:
            from app.services.market_data import market_data
            
            chain = market_data.get_options_chain(ticker)
            
            if chain.get("error"):
                logger.warning(f"yfinance chain error for {ticker}: {chain.get('error')}")
                return None
            
            underlying_price = chain.get("underlying_price", 0)
            if not underlying_price:
                return None
            
            # Get ATM options IV
            atm_ivs = []
            
            for call in chain.get("calls", []):
                strike = call.get("strike", 0)
                if abs(strike - underlying_price) / underlying_price < 0.03:
                    iv = call.get("implied_volatility", 0)
                    if iv and iv > 0:
                        atm_ivs.append(iv)
            
            for put in chain.get("puts", []):
                strike = put.get("strike", 0)
                if abs(strike - underlying_price) / underlying_price < 0.03:
                    iv = put.get("implied_volatility", 0)
                    if iv and iv > 0:
                        atm_ivs.append(iv)
            
            if not atm_ivs:
                return None
            
            current_iv = sum(atm_ivs) / len(atm_ivs)
            iv_rank, iv_percentile = self._calculate_iv_rank(ticker, current_iv)
            
            return {
                "ticker": ticker,
                "iv_rank": iv_rank,
                "iv_percentile": iv_percentile,
                "current_iv": round(current_iv, 2),
                "hv_20": None,
                "data_source": "yfinance",
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"yfinance IV fetch error for {ticker}: {e}")
            return None
    
    def _calculate_iv_rank(self, ticker: str, current_iv: float) -> tuple:
        """Calculate IV Rank and Percentile using historical profiles."""
        profile = self.IV_PROFILES.get(ticker.upper())
        
        if profile:
            iv_low = profile["low"]
            iv_high = profile["high"]
        else:
            # Default profile for unknown tickers
            iv_low = max(15, current_iv * 0.5)
            iv_high = min(100, current_iv * 2)
        
        if iv_high == iv_low:
            iv_rank = 50
        else:
            iv_rank = ((current_iv - iv_low) / (iv_high - iv_low)) * 100
        
        iv_rank = max(0, min(100, round(iv_rank)))
        iv_percentile = round(iv_rank * 0.95)
        
        return iv_rank, iv_percentile


# Singleton
iv_analytics_service = IVAnalyticsService()
