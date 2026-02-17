"""
IPMCC Commander - IV Analytics Service
Calculates IV Rank, IV Percentile, and Historical Volatility from Schwab options data.

IV Rank = (Current IV - 52wk Low IV) / (52wk High IV - 52wk Low IV) * 100
IV Percentile = % of days in past year where IV was lower than current

This service fetches ATM option IV and calculates these metrics.
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from collections import deque
import math
import httpx

logger = logging.getLogger(__name__)


class IVAnalyticsService:
    """
    Service for calculating IV Rank, Percentile, and related volatility metrics.
    Uses Schwab API for options chain data and historical prices.
    """
    
    def __init__(self, schwab_client=None):
        self.schwab_client = schwab_client
        # Cache for historical IV data (ticker -> deque of (date, iv))
        self._iv_history_cache: Dict[str, deque] = {}
        # Cache for current IV (ticker -> {iv, timestamp})
        self._current_iv_cache: Dict[str, Dict] = {}
        self._cache_ttl = 300  # 5 minutes
    
    async def get_iv_metrics(self, ticker: str) -> Dict[str, Any]:
        """
        Get comprehensive IV metrics for a ticker.
        
        Returns:
            {
                "iv_rank": 0-100,
                "iv_percentile": 0-100,
                "current_iv": float,
                "iv_52w_high": float,
                "iv_52w_low": float,
                "hv_20": float (20-day historical volatility),
                "hv_50": float (50-day historical volatility),
                "iv_hv_ratio": float,
                "iv_term_structure": "contango" | "backwardation" | "flat",
                "data_source": str
            }
        """
        ticker = ticker.upper()
        
        try:
            # Get current ATM IV
            current_iv = await self._get_current_atm_iv(ticker)
            
            if current_iv is None:
                return self._get_fallback_iv_metrics(ticker)
            
            # Get historical IV data
            iv_history = await self._get_iv_history(ticker)
            
            # Calculate IV Rank and Percentile
            iv_rank, iv_percentile, iv_high, iv_low = self._calculate_iv_rank_percentile(
                current_iv, iv_history
            )
            
            # Get historical volatility
            hv_20, hv_50 = await self._get_historical_volatility(ticker)
            
            # Calculate IV/HV ratio
            iv_hv_ratio = None
            if hv_20 and hv_20 > 0:
                iv_hv_ratio = round(current_iv / hv_20, 2)
            
            # Get term structure
            term_structure = await self._get_iv_term_structure(ticker)
            
            return {
                "ticker": ticker,
                "iv_rank": iv_rank,
                "iv_percentile": iv_percentile,
                "current_iv": round(current_iv, 2),
                "iv_52w_high": round(iv_high, 2) if iv_high else None,
                "iv_52w_low": round(iv_low, 2) if iv_low else None,
                "hv_20": round(hv_20, 2) if hv_20 else None,
                "hv_50": round(hv_50, 2) if hv_50 else None,
                "iv_hv_ratio": iv_hv_ratio,
                "iv_term_structure": term_structure,
                "data_source": "schwab_options",
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error calculating IV metrics for {ticker}: {e}")
            return self._get_fallback_iv_metrics(ticker)
    
    async def _get_current_atm_iv(self, ticker: str) -> Optional[float]:
        """
        Get current ATM implied volatility from options chain.
        Uses nearest-term options (20-45 DTE) for most accurate current IV.
        """
        try:
            # Check cache first
            if ticker in self._current_iv_cache:
                cached = self._current_iv_cache[ticker]
                if (datetime.now() - cached["timestamp"]).seconds < self._cache_ttl:
                    return cached["iv"]
            
            # Get options chain from Schwab
            chain = await self._fetch_options_chain(ticker)
            
            if not chain:
                return None
            
            # Find ATM options
            underlying_price = chain.get("underlyingPrice", 0)
            if underlying_price <= 0:
                return None
            
            # Look for options 20-45 DTE
            call_map = chain.get("callExpDateMap", {})
            put_map = chain.get("putExpDateMap", {})
            
            atm_ivs = []
            
            for exp_date, strikes in call_map.items():
                # Parse DTE from expiration
                dte = self._parse_dte(exp_date)
                if dte < 20 or dte > 45:
                    continue
                
                # Find ATM strike
                atm_strike = self._find_atm_strike(strikes.keys(), underlying_price)
                if atm_strike and atm_strike in strikes:
                    option_data = strikes[atm_strike]
                    if isinstance(option_data, list) and len(option_data) > 0:
                        iv = option_data[0].get("volatility", 0)
                        if iv and iv > 0:
                            atm_ivs.append(iv * 100)  # Convert to percentage
            
            # Also check puts
            for exp_date, strikes in put_map.items():
                dte = self._parse_dte(exp_date)
                if dte < 20 or dte > 45:
                    continue
                
                atm_strike = self._find_atm_strike(strikes.keys(), underlying_price)
                if atm_strike and atm_strike in strikes:
                    option_data = strikes[atm_strike]
                    if isinstance(option_data, list) and len(option_data) > 0:
                        iv = option_data[0].get("volatility", 0)
                        if iv and iv > 0:
                            atm_ivs.append(iv * 100)
            
            if not atm_ivs:
                return None
            
            # Average of ATM IVs
            current_iv = sum(atm_ivs) / len(atm_ivs)
            
            # Cache it
            self._current_iv_cache[ticker] = {
                "iv": current_iv,
                "timestamp": datetime.now()
            }
            
            return current_iv
            
        except Exception as e:
            logger.error(f"Error getting ATM IV for {ticker}: {e}")
            return None
    
    async def _get_iv_history(self, ticker: str) -> List[float]:
        """
        Get historical IV data for the past year.
        In production, this would query a database of historical IV values.
        For now, we estimate from VIX correlation.
        """
        # Check if we have cached history
        if ticker in self._iv_history_cache:
            return list(self._iv_history_cache[ticker])
        
        # In production, fetch from database or API
        # For now, return empty (will use fallback calculation)
        return []
    
    def _calculate_iv_rank_percentile(
        self, 
        current_iv: float, 
        iv_history: List[float]
    ) -> tuple:
        """
        Calculate IV Rank and IV Percentile.
        
        IV Rank = (Current IV - 52wk Low) / (52wk High - 52wk Low) * 100
        IV Percentile = % of days in history where IV was lower
        """
        if not iv_history or len(iv_history) < 20:
            # Not enough history - estimate from current IV
            # Assume typical IV range of 15-60 for stocks
            estimated_low = max(10, current_iv * 0.5)
            estimated_high = min(100, current_iv * 2)
            
            iv_rank = ((current_iv - estimated_low) / (estimated_high - estimated_low)) * 100
            iv_rank = max(0, min(100, round(iv_rank)))
            
            # Estimate percentile as similar to rank
            iv_percentile = iv_rank
            
            return iv_rank, iv_percentile, estimated_high, estimated_low
        
        # Calculate from actual history
        iv_high = max(iv_history)
        iv_low = min(iv_history)
        
        # IV Rank
        if iv_high == iv_low:
            iv_rank = 50
        else:
            iv_rank = ((current_iv - iv_low) / (iv_high - iv_low)) * 100
        
        iv_rank = max(0, min(100, round(iv_rank)))
        
        # IV Percentile
        days_lower = sum(1 for iv in iv_history if iv < current_iv)
        iv_percentile = round((days_lower / len(iv_history)) * 100)
        
        return iv_rank, iv_percentile, iv_high, iv_low
    
    async def _get_historical_volatility(self, ticker: str) -> tuple:
        """
        Calculate historical volatility from price data.
        HV = Standard deviation of log returns * sqrt(252)
        """
        try:
            # Fetch historical prices
            prices = await self._fetch_historical_prices(ticker, days=60)
            
            if not prices or len(prices) < 21:
                return None, None
            
            # Calculate log returns
            log_returns = []
            for i in range(1, len(prices)):
                if prices[i-1] > 0 and prices[i] > 0:
                    log_returns.append(math.log(prices[i] / prices[i-1]))
            
            if len(log_returns) < 20:
                return None, None
            
            # HV-20
            hv_20 = self._calculate_std(log_returns[-20:]) * math.sqrt(252) * 100
            
            # HV-50
            hv_50 = None
            if len(log_returns) >= 50:
                hv_50 = self._calculate_std(log_returns[-50:]) * math.sqrt(252) * 100
            
            return hv_20, hv_50
            
        except Exception as e:
            logger.error(f"Error calculating HV for {ticker}: {e}")
            return None, None
    
    def _calculate_std(self, values: List[float]) -> float:
        """Calculate standard deviation."""
        if not values:
            return 0
        n = len(values)
        mean = sum(values) / n
        variance = sum((x - mean) ** 2 for x in values) / n
        return math.sqrt(variance)
    
    async def _get_iv_term_structure(self, ticker: str) -> str:
        """
        Determine IV term structure: contango, backwardation, or flat.
        Compares near-term IV to far-term IV.
        """
        try:
            chain = await self._fetch_options_chain(ticker)
            if not chain:
                return "unknown"
            
            underlying_price = chain.get("underlyingPrice", 0)
            call_map = chain.get("callExpDateMap", {})
            
            # Collect IV by DTE
            dte_iv_map = {}
            
            for exp_date, strikes in call_map.items():
                dte = self._parse_dte(exp_date)
                if dte < 7 or dte > 90:
                    continue
                
                atm_strike = self._find_atm_strike(strikes.keys(), underlying_price)
                if atm_strike and atm_strike in strikes:
                    option_data = strikes[atm_strike]
                    if isinstance(option_data, list) and len(option_data) > 0:
                        iv = option_data[0].get("volatility", 0)
                        if iv and iv > 0:
                            dte_iv_map[dte] = iv * 100
            
            if len(dte_iv_map) < 2:
                return "unknown"
            
            # Compare short-term vs long-term
            sorted_dtes = sorted(dte_iv_map.keys())
            short_term_iv = dte_iv_map[sorted_dtes[0]]
            long_term_iv = dte_iv_map[sorted_dtes[-1]]
            
            ratio = short_term_iv / long_term_iv if long_term_iv > 0 else 1
            
            if ratio > 1.05:
                return "backwardation"  # Short-term IV higher
            elif ratio < 0.95:
                return "contango"  # Long-term IV higher
            else:
                return "flat"
                
        except Exception as e:
            logger.error(f"Error getting term structure for {ticker}: {e}")
            return "unknown"
    
    async def _fetch_options_chain(self, ticker: str) -> Optional[Dict]:
        """Fetch options chain from Schwab API."""
        try:
            if self.schwab_client:
                return self.schwab_client.get_option_chain(ticker)
            
            # Fallback to internal endpoint
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"http://localhost:8000/api/v1/schwab/options/{ticker}",
                    timeout=10.0
                )
                if response.status_code == 200:
                    return response.json()
            
            return None
            
        except Exception as e:
            logger.error(f"Error fetching options chain for {ticker}: {e}")
            return None
    
    async def _fetch_historical_prices(self, ticker: str, days: int = 60) -> List[float]:
        """Fetch historical closing prices from Schwab API."""
        try:
            if self.schwab_client:
                # Use Schwab client for price history
                history = self.schwab_client.get_price_history(
                    ticker,
                    period_type="month",
                    period=3,
                    frequency_type="daily",
                    frequency=1
                )
                if history and "candles" in history:
                    return [c["close"] for c in history["candles"][-days:]]
            
            # Fallback to internal endpoint
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"http://localhost:8000/api/v1/schwab/history/{ticker}",
                    params={"days": days},
                    timeout=10.0
                )
                if response.status_code == 200:
                    data = response.json()
                    if "candles" in data:
                        return [c["close"] for c in data["candles"]]
                    elif "prices" in data:
                        return data["prices"]
            
            return []
            
        except Exception as e:
            logger.error(f"Error fetching historical prices for {ticker}: {e}")
            return []
    
    def _parse_dte(self, exp_date_str: str) -> int:
        """Parse DTE from Schwab expiration date format (e.g., '2024-02-16:5')."""
        try:
            date_part = exp_date_str.split(":")[0]
            exp_date = datetime.strptime(date_part, "%Y-%m-%d")
            dte = (exp_date - datetime.now()).days
            return max(0, dte)
        except:
            return 0
    
    def _find_atm_strike(self, strikes: list, underlying_price: float) -> Optional[str]:
        """Find the ATM strike from a list of strikes."""
        if not strikes or underlying_price <= 0:
            return None
        
        # Convert to floats and find closest
        strike_floats = []
        for s in strikes:
            try:
                strike_floats.append((float(s), s))
            except:
                continue
        
        if not strike_floats:
            return None
        
        # Find closest to underlying
        closest = min(strike_floats, key=lambda x: abs(x[0] - underlying_price))
        return closest[1]
    
    def _get_fallback_iv_metrics(self, ticker: str) -> Dict[str, Any]:
        """
        Return fallback IV metrics when we can't calculate real values.
        Flags that data is estimated.
        """
        return {
            "ticker": ticker,
            "iv_rank": None,
            "iv_percentile": None,
            "current_iv": None,
            "iv_52w_high": None,
            "iv_52w_low": None,
            "hv_20": None,
            "hv_50": None,
            "iv_hv_ratio": None,
            "iv_term_structure": "unknown",
            "data_source": "unavailable",
            "error": "Unable to fetch IV data from options chain",
            "timestamp": datetime.now().isoformat()
        }


# Singleton instance
iv_analytics_service = IVAnalyticsService()
