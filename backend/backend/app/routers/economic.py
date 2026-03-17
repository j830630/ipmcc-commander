"""
Economic Events Service
Fetches and analyzes major economic events that could impact 0-DTE trading
"""

from datetime import datetime, date, timedelta
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import aiohttp

router = APIRouter(prefix="/api/v1/economic", tags=["Economic"])


class EconomicEvent(BaseModel):
    time: str
    currency: str
    impact: str  # 'high', 'medium', 'low'
    event: str
    forecast: Optional[str] = None
    previous: Optional[str] = None
    actual: Optional[str] = None


class DailyEventsResponse(BaseModel):
    date: str
    has_high_impact: bool
    high_impact_count: int
    events: List[EconomicEvent]
    trading_warning: Optional[str] = None
    market_impact_summary: Optional[str] = None


# High-impact events that significantly affect 0-DTE trading
HIGH_IMPACT_KEYWORDS = [
    'CPI', 'Core CPI', 'Consumer Price Index',
    'NFP', 'Non-Farm Payroll', 'Nonfarm Payrolls', 'Employment',
    'FOMC', 'Fed', 'Federal Reserve', 'Interest Rate', 'Rate Decision',
    'GDP', 'Gross Domestic Product',
    'PCE', 'Core PCE', 'Personal Consumption',
    'PPI', 'Producer Price Index',
    'Retail Sales',
    'ISM Manufacturing', 'ISM Services', 'PMI',
    'Jobless Claims', 'Unemployment',
    'Powell', 'Yellen', 'Fed Chair', 'Fed Speak',
    'JOLTS', 'Job Openings',
    'Consumer Confidence',
    'Housing Starts', 'Building Permits',
    'Trade Balance',
    'Durable Goods',
]

# Event-specific trading guidance
EVENT_GUIDANCE = {
    'CPI': {
        'impact': 'EXTREME - CPI directly impacts Fed policy expectations',
        'typical_move': 'SPX can move 50-100+ points in minutes',
        'recommendation': 'AVOID 0-DTE short premium. Consider waiting until after release.',
        'release_time': '8:30 AM ET'
    },
    'Core CPI': {
        'impact': 'EXTREME - Core CPI is the Fed\'s preferred inflation gauge',
        'typical_move': 'SPX can move 50-100+ points in minutes',
        'recommendation': 'AVOID 0-DTE short premium. High gamma risk.',
        'release_time': '8:30 AM ET'
    },
    'FOMC': {
        'impact': 'EXTREME - Rate decisions move all markets',
        'typical_move': 'SPX can move 100+ points, VIX spikes common',
        'recommendation': 'NO 0-DTE trades on FOMC days. Unpredictable volatility.',
        'release_time': '2:00 PM ET (statement), 2:30 PM ET (press conference)'
    },
    'NFP': {
        'impact': 'HIGH - Employment data impacts Fed policy',
        'typical_move': 'SPX typically moves 30-60 points',
        'recommendation': 'Avoid morning entries. Consider afternoon if data digested.',
        'release_time': '8:30 AM ET (first Friday of month)'
    },
    'Fed': {
        'impact': 'HIGH - Fed speakers can move markets unexpectedly',
        'typical_move': 'Variable, can spike VIX 10%+',
        'recommendation': 'Reduce position size. Have wider stops.',
        'release_time': 'Check schedule for specific time'
    },
    'PCE': {
        'impact': 'HIGH - Fed\'s preferred inflation measure',
        'typical_move': 'SPX can move 30-50 points',
        'recommendation': 'Caution with short premium strategies.',
        'release_time': '8:30 AM ET'
    },
    'GDP': {
        'impact': 'MEDIUM-HIGH - Economic growth indicator',
        'typical_move': 'SPX typically moves 20-40 points',
        'recommendation': 'Tradeable but use wider strikes.',
        'release_time': '8:30 AM ET'
    },
    'Jobless Claims': {
        'impact': 'MEDIUM - Weekly employment data',
        'typical_move': 'Usually absorbed quickly unless extreme',
        'recommendation': 'Generally tradeable, watch for outliers.',
        'release_time': '8:30 AM ET (Thursdays)'
    },
}


def get_event_guidance(event_name: str) -> dict:
    """Get trading guidance for a specific event type"""
    for keyword, guidance in EVENT_GUIDANCE.items():
        if keyword.lower() in event_name.lower():
            return guidance
    return None


def is_high_impact_event(event_name: str) -> bool:
    """Check if event is high impact for trading"""
    event_lower = event_name.lower()
    for keyword in HIGH_IMPACT_KEYWORDS:
        if keyword.lower() in event_lower:
            return True
    return False


def generate_trading_warning(events: List[EconomicEvent]) -> tuple[str, str]:
    """Generate trading warning and summary based on events"""
    high_impact_events = [e for e in events if e.impact == 'high' or is_high_impact_event(e.event)]
    
    if not high_impact_events:
        return None, None
    
    # Check for specific event types
    has_cpi = any('cpi' in e.event.lower() for e in high_impact_events)
    has_fomc = any('fomc' in e.event.lower() or 'rate decision' in e.event.lower() for e in high_impact_events)
    has_nfp = any('payroll' in e.event.lower() or 'nfp' in e.event.lower() for e in high_impact_events)
    has_fed_speak = any('powell' in e.event.lower() or 'fed' in e.event.lower() for e in high_impact_events)
    
    if has_fomc:
        warning = "🚨 FOMC DAY - EXTREME CAUTION"
        summary = "Federal Reserve rate decision today. Markets can move 100+ points. 0-DTE short premium strategies are NOT recommended. VIX expansion likely into the announcement."
    elif has_cpi:
        warning = "🚨 CPI RELEASE DAY - HIGH VOLATILITY EXPECTED"
        summary = "Consumer Price Index data releases at 8:30 AM ET. This is the market's most watched inflation indicator. Expect significant moves at open. Consider waiting until after the data is digested before entering 0-DTE positions."
    elif has_nfp:
        warning = "⚠️ NFP DAY - EMPLOYMENT DATA"
        summary = "Non-Farm Payrolls release at 8:30 AM ET. Employment data can significantly move markets. Morning volatility expected. Afternoon entries may be safer if data is in-line."
    elif has_fed_speak:
        warning = "⚠️ FED SPEAKERS TODAY"
        summary = f"Federal Reserve officials speaking today. Unexpected comments can spike VIX and move markets. Use wider stops and reduced position sizes."
    else:
        event_names = [e.event for e in high_impact_events[:3]]
        warning = f"⚠️ HIGH IMPACT EVENTS: {len(high_impact_events)} scheduled"
        summary = f"Major economic releases today: {', '.join(event_names)}. Increased volatility expected. Consider reducing position size or waiting for data to be released."
    
    return warning, summary


# Fallback: Generate sample events for testing when API unavailable
def generate_sample_events() -> List[EconomicEvent]:
    """Generate sample events for testing/demo purposes"""
    today = date.today()
    weekday = today.weekday()
    
    events = []
    
    # Add some realistic events based on day of week
    if weekday == 0:  # Monday
        events.append(EconomicEvent(
            time="10:00 AM",
            currency="USD",
            impact="medium",
            event="ISM Manufacturing PMI",
            forecast="49.5",
            previous="49.2"
        ))
    elif weekday == 1:  # Tuesday
        events.append(EconomicEvent(
            time="10:00 AM",
            currency="USD",
            impact="medium",
            event="JOLTS Job Openings",
            forecast="8.85M",
            previous="8.76M"
        ))
    elif weekday == 2:  # Wednesday
        events.append(EconomicEvent(
            time="8:30 AM",
            currency="USD",
            impact="high",
            event="Core CPI m/m",
            forecast="0.3%",
            previous="0.3%"
        ))
        events.append(EconomicEvent(
            time="8:30 AM",
            currency="USD",
            impact="high",
            event="CPI y/y",
            forecast="2.9%",
            previous="2.9%"
        ))
    elif weekday == 3:  # Thursday
        events.append(EconomicEvent(
            time="8:30 AM",
            currency="USD",
            impact="medium",
            event="Unemployment Claims",
            forecast="215K",
            previous="219K"
        ))
    elif weekday == 4:  # Friday (NFP week - first Friday)
        if today.day <= 7:
            events.append(EconomicEvent(
                time="8:30 AM",
                currency="USD",
                impact="high",
                event="Non-Farm Payrolls",
                forecast="175K",
                previous="256K"
            ))
            events.append(EconomicEvent(
                time="8:30 AM",
                currency="USD",
                impact="high",
                event="Unemployment Rate",
                forecast="4.1%",
                previous="4.1%"
            ))
        else:
            events.append(EconomicEvent(
                time="10:00 AM",
                currency="USD",
                impact="medium",
                event="Consumer Sentiment",
                forecast="73.2",
                previous="71.1"
            ))
    
    return events


@router.get("/events/today")
async def get_todays_events() -> DailyEventsResponse:
    """Get today's economic events and trading guidance"""
    
    today = date.today()
    events = []
    
    # Try to fetch from external API (Forex Factory, Investing.com, etc.)
    try:
        # Using a free economic calendar API
        async with aiohttp.ClientSession() as session:
            # Try Forex Factory RSS or similar
            # For now, using sample data as fallback
            events = generate_sample_events()
    except Exception as e:
        print(f"Error fetching economic calendar: {e}")
        events = generate_sample_events()
    
    # Filter for USD events (most relevant for SPX/SPY)
    usd_events = [e for e in events if e.currency == 'USD']
    
    # Check for high impact
    high_impact_events = [e for e in usd_events if e.impact == 'high' or is_high_impact_event(e.event)]
    has_high_impact = len(high_impact_events) > 0
    
    # Generate warnings
    warning, summary = generate_trading_warning(usd_events)
    
    return DailyEventsResponse(
        date=today.isoformat(),
        has_high_impact=has_high_impact,
        high_impact_count=len(high_impact_events),
        events=usd_events,
        trading_warning=warning,
        market_impact_summary=summary
    )


@router.get("/events/week")
async def get_week_events():
    """Get this week's major economic events"""
    
    today = date.today()
    start_of_week = today - timedelta(days=today.weekday())
    
    week_events = []
    for i in range(5):  # Monday to Friday
        day = start_of_week + timedelta(days=i)
        day_events = generate_sample_events()  # In production, fetch actual data
        
        for event in day_events:
            week_events.append({
                "date": day.isoformat(),
                "day": day.strftime("%A"),
                **event.dict()
            })
    
    return {
        "week_of": start_of_week.isoformat(),
        "events": week_events
    }


@router.get("/guidance/{event_type}")
async def get_event_trading_guidance(event_type: str):
    """Get specific trading guidance for an event type"""
    
    guidance = get_event_guidance(event_type)
    
    if not guidance:
        return {
            "event": event_type,
            "guidance": "No specific guidance available for this event type.",
            "general_recommendation": "Monitor VIX and GEX levels. Reduce position size if uncertain."
        }
    
    return {
        "event": event_type,
        "guidance": guidance
    }
