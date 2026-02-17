"""
IPMCC Commander - 0-DTE Event Service
Handles binary events that impact intraday trading (FOMC, CPI, NFP within 5 days)
These events override ALL technical signals for 0-DTE trades.
"""

import logging
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

logger = logging.getLogger(__name__)


# ============================================================================
# MODELS
# ============================================================================

class BinaryEvent(BaseModel):
    event_type: str  # fomc, cpi, nfp, ppi, blackout
    date: str
    days_away: int
    impact: str  # high, medium, low
    description: str
    
class EventHorizonResult(BaseModel):
    events: List[BinaryEvent]
    has_binary_event: bool  # True if any event within 5 days with high impact
    event_override: Optional[str]  # Override message if binary event blocks trading
    macro_adjustment: int  # Points to adjust confidence
    warnings: List[str]


# ============================================================================
# CONSTANTS - Hard-coded event dates
# ============================================================================

# FOMC Meeting Dates 2025-2026 (Fixed schedule, update annually)
FOMC_DATES = [
    # 2025
    "2025-01-29", "2025-03-19", "2025-05-07", "2025-06-18",
    "2025-07-30", "2025-09-17", "2025-11-05", "2025-12-17",
    # 2026
    "2026-01-28", "2026-03-18", "2026-04-29", "2026-06-17",
    "2026-07-29", "2026-09-16", "2026-11-04", "2026-12-16",
    # 2027
    "2027-01-27", "2027-03-17", "2027-05-05", "2027-06-16",
    "2027-07-28", "2027-09-15", "2027-11-03", "2027-12-15"
]

# User-configurable blackout dates (CPI, NFP, etc.)
# Update weekly - "Sunday Ritual"
# Format: {"date": "YYYY-MM-DD", "event": "Event Name", "impact": "high/medium"}
BLACKOUT_DATES: List[Dict[str, str]] = [
    # Example entries - update these weekly
    {"date": "2026-02-14", "event": "CPI Release", "impact": "high"},
    {"date": "2026-03-07", "event": "NFP Jobs Report", "impact": "high"},
    {"date": "2026-03-12", "event": "CPI Release", "impact": "high"},
]


# ============================================================================
# SERVICE CLASS
# ============================================================================

class Event0DTEService:
    """
    Service for 0-DTE binary event checking.
    
    Decision Hierarchy for 0-DTE:
    - Events within 0-2 days: ABSOLUTE BLOCK (no trading)
    - Events within 3-5 days: HIGH RISK (confidence -25)
    - Events within 6-10 days: CAUTION (confidence -10)
    """
    
    # Thresholds
    BLOCK_THRESHOLD = 2      # Days - absolute no-trade
    HIGH_RISK_THRESHOLD = 5  # Days - high risk warning
    CAUTION_THRESHOLD = 10   # Days - caution warning
    
    def __init__(self):
        self.blackout_dates = BLACKOUT_DATES.copy()
    
    def get_event_horizon(self) -> EventHorizonResult:
        """
        Get all relevant events for 0-DTE trading decisions.
        """
        events: List[BinaryEvent] = []
        warnings: List[str] = []
        macro_adjustment = 0
        
        today = date.today()
        
        # Check FOMC dates
        for date_str in FOMC_DATES:
            try:
                fomc_date = datetime.strptime(date_str, "%Y-%m-%d").date()
                days_away = (fomc_date - today).days
                
                if 0 <= days_away <= self.CAUTION_THRESHOLD:
                    impact = "high" if days_away <= self.HIGH_RISK_THRESHOLD else "medium"
                    events.append(BinaryEvent(
                        event_type="fomc",
                        date=date_str,
                        days_away=days_away,
                        impact=impact,
                        description=f"FOMC Meeting in {days_away} days"
                    ))
                    
                    if days_away <= self.BLOCK_THRESHOLD:
                        warnings.append(f"🛑 FOMC in {days_away} days - NO 0-DTE TRADES")
                        macro_adjustment -= 50
                    elif days_away <= self.HIGH_RISK_THRESHOLD:
                        warnings.append(f"⚠️ FOMC in {days_away} days - HIGH RISK")
                        macro_adjustment -= 25
                    else:
                        warnings.append(f"📅 FOMC approaching in {days_away} days")
                        macro_adjustment -= 10
                        
            except ValueError:
                continue
        
        # Check blackout dates
        for item in self.blackout_dates:
            try:
                event_date = datetime.strptime(item["date"], "%Y-%m-%d").date()
                days_away = (event_date - today).days
                
                if 0 <= days_away <= self.CAUTION_THRESHOLD:
                    item_impact = item.get("impact", "high")
                    impact = "high" if days_away <= self.BLOCK_THRESHOLD else item_impact
                    
                    events.append(BinaryEvent(
                        event_type="blackout",
                        date=item["date"],
                        days_away=days_away,
                        impact=impact,
                        description=f"{item['event']} in {days_away} days"
                    ))
                    
                    if days_away <= self.BLOCK_THRESHOLD and item_impact == "high":
                        warnings.append(f"🛑 {item['event']} in {days_away} days - NO 0-DTE TRADES")
                        macro_adjustment -= 50
                    elif days_away <= self.HIGH_RISK_THRESHOLD:
                        warnings.append(f"⚠️ {item['event']} in {days_away} days")
                        macro_adjustment -= 20
                    else:
                        warnings.append(f"📅 {item['event']} approaching")
                        macro_adjustment -= 5
                        
            except ValueError:
                continue
        
        # Sort by days away
        events.sort(key=lambda e: e.days_away)
        
        # Determine if we have a binary event block
        has_binary_event = any(
            e.days_away <= self.HIGH_RISK_THRESHOLD and e.impact == "high" 
            for e in events
        )
        
        event_override = None
        if has_binary_event:
            blocking_events = [
                e for e in events 
                if e.days_away <= self.HIGH_RISK_THRESHOLD and e.impact == "high"
            ]
            event_names = [e.description for e in blocking_events]
            event_override = f"HOLD/WAIT: Technical setup invalid due to: {', '.join(event_names)}"
        
        return EventHorizonResult(
            events=events,
            has_binary_event=has_binary_event,
            event_override=event_override,
            macro_adjustment=max(-50, macro_adjustment),  # Cap at -50
            warnings=warnings
        )
    
    def is_trading_blocked(self) -> tuple[bool, Optional[str]]:
        """
        Quick check if 0-DTE trading is blocked today.
        Returns (blocked, reason).
        """
        horizon = self.get_event_horizon()
        
        # Check for events within block threshold
        for event in horizon.events:
            if event.days_away <= self.BLOCK_THRESHOLD and event.impact == "high":
                return True, f"Blocked: {event.description}"
        
        return False, None
    
    def get_next_fomc(self) -> Optional[Dict[str, Any]]:
        """Get the next FOMC meeting date."""
        today = date.today()
        for date_str in FOMC_DATES:
            try:
                fomc_date = datetime.strptime(date_str, "%Y-%m-%d").date()
                if fomc_date >= today:
                    return {
                        "date": date_str,
                        "days_away": (fomc_date - today).days
                    }
            except ValueError:
                continue
        return None
    
    # =========================================================================
    # BLACKOUT DATE MANAGEMENT
    # =========================================================================
    
    def add_blackout_date(self, date_str: str, event_name: str, impact: str = "high"):
        """Add a new blackout date."""
        self.blackout_dates.append({
            "date": date_str,
            "event": event_name,
            "impact": impact
        })
    
    def remove_blackout_date(self, date_str: str):
        """Remove a blackout date."""
        self.blackout_dates = [
            d for d in self.blackout_dates 
            if d["date"] != date_str
        ]
    
    def update_blackout_dates(self, dates: List[Dict[str, str]]):
        """Replace all blackout dates."""
        self.blackout_dates = dates
    
    def get_blackout_dates(self) -> List[Dict[str, str]]:
        """Get current blackout dates."""
        return self.blackout_dates.copy()
    
    def get_config(self) -> Dict[str, Any]:
        """Get current configuration."""
        return {
            "fomc_dates": FOMC_DATES[:10],  # Next 10
            "blackout_dates": self.blackout_dates,
            "block_threshold_days": self.BLOCK_THRESHOLD,
            "high_risk_threshold_days": self.HIGH_RISK_THRESHOLD,
            "caution_threshold_days": self.CAUTION_THRESHOLD
        }


# Singleton instance
event_0dte_service = Event0DTEService()
