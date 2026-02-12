"""
IPMCC Commander - Trade Recording Router
Endpoints for recording and managing trade history
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional
from sqlalchemy.orm import Session
from datetime import datetime, date

from app.database import get_db
from app.models.history import TradeHistory

router = APIRouter()


class TradeRecordCreate(BaseModel):
    """Schema for creating a trade record."""
    trade_type: str = Field(..., description="Type: open_long, close_long, open_short, close_short, roll_short")
    ticker: str = Field(..., min_length=1, max_length=10)
    trade_date: str = Field(..., description="Trade date YYYY-MM-DD")
    trade_time: Optional[str] = Field(None, description="Trade time HH:MM:SS")
    option_type: str = Field(..., description="CALL or PUT")
    strike: float = Field(..., gt=0)
    expiration: str = Field(..., description="Expiration date YYYY-MM-DD")
    quantity: int = Field(..., gt=0)
    price: float = Field(..., ge=0, description="Per-share price")
    fees: float = Field(default=0.0, ge=0)
    underlying_price: Optional[float] = Field(None, gt=0)
    delta: Optional[float] = None
    theta: Optional[float] = None
    iv: Optional[float] = None
    strategy: str = Field(default="ipmcc")
    notes: Optional[str] = None
    position_id: Optional[str] = None
    cycle_id: Optional[str] = None


class TradeRecordResponse(BaseModel):
    """Response schema for trade record."""
    id: str
    trade_type: str
    ticker: str
    trade_date: str
    option_type: str
    strike: float
    expiration: str
    quantity: int
    price: float
    total_value: float
    fees: float
    realized_pnl: Optional[float]
    strategy: str
    notes: Optional[str]
    created_at: str


@router.post("/trades", response_model=TradeRecordResponse)
async def record_trade(
    trade: TradeRecordCreate,
    db: Session = Depends(get_db)
):
    """Record a new trade."""
    # Calculate total value (price * quantity * 100 for options)
    total_value = trade.price * trade.quantity * 100
    
    # Determine if this is a debit or credit
    is_debit = trade.trade_type in ["open_long", "close_short"]
    
    # Calculate realized P&L for closing trades
    realized_pnl = None
    if trade.trade_type in ["close_long", "close_short"]:
        # For closing trades, we'd need to look up the opening trade
        # For now, we'll leave this to be calculated later or passed in
        pass
    
    trade_record = TradeHistory(
        trade_type=trade.trade_type,
        ticker=trade.ticker.upper(),
        trade_date=trade.trade_date,
        trade_time=trade.trade_time,
        option_type=trade.option_type.upper(),
        strike=trade.strike,
        expiration=trade.expiration,
        quantity=trade.quantity,
        price=trade.price,
        total_value=total_value,
        fees=trade.fees,
        realized_pnl=realized_pnl,
        underlying_price=trade.underlying_price,
        delta=trade.delta,
        theta=trade.theta,
        iv=trade.iv,
        strategy=trade.strategy,
        notes=trade.notes,
        position_id=trade.position_id,
        cycle_id=trade.cycle_id,
    )
    
    db.add(trade_record)
    db.commit()
    db.refresh(trade_record)
    
    return TradeRecordResponse(
        id=trade_record.id,
        trade_type=trade_record.trade_type,
        ticker=trade_record.ticker,
        trade_date=trade_record.trade_date,
        option_type=trade_record.option_type,
        strike=trade_record.strike,
        expiration=trade_record.expiration,
        quantity=trade_record.quantity,
        price=trade_record.price,
        total_value=trade_record.total_value,
        fees=trade_record.fees,
        realized_pnl=trade_record.realized_pnl,
        strategy=trade_record.strategy,
        notes=trade_record.notes,
        created_at=trade_record.created_at,
    )


@router.get("/trades")
async def get_trades(
    ticker: Optional[str] = Query(None, description="Filter by ticker"),
    trade_type: Optional[str] = Query(None, description="Filter by trade type"),
    strategy: Optional[str] = Query(None, description="Filter by strategy"),
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """Get trade history with optional filters."""
    query = db.query(TradeHistory)
    
    if ticker:
        query = query.filter(TradeHistory.ticker == ticker.upper())
    if trade_type:
        query = query.filter(TradeHistory.trade_type == trade_type)
    if strategy:
        query = query.filter(TradeHistory.strategy == strategy)
    if start_date:
        query = query.filter(TradeHistory.trade_date >= start_date)
    if end_date:
        query = query.filter(TradeHistory.trade_date <= end_date)
    
    total = query.count()
    trades = query.order_by(TradeHistory.trade_date.desc(), TradeHistory.created_at.desc())\
                  .offset(offset).limit(limit).all()
    
    return {
        "trades": [
            {
                "id": t.id,
                "trade_type": t.trade_type,
                "ticker": t.ticker,
                "trade_date": t.trade_date,
                "option_type": t.option_type,
                "strike": t.strike,
                "expiration": t.expiration,
                "quantity": t.quantity,
                "price": t.price,
                "total_value": t.total_value,
                "fees": t.fees,
                "realized_pnl": t.realized_pnl,
                "underlying_price": t.underlying_price,
                "strategy": t.strategy,
                "notes": t.notes,
                "created_at": t.created_at,
            }
            for t in trades
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/trades/{trade_id}")
async def get_trade(trade_id: str, db: Session = Depends(get_db)):
    """Get a specific trade by ID."""
    trade = db.query(TradeHistory).filter(TradeHistory.id == trade_id).first()
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    return {
        "id": trade.id,
        "trade_type": trade.trade_type,
        "ticker": trade.ticker,
        "trade_date": trade.trade_date,
        "trade_time": trade.trade_time,
        "option_type": trade.option_type,
        "strike": trade.strike,
        "expiration": trade.expiration,
        "quantity": trade.quantity,
        "price": trade.price,
        "total_value": trade.total_value,
        "fees": trade.fees,
        "realized_pnl": trade.realized_pnl,
        "underlying_price": trade.underlying_price,
        "delta": trade.delta,
        "theta": trade.theta,
        "iv": trade.iv,
        "strategy": trade.strategy,
        "notes": trade.notes,
        "position_id": trade.position_id,
        "cycle_id": trade.cycle_id,
        "created_at": trade.created_at,
    }


@router.delete("/trades/{trade_id}")
async def delete_trade(trade_id: str, db: Session = Depends(get_db)):
    """Delete a trade record."""
    trade = db.query(TradeHistory).filter(TradeHistory.id == trade_id).first()
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    db.delete(trade)
    db.commit()
    
    return {"status": "deleted", "trade_id": trade_id}


@router.get("/trades/summary/recent")
async def get_recent_trades_summary(
    days: int = Query(7, description="Number of days to look back"),
    db: Session = Depends(get_db)
):
    """Get summary of recent trading activity."""
    cutoff = (date.today() - timedelta(days=days)).isoformat()
    
    trades = db.query(TradeHistory).filter(
        TradeHistory.trade_date >= cutoff
    ).all()
    
    total_credits = sum(t.total_value for t in trades if t.trade_type in ["open_short", "close_long"])
    total_debits = sum(t.total_value for t in trades if t.trade_type in ["open_long", "close_short"])
    total_fees = sum(t.fees or 0 for t in trades)
    
    # Group by ticker
    by_ticker = {}
    for t in trades:
        if t.ticker not in by_ticker:
            by_ticker[t.ticker] = {"trades": 0, "net_value": 0}
        by_ticker[t.ticker]["trades"] += 1
        if t.trade_type in ["open_short", "close_long"]:
            by_ticker[t.ticker]["net_value"] += t.total_value
        else:
            by_ticker[t.ticker]["net_value"] -= t.total_value
    
    return {
        "period_days": days,
        "total_trades": len(trades),
        "total_credits": total_credits,
        "total_debits": total_debits,
        "net_cash_flow": total_credits - total_debits - total_fees,
        "total_fees": total_fees,
        "by_ticker": by_ticker,
    }


# Need to import timedelta
from datetime import timedelta
