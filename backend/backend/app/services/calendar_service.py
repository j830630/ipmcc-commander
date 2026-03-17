"""
IPMCC Commander - Economic Calendar Service
Fetches economic events similar to ForexFactory using FREE APIs
"""

import httpx
import asyncio
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
import logging
import os

logger = logging.getLogger(__name__)


class EconomicCalendarService:
    """
    Fetches economic calendar events from free APIs.
    Primary: Finnhub (60 requests/minute free tier)
    Fallback: Trading Economics (limited free access)
    """
    
    def __init__(self):
        # Finnhub free API key - users should replace with their own
        self.finnhub_api_key = os.getenv("FINNHUB_API_KEY", "demo")
        self.cache = {}
        self.cache_ttl = 1800  # 30 minutes cache (events don't change often)
        self.last_fetch = {}
    
    def _is_cache_valid(self, key: str) -> bool:
        if key not in self.cache or key not in self.last_fetch:
            return False
        elapsed = (datetime.now() - self.last_fetch[key]).total_seconds()
        return elapsed < self.cache_ttl
    
    def _get_impact_level(self, impact: int) -> str:
        """Convert numeric impact to text."""
        if impact == 3:
            return "high"
        elif impact == 2:
            return "medium"
        else:
            return "low"
    
    def _get_impact_color(self, impact: str) -> str:
        """Get color for impact level (ForexFactory style)."""
        colors = {
            "high": "#FF0000",      # Red
            "medium": "#FFA500",    # Orange
            "low": "#FFFF00"        # Yellow
        }
        return colors.get(impact, "#808080")
    
    async def get_economic_calendar(
        self, 
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        country: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Fetch economic calendar events from Finnhub.
        
        Args:
            from_date: Start date (YYYY-MM-DD), defaults to today
            to_date: End date (YYYY-MM-DD), defaults to 7 days from now
            country: Filter by country code (US, EU, GB, JP, AU, etc.)
        """
        if not from_date:
            from_date = date.today().isoformat()
        if not to_date:
            to_date = (date.today() + timedelta(days=7)).isoformat()
        
        cache_key = f"calendar_{from_date}_{to_date}_{country}"
        if self._is_cache_valid(cache_key):
            return self.cache[cache_key]
        
        try:
            url = "https://finnhub.io/api/v1/calendar/economic"
            params = {
                "from": from_date,
                "to": to_date,
                "token": self.finnhub_api_key
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params, timeout=15)
                
                if response.status_code == 200:
                    data = response.json()
                    events = data.get("economicCalendar", [])
                    
                    # Process and enhance events
                    processed_events = []
                    for event in events:
                        impact_num = event.get("impact", 1)
                        impact_level = self._get_impact_level(impact_num)
                        
                        # Filter by country if specified
                        event_country = event.get("country", "")
                        if country and event_country != country:
                            continue
                        
                        processed_event = {
                            "id": event.get("id"),
                            "time": event.get("time", ""),
                            "country": event_country,
                            "event": event.get("event", ""),
                            "impact": impact_level,
                            "impact_color": self._get_impact_color(impact_level),
                            "actual": event.get("actual"),
                            "estimate": event.get("estimate"),
                            "previous": event.get("prev"),
                            "unit": event.get("unit", ""),
                            "currency": self._get_currency_for_country(event_country)
                        }
                        processed_events.append(processed_event)
                    
                    # Sort by time
                    processed_events.sort(key=lambda x: x.get("time", ""))
                    
                    # Group by date
                    grouped = {}
                    for event in processed_events:
                        event_date = event["time"][:10] if event["time"] else "Unknown"
                        if event_date not in grouped:
                            grouped[event_date] = []
                        grouped[event_date].append(event)
                    
                    result = {
                        "events": processed_events,
                        "grouped_by_date": grouped,
                        "total_count": len(processed_events),
                        "high_impact_count": len([e for e in processed_events if e["impact"] == "high"]),
                        "from_date": from_date,
                        "to_date": to_date,
                        "timestamp": datetime.now().isoformat(),
                        "error": None
                    }
                    
                    self.cache[cache_key] = result
                    self.last_fetch[cache_key] = datetime.now()
                    return result
                    
        except Exception as e:
            logger.error(f"Error fetching economic calendar: {e}")
        
        return {
            "events": [],
            "grouped_by_date": {},
            "total_count": 0,
            "error": "Failed to fetch economic calendar",
            "timestamp": datetime.now().isoformat()
        }
    
    async def get_todays_events(self, country: Optional[str] = None) -> Dict[str, Any]:
        """Get only today's economic events."""
        today = date.today().isoformat()
        return await self.get_economic_calendar(from_date=today, to_date=today, country=country)
    
    async def get_high_impact_events(self, days: int = 7) -> Dict[str, Any]:
        """Get only high-impact events for the next N days."""
        from_date = date.today().isoformat()
        to_date = (date.today() + timedelta(days=days)).isoformat()
        
        result = await self.get_economic_calendar(from_date=from_date, to_date=to_date)
        
        if result.get("error"):
            return result
        
        # Filter to high impact only
        high_impact = [e for e in result["events"] if e["impact"] == "high"]
        
        # Re-group
        grouped = {}
        for event in high_impact:
            event_date = event["time"][:10] if event["time"] else "Unknown"
            if event_date not in grouped:
                grouped[event_date] = []
            grouped[event_date].append(event)
        
        return {
            "events": high_impact,
            "grouped_by_date": grouped,
            "total_count": len(high_impact),
            "from_date": from_date,
            "to_date": to_date,
            "timestamp": datetime.now().isoformat(),
            "error": None
        }
    
    def _get_currency_for_country(self, country: str) -> str:
        """Map country code to currency."""
        currency_map = {
            "US": "USD",
            "EU": "EUR",
            "GB": "GBP",
            "JP": "JPY",
            "AU": "AUD",
            "CA": "CAD",
            "CH": "CHF",
            "NZ": "NZD",
            "CN": "CNY",
        }
        return currency_map.get(country, country)
    
    def get_important_events_today(self) -> List[Dict[str, Any]]:
        """
        Get a curated list of today's most important events.
        This is a static list of key recurring events to watch.
        """
        return [
            {"name": "Non-Farm Payrolls", "country": "US", "frequency": "Monthly (1st Friday)", "impact": "high"},
            {"name": "FOMC Rate Decision", "country": "US", "frequency": "8x/year", "impact": "high"},
            {"name": "CPI (Consumer Price Index)", "country": "US", "frequency": "Monthly", "impact": "high"},
            {"name": "PPI (Producer Price Index)", "country": "US", "frequency": "Monthly", "impact": "medium"},
            {"name": "Retail Sales", "country": "US", "frequency": "Monthly", "impact": "high"},
            {"name": "GDP (Gross Domestic Product)", "country": "US", "frequency": "Quarterly", "impact": "high"},
            {"name": "ISM Manufacturing PMI", "country": "US", "frequency": "Monthly", "impact": "high"},
            {"name": "ISM Services PMI", "country": "US", "frequency": "Monthly", "impact": "high"},
            {"name": "Initial Jobless Claims", "country": "US", "frequency": "Weekly (Thursday)", "impact": "medium"},
            {"name": "Consumer Confidence", "country": "US", "frequency": "Monthly", "impact": "medium"},
        ]


# Singleton instance
calendar_service = EconomicCalendarService()
