"""
IPMCC Commander - Cycles Router
CRUD operations for short call cycles
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from datetime import datetime, date

from app.database import get_db
from app.models.position import Position
from app.models.cycle import ShortCallCycle
from app.schemas.cycle import (
    CycleCreate,
    CycleUpdate,
    CycleResponse,
    CycleClose,
    RollCycleRequest
)

router = APIRouter()


def cycle_to_response(cycle: ShortCallCycle) -> CycleResponse:
    """Convert cycle model to response schema."""
    try:
        exp_date = date.fromisoformat(cycle.short_expiration)
        dte = max(0, (exp_date - date.today()).days)
    except:
        dte = 0
    
    is_open = cycle.close_date is None
    
    return CycleResponse(
        id=cycle.id,
        position_id=cycle.position_id,
        cycle_number=cycle.cycle_number,
        short_strike=cycle.short_strike,
        short_expiration=cycle.short_expiration,
        entry_date=cycle.entry_date,
        entry_premium=cycle.entry_premium,
        entry_extrinsic=cycle.entry_extrinsic,
        stock_price_at_entry=cycle.stock_price_at_entry,
        notes=cycle.notes,
        close_date=cycle.close_date,
        close_price=cycle.close_price,
        realized_pnl=cycle.realized_pnl,
        close_reason=cycle.close_reason,
        stock_price_at_close=cycle.stock_price_at_close,
        created_at=cycle.created_at,
        updated_at=cycle.updated_at,
        dte_remaining=dte if is_open else 0,
        is_open=is_open,
        is_profitable=cycle.realized_pnl > 0 if cycle.realized_pnl is not None else None,
        premium_captured_percent=(
            (cycle.realized_pnl / cycle.entry_premium * 100) 
            if cycle.realized_pnl is not None and cycle.entry_premium > 0 
            else None
        )
    )


@router.get("/position/{position_id}", response_model=List[CycleResponse])
async def list_cycles_for_position(
    position_id: str,
    include_closed: bool = Query(True, description="Include closed cycles"),
    db: AsyncSession = Depends(get_db)
):
    """Get all cycles for a specific position."""
    # Verify position exists
    pos_result = await db.execute(
        select(Position).where(Position.id == position_id)
    )
    if not pos_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Position not found")
    
    query = select(ShortCallCycle).where(ShortCallCycle.position_id == position_id)
    
    if not include_closed:
        query = query.where(ShortCallCycle.close_date.is_(None))
    
    query = query.order_by(ShortCallCycle.cycle_number.desc())
    
    result = await db.execute(query)
    cycles = result.scalars().all()
    
    return [cycle_to_response(c) for c in cycles]


@router.post("/", response_model=CycleResponse, status_code=201)
async def create_cycle(
    cycle: CycleCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new short call cycle for a position.
    
    The cycle number is auto-incremented based on existing cycles.
    """
    # Verify position exists and is active
    pos_result = await db.execute(
        select(Position).where(Position.id == cycle.position_id)
    )
    position = pos_result.scalar_one_or_none()
    
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")
    
    if position.status != "active":
        raise HTTPException(status_code=400, detail="Cannot add cycle to inactive position")
    
    # Check for existing open cycle
    open_cycle_result = await db.execute(
        select(ShortCallCycle)
        .where(ShortCallCycle.position_id == cycle.position_id)
        .where(ShortCallCycle.close_date.is_(None))
    )
    if open_cycle_result.scalar_one_or_none():
        raise HTTPException(
            status_code=400, 
            detail="Position already has an open cycle. Close it first or use the roll endpoint."
        )
    
    # Get next cycle number
    count_result = await db.execute(
        select(func.count(ShortCallCycle.id))
        .where(ShortCallCycle.position_id == cycle.position_id)
    )
    cycle_count = count_result.scalar() or 0
    next_cycle_number = cycle_count + 1
    
    # Create the cycle
    db_cycle = ShortCallCycle(
        position_id=cycle.position_id,
        cycle_number=next_cycle_number,
        short_strike=cycle.short_strike,
        short_expiration=cycle.short_expiration,
        entry_date=cycle.entry_date,
        entry_premium=cycle.entry_premium,
        entry_extrinsic=cycle.entry_extrinsic,
        stock_price_at_entry=cycle.stock_price_at_entry,
        notes=cycle.notes,
        created_at=datetime.now().isoformat(),
        updated_at=datetime.now().isoformat()
    )
    
    db.add(db_cycle)
    await db.commit()
    await db.refresh(db_cycle)
    
    return cycle_to_response(db_cycle)


@router.get("/{cycle_id}", response_model=CycleResponse)
async def get_cycle(
    cycle_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific cycle."""
    result = await db.execute(
        select(ShortCallCycle).where(ShortCallCycle.id == cycle_id)
    )
    cycle = result.scalar_one_or_none()
    
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")
    
    return cycle_to_response(cycle)


@router.patch("/{cycle_id}", response_model=CycleResponse)
async def update_cycle(
    cycle_id: str,
    updates: CycleUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a cycle's details."""
    result = await db.execute(
        select(ShortCallCycle).where(ShortCallCycle.id == cycle_id)
    )
    cycle = result.scalar_one_or_none()
    
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")
    
    # Apply updates
    update_data = updates.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(cycle, field, value)
    
    cycle.updated_at = datetime.now().isoformat()
    
    await db.commit()
    await db.refresh(cycle)
    
    return cycle_to_response(cycle)


@router.post("/{cycle_id}/close", response_model=CycleResponse)
async def close_cycle(
    cycle_id: str,
    close_data: CycleClose,
    db: AsyncSession = Depends(get_db)
):
    """Close a cycle with P&L calculation."""
    result = await db.execute(
        select(ShortCallCycle).where(ShortCallCycle.id == cycle_id)
    )
    cycle = result.scalar_one_or_none()
    
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")
    
    if cycle.close_date is not None:
        raise HTTPException(status_code=400, detail="Cycle is already closed")
    
    # Calculate P&L
    # P&L = Premium received - Price paid to close
    # If close_price is 0 (expired worthless), we keep full premium
    realized_pnl = cycle.entry_premium - close_data.close_price
    
    # Update cycle
    cycle.close_date = close_data.close_date
    cycle.close_price = close_data.close_price
    cycle.realized_pnl = round(realized_pnl, 2)
    cycle.close_reason = close_data.close_reason
    cycle.stock_price_at_close = close_data.stock_price_at_close
    cycle.updated_at = datetime.now().isoformat()
    
    await db.commit()
    await db.refresh(cycle)
    
    return cycle_to_response(cycle)


@router.post("/{cycle_id}/roll", response_model=dict)
async def roll_cycle(
    cycle_id: str,
    roll_data: RollCycleRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Roll a cycle: close the current one and open a new one.
    
    This is a convenience endpoint that combines closing and opening.
    """
    result = await db.execute(
        select(ShortCallCycle).where(ShortCallCycle.id == cycle_id)
    )
    old_cycle = result.scalar_one_or_none()
    
    if not old_cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")
    
    if old_cycle.close_date is not None:
        raise HTTPException(status_code=400, detail="Cycle is already closed")
    
    # Get position
    pos_result = await db.execute(
        select(Position).where(Position.id == old_cycle.position_id)
    )
    position = pos_result.scalar_one_or_none()
    
    if position.status != "active":
        raise HTTPException(status_code=400, detail="Position is not active")
    
    # Close old cycle
    realized_pnl = old_cycle.entry_premium - roll_data.close_price
    old_cycle.close_date = roll_data.close_date
    old_cycle.close_price = roll_data.close_price
    old_cycle.realized_pnl = round(realized_pnl, 2)
    old_cycle.close_reason = "rolled"
    old_cycle.stock_price_at_close = roll_data.stock_price_at_close
    old_cycle.updated_at = datetime.now().isoformat()
    
    # Create new cycle
    new_cycle = ShortCallCycle(
        position_id=old_cycle.position_id,
        cycle_number=old_cycle.cycle_number + 1,
        short_strike=roll_data.new_short_strike,
        short_expiration=roll_data.new_short_expiration,
        entry_date=roll_data.close_date,  # Roll date is entry date for new cycle
        entry_premium=roll_data.new_entry_premium,
        entry_extrinsic=roll_data.new_entry_extrinsic,
        stock_price_at_entry=roll_data.stock_price_at_entry,
        notes=roll_data.notes,
        created_at=datetime.now().isoformat(),
        updated_at=datetime.now().isoformat()
    )
    
    db.add(new_cycle)
    await db.commit()
    await db.refresh(old_cycle)
    await db.refresh(new_cycle)
    
    # Calculate roll net credit/debit
    roll_net = roll_data.new_entry_premium - roll_data.close_price
    
    return {
        "success": True,
        "closed_cycle": cycle_to_response(old_cycle),
        "new_cycle": cycle_to_response(new_cycle),
        "roll_summary": {
            "close_cost": roll_data.close_price,
            "new_credit": roll_data.new_entry_premium,
            "net_credit": round(roll_net, 2),
            "old_cycle_pnl": round(realized_pnl, 2)
        }
    }


@router.delete("/{cycle_id}")
async def delete_cycle(
    cycle_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Delete a cycle."""
    result = await db.execute(
        select(ShortCallCycle).where(ShortCallCycle.id == cycle_id)
    )
    cycle = result.scalar_one_or_none()
    
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")
    
    await db.delete(cycle)
    await db.commit()
    
    return {"deleted": True, "id": cycle_id}
