"""
IPMCC Commander - Earnings Service
Fetches earnings dates and provides days-to-earnings calculations.

Sources:
1. Schwab API fundamental data
2. Fallback to cached/estimated data
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
import httpx

logger = logging.getLogger(__name__)


class EarningsService:
    """
    Service for fetching earnings dates and related data.
    Critical for options trading - NEVER sell premium through earnings.
    """
    
    # Known upcoming earnings (updated periodically)
    # Format: ticker -> list of (earnings_date, time_of_day)
    KNOWN_EARNINGS: Dict[str, List[tuple]] = {
        # This would be populated from an earnings calendar API
        # For now, some examples based on typical patterns
    }
    
    # Typical earnings months by ticker (Q1=1,2,3, Q2=4,5,6, etc)
    EARNINGS_PATTERNS: Dict[str, List[int]] = {
        # Tech - typically report in Jan, Apr, Jul, Oct
        "AAPL": [1, 4, 7, 10],
        "MSFT": [1, 4, 7, 10],
        "GOOGL": [1, 4, 7, 10],
        "META": [1, 4, 7, 10],
        "AMZN": [1, 4, 7, 10],
        "NVDA": [2, 5, 8, 11],  # NVDA reports ~3 weeks after quarter end
        "TSLA": [1, 4, 7, 10],
        # Financials - typically mid-month after quarter
        "JPM": [1, 4, 7, 10],
        "BAC": [1, 4, 7, 10],
        "GS": [1, 4, 7, 10],
        "MS": [1, 4, 7, 10],
        # Healthcare
        "JNJ": [1, 4, 7, 10],
        "UNH": [1, 4, 7, 10],
        # Consumer
        "WMT": [2, 5, 8, 11],
        "COST": [3, 6, 9, 12],
        "HD": [2, 5, 8, 11],
        # Energy
        "XOM": [1, 4, 7, 10],
        "CVX": [1, 4, 7, 10],
    }
    
    def __init__(self, schwab_client=None):
        self.schwab_client = schwab_client
        self._cache: Dict[str, Dict] = {}
        self._cache_ttl = 3600  # 1 hour
    
    async def get_earnings_info(self, ticker: str) -> Dict[str, Any]:
        """
        Get earnings information for a ticker.
        
        Returns:
            {
                "ticker": str,
                "next_earnings_date": str (YYYY-MM-DD) or null,
                "days_until": int or null,
                "earnings_time": "before_market" | "after_market" | "unknown",
                "is_confirmed": bool,
                "previous_earnings": str or null,
                "data_source": str
            }
        """
        ticker = ticker.upper()
        
        # Check cache
        if ticker in self._cache:
            cached = self._cache[ticker]
            cache_age = (datetime.now() - cached["cached_at"]).seconds
            if cache_age < self._cache_ttl:
                return cached["data"]
        
        try:
            # Try Schwab fundamental data first
            earnings_data = await self._fetch_from_schwab(ticker)
            
            if earnings_data and earnings_data.get("next_earnings_date"):
                result = self._format_earnings_response(ticker, earnings_data)
                self._cache[ticker] = {"data": result, "cached_at": datetime.now()}
                return result
            
            # Try pattern-based estimation
            estimated = self._estimate_next_earnings(ticker)
            if estimated:
                result = {
                    "ticker": ticker,
                    "next_earnings_date": estimated["date"],
                    "days_until": estimated["days_until"],
                    "earnings_time": "unknown",
                    "is_confirmed": False,
                    "previous_earnings": None,
                    "data_source": "estimated_from_pattern"
                }
                self._cache[ticker] = {"data": result, "cached_at": datetime.now()}
                return result
            
            # No data available
            return {
                "ticker": ticker,
                "next_earnings_date": None,
                "days_until": None,
                "earnings_time": "unknown",
                "is_confirmed": False,
                "previous_earnings": None,
                "data_source": "unavailable"
            }
            
        except Exception as e:
            logger.error(f"Error fetching earnings for {ticker}: {e}")
            return {
                "ticker": ticker,
                "next_earnings_date": None,
                "days_until": None,
                "earnings_time": "unknown",
                "is_confirmed": False,
                "previous_earnings": None,
                "data_source": "error",
                "error": str(e)
            }
    
    async def _fetch_from_schwab(self, ticker: str) -> Optional[Dict]:
        """Fetch earnings data from Schwab API."""
        try:
            if self.schwab_client:
                # Schwab fundamental data includes earnings date
                fundamentals = self.schwab_client.get_fundamentals(ticker)
                if fundamentals:
                    return self._parse_schwab_fundamentals(fundamentals)
            
            # Try internal endpoint
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"http://localhost:8000/api/v1/schwab/fundamentals/{ticker}",
                    timeout=10.0
                )
                if response.status_code == 200:
                    return self._parse_schwab_fundamentals(response.json())
            
            return None
            
        except Exception as e:
            logger.error(f"Error fetching Schwab fundamentals for {ticker}: {e}")
            return None
    
    def _parse_schwab_fundamentals(self, data: Dict) -> Optional[Dict]:
        """Parse earnings info from Schwab fundamental data."""
        try:
            # Schwab format varies - handle different structures
            fundamental = data.get("fundamental", data)
            
            earnings_date = None
            earnings_time = "unknown"
            
            # Look for earnings date in various fields
            if "nextEarningsDate" in fundamental:
                earnings_date = fundamental["nextEarningsDate"]
            elif "earningsDate" in fundamental:
                earnings_date = fundamental["earningsDate"]
            elif "earnings" in fundamental:
                earnings_info = fundamental["earnings"]
                if isinstance(earnings_info, dict):
                    earnings_date = earnings_info.get("earningsDate")
                    earnings_time = earnings_info.get("earningsTime", "unknown")
            
            if not earnings_date:
                return None
            
            # Parse the date
            if isinstance(earnings_date, str):
                # Try various formats
                for fmt in ["%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%m/%d/%Y"]:
                    try:
                        parsed = datetime.strptime(earnings_date.split("T")[0], fmt)
                        earnings_date = parsed.strftime("%Y-%m-%d")
                        break
                    except:
                        continue
            
            return {
                "next_earnings_date": earnings_date,
                "earnings_time": earnings_time
            }
            
        except Exception as e:
            logger.error(f"Error parsing Schwab fundamentals: {e}")
            return None
    
    def _estimate_next_earnings(self, ticker: str) -> Optional[Dict]:
        """
        Estimate next earnings date based on typical patterns.
        Most companies report 2-6 weeks after quarter end.
        """
        pattern = self.EARNINGS_PATTERNS.get(ticker.upper())
        
        if not pattern:
            # Use generic pattern - mid-month of earnings months
            pattern = [1, 4, 7, 10]  # Standard quarterly
        
        today = datetime.now()
        current_month = today.month
        current_day = today.day
        
        # Find next earnings month
        for month in pattern:
            # Check if earnings this month is still upcoming
            if month == current_month and current_day < 25:
                # Estimate mid-month reporting
                estimated_day = 15 + (hash(ticker) % 10)  # Vary by ticker
                estimated_date = datetime(today.year, month, min(estimated_day, 28))
                if estimated_date > today:
                    days_until = (estimated_date - today).days
                    return {
                        "date": estimated_date.strftime("%Y-%m-%d"),
                        "days_until": days_until
                    }
            elif month > current_month:
                estimated_day = 15 + (hash(ticker) % 10)
                estimated_date = datetime(today.year, month, min(estimated_day, 28))
                days_until = (estimated_date - today).days
                return {
                    "date": estimated_date.strftime("%Y-%m-%d"),
                    "days_until": days_until
                }
        
        # Wrap to next year
        next_month = pattern[0]
        estimated_day = 15 + (hash(ticker) % 10)
        estimated_date = datetime(today.year + 1, next_month, min(estimated_day, 28))
        days_until = (estimated_date - today).days
        
        return {
            "date": estimated_date.strftime("%Y-%m-%d"),
            "days_until": days_until
        }
    
    def _format_earnings_response(self, ticker: str, data: Dict) -> Dict[str, Any]:
        """Format earnings data into standard response."""
        earnings_date = data.get("next_earnings_date")
        days_until = None
        
        if earnings_date:
            try:
                if isinstance(earnings_date, str):
                    parsed = datetime.strptime(earnings_date, "%Y-%m-%d")
                else:
                    parsed = earnings_date
                days_until = (parsed - datetime.now()).days
                if days_until < 0:
                    days_until = None
                    earnings_date = None  # Past date
            except:
                pass
        
        return {
            "ticker": ticker,
            "next_earnings_date": earnings_date,
            "days_until": days_until,
            "earnings_time": data.get("earnings_time", "unknown"),
            "is_confirmed": True,
            "previous_earnings": data.get("previous_earnings"),
            "data_source": "schwab_fundamentals"
        }
    
    async def get_earnings_calendar(
        self, 
        tickers: List[str],
        days_ahead: int = 30
    ) -> List[Dict[str, Any]]:
        """
        Get earnings calendar for multiple tickers.
        Returns list sorted by earnings date.
        """
        results = []
        
        for ticker in tickers:
            info = await self.get_earnings_info(ticker)
            if info.get("days_until") is not None and info["days_until"] <= days_ahead:
                results.append(info)
        
        # Sort by days until earnings
        results.sort(key=lambda x: x.get("days_until") or 999)
        
        return results
    
    def is_earnings_soon(self, ticker: str, days_threshold: int = 14) -> bool:
        """
        Quick check if earnings are within threshold.
        Uses cache only - no async call.
        """
        if ticker.upper() in self._cache:
            cached = self._cache[ticker.upper()]["data"]
            days_until = cached.get("days_until")
            if days_until is not None:
                return days_until <= days_threshold
        return False


# Singleton instance
earnings_service = EarningsService()
