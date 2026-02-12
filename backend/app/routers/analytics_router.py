"""
IPMCC Commander - Analytics API Router
Endpoints for portfolio analytics, roll suggestions, and earnings calendar
"""

from fastapi import APIRouter, Depends, Query
from typing import List, Optional
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.position import Position
from app.services.analytics_service import get_analytics_service
from app.services.roll_suggestions_service import get_roll_suggestions_service
from app.services.earnings_service import earnings_calendar_service

router = APIRouter()


# ============ PORTFOLIO ANALYTICS ============

@router.get("/summary")
async def get_portfolio_summary(db: Session = Depends(get_db)):
    """Get high-level portfolio summary with P&L and trade stats."""
    service = get_analytics_service(db)
    return service.get_portfolio_summary()


@router.get("/pnl/history")
async def get_pnl_history(
    days: int = Query(90, description="Number of days to look back"),
    db: Session = Depends(get_db)
):
    """Get P&L history for charting."""
    service = get_analytics_service(db)
    return service.get_pnl_over_time(days)


@router.get("/income/by-period")
async def get_income_by_period(
    period: str = Query("monthly", description="Aggregation period: daily, weekly, monthly"),
    db: Session = Depends(get_db)
):
    """Get premium income aggregated by period."""
    service = get_analytics_service(db)
    return service.get_income_by_period(period)


@router.get("/performance/by-ticker")
async def get_performance_by_ticker(db: Session = Depends(get_db)):
    """Get performance breakdown by ticker."""
    service = get_analytics_service(db)
    return service.get_performance_by_ticker()


@router.get("/performance/by-strategy")
async def get_performance_by_strategy(db: Session = Depends(get_db)):
    """Get performance breakdown by strategy."""
    service = get_analytics_service(db)
    return service.get_performance_by_strategy()


@router.get("/greeks/history")
async def get_greeks_history(
    days: int = Query(30, description="Number of days to look back"),
    db: Session = Depends(get_db)
):
    """Get portfolio Greeks over time."""
    service = get_analytics_service(db)
    return service.get_greeks_history(days)


@router.get("/drawdown")
async def get_drawdown_analysis(db: Session = Depends(get_db)):
    """Get drawdown metrics."""
    service = get_analytics_service(db)
    return service.get_drawdown_analysis()


@router.get("/trade-stats")
async def get_trade_statistics(db: Session = Depends(get_db)):
    """Get detailed trade statistics."""
    service = get_analytics_service(db)
    return service.get_trade_statistics()


@router.post("/snapshot")
async def record_snapshot(db: Session = Depends(get_db)):
    """Record today's portfolio snapshot."""
    service = get_analytics_service(db)
    snapshot = service.record_daily_snapshot()
    return {"status": "success", "snapshot_date": snapshot.snapshot_date if snapshot else None}


# ============ ROLL SUGGESTIONS ============

@router.get("/roll-suggestions")
async def get_roll_suggestions(db: Session = Depends(get_db)):
    """Get all roll suggestions for active positions."""
    service = get_roll_suggestions_service(db)
    
    # Get active positions
    positions = db.query(Position).filter(Position.status == "active").all()
    
    suggestions = service.analyze_all_positions(positions)
    
    return {
        "suggestions": suggestions,
        "count": len(suggestions),
        "critical_count": len([s for s in suggestions if s.get("urgency") == "critical"]),
        "high_count": len([s for s in suggestions if s.get("urgency") == "high"]),
    }


@router.get("/roll-suggestions/{position_id}")
async def get_roll_suggestions_for_position(
    position_id: str,
    db: Session = Depends(get_db)
):
    """Get roll suggestions for a specific position."""
    service = get_roll_suggestions_service(db)
    
    position = db.query(Position).filter(Position.id == position_id).first()
    if not position:
        return {"error": "Position not found", "suggestions": []}
    
    # In production, you'd fetch current market data here
    current_price = position.current_value or position.entry_price
    
    suggestions = service.analyze_position(position, current_price)
    
    return {
        "position_id": position_id,
        "ticker": position.ticker,
        "suggestions": suggestions,
    }


@router.post("/roll-suggestions/{suggestion_id}/execute")
async def mark_suggestion_executed(
    suggestion_id: str,
    db: Session = Depends(get_db)
):
    """Mark a roll suggestion as executed."""
    from app.models.history import RollSuggestion
    from datetime import datetime
    
    suggestion = db.query(RollSuggestion).filter(RollSuggestion.id == suggestion_id).first()
    if not suggestion:
        return {"error": "Suggestion not found"}
    
    suggestion.status = "executed"
    suggestion.executed_at = datetime.now().isoformat()
    db.commit()
    
    return {"status": "success", "suggestion_id": suggestion_id}


@router.post("/roll-suggestions/{suggestion_id}/dismiss")
async def dismiss_suggestion(
    suggestion_id: str,
    reason: str = Query(None, description="Reason for dismissing"),
    db: Session = Depends(get_db)
):
    """Dismiss a roll suggestion."""
    from app.models.history import RollSuggestion
    from datetime import datetime
    
    suggestion = db.query(RollSuggestion).filter(RollSuggestion.id == suggestion_id).first()
    if not suggestion:
        return {"error": "Suggestion not found"}
    
    suggestion.status = "dismissed"
    suggestion.dismissed_at = datetime.now().isoformat()
    suggestion.dismissed_reason = reason
    db.commit()
    
    return {"status": "success", "suggestion_id": suggestion_id}


# ============ EARNINGS CALENDAR ============

@router.get("/earnings/{ticker}")
async def get_earnings_date(ticker: str):
    """Get upcoming earnings date for a ticker."""
    return earnings_calendar_service.get_earnings_date(ticker.upper())


@router.get("/earnings")
async def get_earnings_for_portfolio(
    tickers: str = Query(None, description="Comma-separated list of tickers"),
    db: Session = Depends(get_db)
):
    """Get earnings dates for portfolio tickers."""
    if tickers:
        ticker_list = [t.strip().upper() for t in tickers.split(",")]
    else:
        # Get tickers from active positions
        positions = db.query(Position).filter(Position.status == "active").all()
        ticker_list = list(set(p.ticker for p in positions))
    
    if not ticker_list:
        return {"earnings": [], "message": "No tickers specified or found in portfolio"}
    
    results = earnings_calendar_service.get_earnings_for_tickers(ticker_list)
    
    return {
        "earnings": results,
        "tickers_checked": len(ticker_list),
    }


@router.get("/earnings/upcoming")
async def get_upcoming_earnings(
    days: int = Query(30, description="Days ahead to look"),
    db: Session = Depends(get_db)
):
    """Get upcoming earnings for all portfolio tickers."""
    # Get tickers from active positions
    positions = db.query(Position).filter(Position.status == "active").all()
    ticker_list = list(set(p.ticker for p in positions))
    
    if not ticker_list:
        return {"upcoming": [], "message": "No active positions"}
    
    upcoming = earnings_calendar_service.get_upcoming_earnings(ticker_list, days)
    
    return {
        "upcoming": upcoming,
        "days_ahead": days,
        "tickers_checked": len(ticker_list),
    }


@router.get("/earnings/risk-check")
async def check_earnings_risk(
    ticker: str,
    expiration: str = Query(..., description="Option expiration date (YYYY-MM-DD)")
):
    """Check if there's earnings risk for a position."""
    return earnings_calendar_service.check_earnings_risk(
        ticker.upper(),
        expiration
    )


@router.get("/earnings/portfolio-risk")
async def check_portfolio_earnings_risk(db: Session = Depends(get_db)):
    """Check earnings risk for all active positions."""
    from app.models.cycle import ShortCallCycle
    
    positions = db.query(Position).filter(Position.status == "active").all()
    
    risks = []
    for position in positions:
        # Get active cycle
        active_cycle = None
        for cycle in position.cycles:
            if cycle.status == "open":
                active_cycle = cycle
                break
        
        if active_cycle:
            risk = earnings_calendar_service.check_earnings_risk(
                position.ticker,
                active_cycle.expiration
            )
            if risk.get("has_risk"):
                risk["position_id"] = position.id
                risks.append(risk)
    
    return {
        "positions_at_risk": risks,
        "risk_count": len(risks),
        "positions_checked": len(positions),
    }
