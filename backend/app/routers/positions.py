"""
IPMCC Commander - Positions Router
CRUD operations for IPMCC positions (LEAPs)
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, date

from app.database import get_db
from app.models.position import Position
from app.models.cycle import ShortCallCycle
from app.schemas.position import (
    PositionCreate, 
    PositionUpdate, 
    PositionResponse, 
    PositionSummary,
    PositionClose,
    CycleSummary
)

router = APIRouter()


def calculate_position_aggregates(position: Position) -> dict:
    """Calculate aggregate metrics for a position."""
    cycles = position.cycles or []
    
    # Cycle aggregates
    total_cycles = len(cycles)
    cumulative_premium = sum(c.entry_premium or 0 for c in cycles)
    cumulative_short_pnl = sum(c.realized_pnl or 0 for c in cycles if c.realized_pnl is not None)
    
    # Find active cycle (open, most recent)
    active_cycle = None
    for cycle in cycles:
        if cycle.close_date is None:
            active_cycle = cycle
            break
    
    # Calculate DTE
    try:
        exp_date = date.fromisoformat(position.long_expiration)
        dte_remaining = (exp_date - date.today()).days
    except:
        dte_remaining = 0
    
    # Calculate P&L
    capital_at_risk = position.entry_price * 100 * position.quantity
    leap_pnl = 0.0
    leap_pnl_percent = 0.0
    
    if position.current_value is not None:
        leap_pnl = (position.current_value - position.entry_price) * 100 * position.quantity
        leap_pnl_percent = ((position.current_value - position.entry_price) / position.entry_price) * 100 if position.entry_price > 0 else 0
    
    # Net P&L = LEAP P&L + Short Call P&L
    net_pnl = leap_pnl + (cumulative_short_pnl * 100 * position.quantity)
    net_pnl_percent = (net_pnl / capital_at_risk) * 100 if capital_at_risk > 0 else 0
    
    return {
        "dte_remaining": max(0, dte_remaining),
        "capital_at_risk": round(capital_at_risk, 2),
        "leap_pnl": round(leap_pnl, 2),
        "leap_pnl_percent": round(leap_pnl_percent, 2),
        "total_cycles": total_cycles,
        "cumulative_premium": round(cumulative_premium * 100 * position.quantity, 2),
        "cumulative_short_pnl": round(cumulative_short_pnl * 100 * position.quantity, 2),
        "net_pnl": round(net_pnl, 2),
        "net_pnl_percent": round(net_pnl_percent, 2),
        "active_cycle": CycleSummary(
            id=active_cycle.id,
            cycle_number=active_cycle.cycle_number,
            short_strike=active_cycle.short_strike,
            short_expiration=active_cycle.short_expiration,
            entry_premium=active_cycle.entry_premium,
            realized_pnl=active_cycle.realized_pnl,
            is_open=True
        ) if active_cycle else None
    }


@router.get("/", response_model=List[PositionSummary])
async def list_positions(
    status: Optional[str] = Query(None, description="Filter by status: active, closed, expired"),
    ticker: Optional[str] = Query(None, description="Filter by ticker"),
    db: AsyncSession = Depends(get_db)
):
    """
    List all positions with summary info.
    
    Supports filtering by status and ticker.
    """
    query = select(Position).options(selectinload(Position.cycles))
    
    if status:
        query = query.where(Position.status == status.lower())
    if ticker:
        query = query.where(Position.ticker == ticker.upper())
    
    query = query.order_by(Position.created_at.desc())
    
    result = await db.execute(query)
    positions = result.scalars().all()
    
    summaries = []
    for pos in positions:
        aggs = calculate_position_aggregates(pos)
        
        summaries.append(PositionSummary(
            id=pos.id,
            ticker=pos.ticker,
            long_strike=pos.long_strike,
            long_expiration=pos.long_expiration,
            status=pos.status,
            entry_price=pos.entry_price,
            current_value=pos.current_value,
            dte_remaining=aggs["dte_remaining"],
            total_cycles=aggs["total_cycles"],
            cumulative_premium=aggs["cumulative_premium"],
            net_pnl=aggs["net_pnl"],
            net_pnl_percent=aggs["net_pnl_percent"],
            active_short_strike=aggs["active_cycle"].short_strike if aggs["active_cycle"] else None,
            active_short_expiration=aggs["active_cycle"].short_expiration if aggs["active_cycle"] else None
        ))
    
    return summaries


@router.post("/", response_model=PositionResponse, status_code=201)
async def create_position(
    position: PositionCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new IPMCC position.
    
    This creates the LEAP leg of the trade. Short call cycles are added separately.
    """
    db_position = Position(
        ticker=position.ticker.upper(),
        long_strike=position.long_strike,
        long_expiration=position.long_expiration,
        entry_date=position.entry_date,
        entry_price=position.entry_price,
        entry_delta=position.entry_delta,
        quantity=position.quantity,
        notes=position.notes,
        status="active",
        created_at=datetime.now().isoformat(),
        updated_at=datetime.now().isoformat()
    )
    
    db.add(db_position)
    await db.commit()
    await db.refresh(db_position)
    
    # Return with computed fields
    aggs = calculate_position_aggregates(db_position)
    
    return PositionResponse(
        id=db_position.id,
        ticker=db_position.ticker,
        long_strike=db_position.long_strike,
        long_expiration=db_position.long_expiration,
        entry_date=db_position.entry_date,
        entry_price=db_position.entry_price,
        entry_delta=db_position.entry_delta,
        quantity=db_position.quantity,
        notes=db_position.notes,
        status=db_position.status,
        current_value=db_position.current_value,
        current_delta=db_position.current_delta,
        created_at=db_position.created_at,
        updated_at=db_position.updated_at,
        **aggs
    )


@router.get("/{position_id}", response_model=PositionResponse)
async def get_position(
    position_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific position with all details."""
    result = await db.execute(
        select(Position)
        .options(selectinload(Position.cycles))
        .where(Position.id == position_id)
    )
    position = result.scalar_one_or_none()
    
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")
    
    aggs = calculate_position_aggregates(position)
    
    return PositionResponse(
        id=position.id,
        ticker=position.ticker,
        long_strike=position.long_strike,
        long_expiration=position.long_expiration,
        entry_date=position.entry_date,
        entry_price=position.entry_price,
        entry_delta=position.entry_delta,
        quantity=position.quantity,
        notes=position.notes,
        status=position.status,
        current_value=position.current_value,
        current_delta=position.current_delta,
        close_date=position.close_date,
        close_price=position.close_price,
        close_reason=position.close_reason,
        created_at=position.created_at,
        updated_at=position.updated_at,
        **aggs
    )


@router.patch("/{position_id}", response_model=PositionResponse)
async def update_position(
    position_id: str,
    updates: PositionUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a position's details."""
    result = await db.execute(
        select(Position)
        .options(selectinload(Position.cycles))
        .where(Position.id == position_id)
    )
    position = result.scalar_one_or_none()
    
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")
    
    # Apply updates
    update_data = updates.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "ticker" and value:
            value = value.upper()
        setattr(position, field, value)
    
    position.updated_at = datetime.now().isoformat()
    
    await db.commit()
    await db.refresh(position)
    
    aggs = calculate_position_aggregates(position)
    
    return PositionResponse(
        id=position.id,
        ticker=position.ticker,
        long_strike=position.long_strike,
        long_expiration=position.long_expiration,
        entry_date=position.entry_date,
        entry_price=position.entry_price,
        entry_delta=position.entry_delta,
        quantity=position.quantity,
        notes=position.notes,
        status=position.status,
        current_value=position.current_value,
        current_delta=position.current_delta,
        close_date=position.close_date,
        close_price=position.close_price,
        close_reason=position.close_reason,
        created_at=position.created_at,
        updated_at=position.updated_at,
        **aggs
    )


@router.post("/{position_id}/close", response_model=PositionResponse)
async def close_position(
    position_id: str,
    close_data: PositionClose,
    db: AsyncSession = Depends(get_db)
):
    """Close a position."""
    result = await db.execute(
        select(Position)
        .options(selectinload(Position.cycles))
        .where(Position.id == position_id)
    )
    position = result.scalar_one_or_none()
    
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")
    
    if position.status != "active":
        raise HTTPException(status_code=400, detail="Position is not active")
    
    # Close any open cycles first
    for cycle in position.cycles:
        if cycle.close_date is None:
            cycle.close_date = close_data.close_date
            cycle.close_price = 0.0  # Assume expired/closed
            cycle.realized_pnl = cycle.entry_premium  # Full premium captured
            cycle.close_reason = "position_closed"
    
    # Close the position
    position.status = "closed"
    position.close_date = close_data.close_date
    position.close_price = close_data.close_price
    position.close_reason = close_data.close_reason
    position.current_value = close_data.close_price
    position.updated_at = datetime.now().isoformat()
    
    await db.commit()
    await db.refresh(position)
    
    aggs = calculate_position_aggregates(position)
    
    return PositionResponse(
        id=position.id,
        ticker=position.ticker,
        long_strike=position.long_strike,
        long_expiration=position.long_expiration,
        entry_date=position.entry_date,
        entry_price=position.entry_price,
        entry_delta=position.entry_delta,
        quantity=position.quantity,
        notes=position.notes,
        status=position.status,
        current_value=position.current_value,
        current_delta=position.current_delta,
        close_date=position.close_date,
        close_price=position.close_price,
        close_reason=position.close_reason,
        created_at=position.created_at,
        updated_at=position.updated_at,
        **aggs
    )


@router.delete("/{position_id}")
async def delete_position(
    position_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Delete a position and all its cycles."""
    result = await db.execute(
        select(Position).where(Position.id == position_id)
    )
    position = result.scalar_one_or_none()
    
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")
    
    await db.delete(position)
    await db.commit()
    
    return {"deleted": True, "id": position_id}
