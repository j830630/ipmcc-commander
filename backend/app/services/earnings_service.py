"""
IPMCC Commander - Earnings Calendar Service
Fetches and tracks earnings dates for portfolio tickers
FIXED: Cache service instantiation and async compatibility
"""

import logging
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
import yfinance as yf
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.history import EarningsEvent
from app.services.cache_service import CacheService

logger = logging.getLogger(__name__)

# Create a singleton cache instance
_cache = CacheService()


class EarningsCalendarService:
    """
    Fetches and manages earnings calendar data.
    Warns about positions with upcoming earnings risk.
    """
    
    # Cache TTL for earnings data (6 hours)
    CACHE_TTL = 6 * 60 * 60
    
    def __init__(self, db: Optional[Session] = None):
        self.db = db
        self.cache = _cache
    
    def get_earnings_date(self, ticker: str) -> Optional[Dict[str, Any]]:
        """
        Get upcoming earnings date for a ticker.
        Uses Yahoo Finance calendar data.
        """
        cache_key = f"earnings:{ticker}"
        
        # Check cache first
        try:
            cached = self.cache.get(cache_key)
            if cached:
                return cached
        except Exception as e:
            logger.debug(f"Cache miss or error for {ticker}: {e}")
        
        try:
            stock = yf.Ticker(ticker)
            calendar = stock.calendar
            
            if calendar is None or (hasattr(calendar, 'empty') and calendar.empty):
                # No earnings data available
                result = {
                    "ticker": ticker,
                    "earnings_date": None,
                    "has_earnings": False,
                    "source": "yahoo_finance"
                }
                try:
                    self.cache.set(cache_key, result, ttl=self.CACHE_TTL)
                except:
                    pass
                return result
            
            # Extract earnings date
            earnings_date = None
            earnings_time = None
            
            if 'Earnings Date' in calendar.index:
                earnings_dates = calendar.loc['Earnings Date']
                if hasattr(earnings_dates, '__iter__') and not isinstance(earnings_dates, str):
                    # Multiple dates (range)
                    if len(earnings_dates) > 0:
                        earnings_date = earnings_dates.iloc[0]
                else:
                    earnings_date = earnings_dates
                
                # Convert to string if it's a timestamp
                if hasattr(earnings_date, 'strftime'):
                    earnings_date = earnings_date.strftime('%Y-%m-%d')
                elif hasattr(earnings_date, 'isoformat'):
                    earnings_date = earnings_date.isoformat()[:10]
            
            # Get estimates if available
            eps_estimate = None
            revenue_estimate = None
            
            if 'Earnings Average' in calendar.index:
                eps_estimate = calendar.loc['Earnings Average']
                if hasattr(eps_estimate, 'iloc'):
                    eps_estimate = float(eps_estimate.iloc[0]) if len(eps_estimate) > 0 else None
                else:
                    eps_estimate = float(eps_estimate) if eps_estimate else None
            
            if 'Revenue Average' in calendar.index:
                revenue_estimate = calendar.loc['Revenue Average']
                if hasattr(revenue_estimate, 'iloc'):
                    revenue_estimate = float(revenue_estimate.iloc[0]) if len(revenue_estimate) > 0 else None
                else:
                    revenue_estimate = float(revenue_estimate) if revenue_estimate else None
            
            result = {
                "ticker": ticker,
                "earnings_date": earnings_date,
                "earnings_time": earnings_time,
                "has_earnings": earnings_date is not None,
                "eps_estimate": eps_estimate,
                "revenue_estimate": revenue_estimate,
                "source": "yahoo_finance",
                "fetched_at": datetime.now().isoformat()
            }
            
            # Calculate days until earnings
            if earnings_date:
                try:
                    if isinstance(earnings_date, str):
                        earnings_dt = date.fromisoformat(earnings_date)
                    else:
                        earnings_dt = earnings_date
                    days_until = (earnings_dt - date.today()).days
                    result["days_until"] = days_until
                except:
                    result["days_until"] = None
            
            try:
                self.cache.set(cache_key, result, ttl=self.CACHE_TTL)
            except:
                pass
            return result
            
        except Exception as e:
            logger.warning(f"Error fetching earnings for {ticker}: {e}")
            return {
                "ticker": ticker,
                "earnings_date": None,
                "has_earnings": False,
                "error": str(e),
                "source": "yahoo_finance"
            }
    
    def get_earnings_for_tickers(self, tickers: List[str]) -> Dict[str, Dict[str, Any]]:
        """Get earnings dates for multiple tickers."""
        results = {}
        for ticker in tickers:
            results[ticker] = self.get_earnings_date(ticker)
        return results
    
    def check_earnings_risk(
        self, 
        ticker: str, 
        option_expiration: str,
        warning_days: int = 7
    ) -> Dict[str, Any]:
        """
        Check if there's an earnings risk for a position.
        Returns warning if earnings fall before or near option expiration.
        """
        earnings_data = self.get_earnings_date(ticker)
        
        if not earnings_data or not earnings_data.get("earnings_date"):
            return {
                "ticker": ticker,
                "has_risk": False,
                "reason": "No earnings date found"
            }
        
        try:
            earnings_date = date.fromisoformat(earnings_data["earnings_date"])
            exp_date = date.fromisoformat(option_expiration)
            today = date.today()
            
            days_until_earnings = (earnings_date - today).days
            days_until_expiration = (exp_date - today).days
            
            # Check if earnings is before expiration
            if earnings_date <= exp_date:
                risk_level = "high" if days_until_earnings <= 7 else "medium"
                return {
                    "ticker": ticker,
                    "has_risk": True,
                    "risk_level": risk_level,
                    "earnings_date": earnings_data["earnings_date"],
                    "option_expiration": option_expiration,
                    "days_until_earnings": days_until_earnings,
                    "reason": f"Earnings on {earnings_data['earnings_date']} falls BEFORE option expiration",
                    "recommendation": "Consider closing position before earnings or rolling to post-earnings expiration"
                }
            
            # Check if earnings is within warning window after expiration
            elif (earnings_date - exp_date).days <= warning_days:
                return {
                    "ticker": ticker,
                    "has_risk": True,
                    "risk_level": "low",
                    "earnings_date": earnings_data["earnings_date"],
                    "option_expiration": option_expiration,
                    "days_until_earnings": days_until_earnings,
                    "reason": f"Earnings on {earnings_data['earnings_date']} is close to option expiration",
                    "recommendation": "Monitor position closely, IV may be elevated"
                }
            
            return {
                "ticker": ticker,
                "has_risk": False,
                "earnings_date": earnings_data["earnings_date"],
                "option_expiration": option_expiration,
                "days_until_earnings": days_until_earnings,
                "reason": "Earnings is after option expiration window"
            }
            
        except Exception as e:
            logger.error(f"Error checking earnings risk for {ticker}: {e}")
            return {
                "ticker": ticker,
                "has_risk": False,
                "error": str(e)
            }
    
    def get_upcoming_earnings(
        self, 
        tickers: List[str], 
        days_ahead: int = 30
    ) -> List[Dict[str, Any]]:
        """
        Get all upcoming earnings for given tickers within specified days.
        Returns sorted list by earnings date.
        """
        upcoming = []
        cutoff_date = date.today() + timedelta(days=days_ahead)
        
        for ticker in tickers:
            earnings = self.get_earnings_date(ticker)
            if earnings and earnings.get("earnings_date"):
                try:
                    earnings_date = date.fromisoformat(earnings["earnings_date"])
                    if date.today() <= earnings_date <= cutoff_date:
                        upcoming.append({
                            "ticker": ticker,
                            "earnings_date": earnings["earnings_date"],
                            "days_until": earnings.get("days_until"),
                            "eps_estimate": earnings.get("eps_estimate"),
                            "revenue_estimate": earnings.get("revenue_estimate"),
                        })
                except:
                    pass
        
        # Sort by date
        upcoming.sort(key=lambda x: x["earnings_date"])
        return upcoming
    
    async def save_earnings_event_async(self, db: AsyncSession, earnings_data: Dict[str, Any]) -> Optional[EarningsEvent]:
        """Save or update earnings event in database (async version)."""
        if not earnings_data.get("earnings_date"):
            return None
        
        # Check if already exists
        stmt = select(EarningsEvent).filter(
            EarningsEvent.ticker == earnings_data["ticker"],
            EarningsEvent.earnings_date == earnings_data["earnings_date"]
        )
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()
        
        if existing:
            # Update existing
            existing.eps_estimate = earnings_data.get("eps_estimate")
            existing.revenue_estimate = earnings_data.get("revenue_estimate")
            existing.updated_at = datetime.now().isoformat()
            await db.commit()
            return existing
        else:
            # Create new
            event = EarningsEvent(
                ticker=earnings_data["ticker"],
                earnings_date=earnings_data["earnings_date"],
                earnings_time=earnings_data.get("earnings_time"),
                eps_estimate=earnings_data.get("eps_estimate"),
                revenue_estimate=earnings_data.get("revenue_estimate"),
                source=earnings_data.get("source", "yahoo_finance"),
            )
            db.add(event)
            await db.commit()
            await db.refresh(event)
            return event
    
    def save_earnings_event(self, earnings_data: Dict[str, Any]) -> Optional[EarningsEvent]:
        """Save or update earnings event in database (sync version - legacy)."""
        if not self.db or not earnings_data.get("earnings_date"):
            return None
        
        # Check if already exists
        existing = self.db.query(EarningsEvent).filter(
            EarningsEvent.ticker == earnings_data["ticker"],
            EarningsEvent.earnings_date == earnings_data["earnings_date"]
        ).first()
        
        if existing:
            # Update existing
            existing.eps_estimate = earnings_data.get("eps_estimate")
            existing.revenue_estimate = earnings_data.get("revenue_estimate")
            existing.updated_at = datetime.now().isoformat()
            self.db.commit()
            return existing
        else:
            # Create new
            event = EarningsEvent(
                ticker=earnings_data["ticker"],
                earnings_date=earnings_data["earnings_date"],
                earnings_time=earnings_data.get("earnings_time"),
                eps_estimate=earnings_data.get("eps_estimate"),
                revenue_estimate=earnings_data.get("revenue_estimate"),
                source=earnings_data.get("source", "yahoo_finance"),
            )
            self.db.add(event)
            self.db.commit()
            self.db.refresh(event)
            return event


# Singleton instance
earnings_calendar_service = EarningsCalendarService()
