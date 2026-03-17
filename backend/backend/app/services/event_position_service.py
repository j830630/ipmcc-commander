"""
IPMCC Commander - Position Event Service
Handles earnings and events for longer-term positions (IPMCC, 112, Strangles)
Checks if earnings fall before option expiration.
"""

import logging
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
import yfinance as yf

from app.services.cache_service import cache_service

logger = logging.getLogger(__name__)


class PositionEventService:
    """
    Service for checking events related to open positions.
    
    Key checks:
    - Does earnings fall BEFORE option expiration? (High risk)
    - Is earnings within a week of expiration? (Elevated IV risk)
    - Are there upcoming earnings for portfolio tickers?
    """
    
    # Cache TTL for earnings data (6 hours)
    CACHE_TTL = 6 * 60 * 60
    
    def __init__(self):
        pass
    
    # =========================================================================
    # EARNINGS DATA
    # =========================================================================
    
    def get_earnings_date(self, ticker: str) -> Optional[Dict[str, Any]]:
        """
        Get upcoming earnings date for a ticker.
        Uses Yahoo Finance calendar data.
        """
        cache_key = f"earnings_position:{ticker}"
        
        # Check cache
        try:
            cached = cache_service.get(cache_key)
            if cached:
                return cached
        except Exception:
            pass
        
        try:
            stock = yf.Ticker(ticker)
            calendar = stock.calendar
            
            if calendar is None or (hasattr(calendar, 'empty') and calendar.empty):
                result = {
                    "ticker": ticker,
                    "earnings_date": None,
                    "has_earnings": False,
                    "source": "yahoo_finance"
                }
                try:
                    cache_service.set(cache_key, result, ttl=self.CACHE_TTL)
                except:
                    pass
                return result
            
            # Extract earnings date
            earnings_date = None
            
            if 'Earnings Date' in calendar.index:
                earnings_dates = calendar.loc['Earnings Date']
                if hasattr(earnings_dates, '__iter__') and not isinstance(earnings_dates, str):
                    if len(earnings_dates) > 0:
                        earnings_date = earnings_dates.iloc[0]
                else:
                    earnings_date = earnings_dates
                
                # Convert to string
                if hasattr(earnings_date, 'strftime'):
                    earnings_date = earnings_date.strftime('%Y-%m-%d')
                elif hasattr(earnings_date, 'isoformat'):
                    earnings_date = earnings_date.isoformat()[:10]
            
            # Get estimates
            eps_estimate = None
            if 'Earnings Average' in calendar.index:
                eps_est = calendar.loc['Earnings Average']
                if hasattr(eps_est, 'iloc'):
                    eps_estimate = float(eps_est.iloc[0]) if len(eps_est) > 0 else None
                else:
                    eps_estimate = float(eps_est) if eps_est else None
            
            result = {
                "ticker": ticker,
                "earnings_date": earnings_date,
                "has_earnings": earnings_date is not None,
                "eps_estimate": eps_estimate,
                "source": "yahoo_finance",
                "fetched_at": datetime.now().isoformat()
            }
            
            # Calculate days until
            if earnings_date:
                try:
                    earnings_dt = date.fromisoformat(earnings_date) if isinstance(earnings_date, str) else earnings_date
                    result["days_until"] = (earnings_dt - date.today()).days
                except:
                    pass
            
            try:
                cache_service.set(cache_key, result, ttl=self.CACHE_TTL)
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
    
    # =========================================================================
    # POSITION RISK CHECKS
    # =========================================================================
    
    def check_position_earnings_risk(
        self,
        ticker: str,
        expiration_date: str,
        strategy: str = "ipmcc"
    ) -> Dict[str, Any]:
        """
        Check if earnings poses a risk to a specific position.
        
        Risk levels:
        - HIGH: Earnings BEFORE expiration
        - MEDIUM: Earnings within 7 days of expiration
        - LOW: Earnings after expiration but close
        - NONE: Earnings well after expiration or no earnings
        
        Strategy-specific considerations:
        - IPMCC: Earnings before expiration = potential assignment risk
        - 112: Earnings volatility can blow through short strikes
        - Strangle: Undefined risk + earnings = dangerous
        """
        earnings = self.get_earnings_date(ticker)
        
        if not earnings or not earnings.get("earnings_date"):
            return {
                "ticker": ticker,
                "has_risk": False,
                "risk_level": "none",
                "reason": "No earnings date found",
                "recommendation": None
            }
        
        try:
            earnings_date = date.fromisoformat(earnings["earnings_date"])
            exp_date = date.fromisoformat(expiration_date)
            today = date.today()
            
            days_until_earnings = (earnings_date - today).days
            days_until_expiration = (exp_date - today).days
            days_diff = (earnings_date - exp_date).days
            
            result = {
                "ticker": ticker,
                "earnings_date": earnings["earnings_date"],
                "expiration_date": expiration_date,
                "days_until_earnings": days_until_earnings,
                "days_until_expiration": days_until_expiration,
                "strategy": strategy
            }
            
            # CASE 1: Earnings BEFORE expiration (HIGH RISK)
            if earnings_date < exp_date:
                result["has_risk"] = True
                result["risk_level"] = "high"
                result["reason"] = f"Earnings on {earnings['earnings_date']} falls BEFORE expiration"
                
                # Strategy-specific recommendations
                if strategy == "ipmcc":
                    result["recommendation"] = (
                        "Close covered call before earnings OR roll to post-earnings expiration. "
                        "Risk: IV crush + potential large move could result in assignment or loss."
                    )
                elif strategy == "112":
                    result["recommendation"] = (
                        "Close or roll the 112 before earnings. "
                        "Earnings move could exceed short strike buffer."
                    )
                elif strategy == "strangle":
                    result["recommendation"] = (
                        "CLOSE IMMEDIATELY. Naked strangle + earnings = undefined large risk. "
                        "Consider converting to iron condor or closing entirely."
                    )
                else:
                    result["recommendation"] = "Consider closing or rolling position before earnings."
                
                return result
            
            # CASE 2: Earnings within 7 days AFTER expiration (MEDIUM RISK - IV elevated)
            if 0 <= days_diff <= 7:
                result["has_risk"] = True
                result["risk_level"] = "medium"
                result["reason"] = f"Earnings {days_diff} days after expiration - IV may be elevated"
                result["recommendation"] = (
                    "IV will be elevated as market prices in earnings. "
                    "Good for premium selling but watch for early moves."
                )
                return result
            
            # CASE 3: Earnings well after expiration (LOW/NO RISK)
            result["has_risk"] = False
            result["risk_level"] = "none"
            result["reason"] = f"Earnings {days_diff} days after expiration - safe"
            result["recommendation"] = None
            
            return result
            
        except Exception as e:
            logger.error(f"Error checking earnings risk for {ticker}: {e}")
            return {
                "ticker": ticker,
                "has_risk": False,
                "risk_level": "unknown",
                "error": str(e)
            }
    
    def check_portfolio_earnings_risk(
        self,
        positions: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Check earnings risk for multiple positions.
        
        positions: List of dicts with {ticker, expiration, strategy}
        """
        risks = []
        
        for pos in positions:
            ticker = pos.get("ticker")
            expiration = pos.get("expiration")
            strategy = pos.get("strategy", "ipmcc")
            
            if ticker and expiration:
                risk = self.check_position_earnings_risk(ticker, expiration, strategy)
                if risk.get("has_risk"):
                    risk["position_id"] = pos.get("id")
                    risks.append(risk)
        
        # Sort by risk level
        risk_order = {"high": 0, "medium": 1, "low": 2, "none": 3}
        risks.sort(key=lambda r: risk_order.get(r.get("risk_level", "none"), 3))
        
        return {
            "positions_at_risk": risks,
            "high_risk_count": len([r for r in risks if r.get("risk_level") == "high"]),
            "medium_risk_count": len([r for r in risks if r.get("risk_level") == "medium"]),
            "total_checked": len(positions)
        }
    
    # =========================================================================
    # UPCOMING EARNINGS
    # =========================================================================
    
    def get_upcoming_earnings(
        self,
        tickers: List[str],
        days_ahead: int = 30
    ) -> List[Dict[str, Any]]:
        """
        Get upcoming earnings for a list of tickers.
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
                        })
                except:
                    pass
        
        # Sort by date
        upcoming.sort(key=lambda x: x["earnings_date"])
        return upcoming
    
    def get_earnings_calendar_for_positions(
        self,
        positions: List[Dict[str, Any]],
        days_ahead: int = 60
    ) -> Dict[str, Any]:
        """
        Get earnings calendar showing which positions are affected.
        """
        tickers = list(set(p.get("ticker") for p in positions if p.get("ticker")))
        upcoming = self.get_upcoming_earnings(tickers, days_ahead)
        
        # Match with positions
        for earning in upcoming:
            ticker = earning["ticker"]
            affected_positions = [
                p for p in positions 
                if p.get("ticker") == ticker
            ]
            earning["affected_positions"] = len(affected_positions)
            earning["position_ids"] = [p.get("id") for p in affected_positions]
        
        return {
            "earnings": upcoming,
            "total_events": len(upcoming),
            "tickers_checked": len(tickers)
        }


# Singleton instance
position_event_service = PositionEventService()
