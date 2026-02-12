"""
IPMCC Commander - Dashboard Router
Portfolio-level metrics and aggregations
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List
from datetime import date, datetime, timedelta

from app.database import get_db
from app.models.position import Position
from app.models.cycle import ShortCallCycle
from app.services.market_data import market_data
from app.services.greeks_engine import greeks_engine
from app.services.validation_engine import validation_engine
from app.schemas.analysis import (
    PortfolioGreeks,
    IncomeVelocity,
    ActionItem,
    DashboardSummary
)

router = APIRouter()


@router.get("/summary", response_model=DashboardSummary)
async def get_dashboard_summary(db: AsyncSession = Depends(get_db)):
    """
    Get complete dashboard summary with all metrics.
    
    Returns:
    - Portfolio Greeks (delta, theta, vega)
    - Income velocity
    - Action items
    - P&L summary
    """
    # Get all active positions with cycles
    result = await db.execute(
        select(Position)
        .options(selectinload(Position.cycles))
        .where(Position.status == "active")
    )
    positions = result.scalars().all()
    
    # Initialize aggregates
    total_delta = 0.0
    total_theta = 0.0
    total_vega = 0.0
    total_capital = 0.0
    weekly_extrinsic = 0.0
    
    pnl_today = 0.0
    pnl_week = 0.0
    pnl_mtd = 0.0
    pnl_ytd = 0.0
    cumulative_extrinsic = 0.0
    
    action_items: List[ActionItem] = []
    
    for position in positions:
        # Get current market data
        quote = market_data.get_quote(position.ticker)
        stock_price = quote.get("price")
        
        if not stock_price:
            continue
        
        # Calculate position Greeks
        long_dte = max(0, (date.fromisoformat(position.long_expiration) - date.today()).days)
        
        # Find active cycle
        active_cycle = None
        for cycle in position.cycles:
            if cycle.close_date is None:
                active_cycle = cycle
                break
        
        short_dte = 0
        short_strike = stock_price  # Default to ATM if no active cycle
        short_extrinsic = 0.0
        
        if active_cycle:
            short_dte = max(0, (date.fromisoformat(active_cycle.short_expiration) - date.today()).days)
            short_strike = active_cycle.short_strike
            
            # Estimate current extrinsic
            short_greeks = greeks_engine.calculate_call_greeks(
                stock_price=stock_price,
                strike=short_strike,
                days_to_expiry=short_dte,
                volatility=25.0  # Default IV
            )
            short_extrinsic = short_greeks.get("extrinsic", 0)
        
        # Calculate position Greeks
        long_greeks = greeks_engine.calculate_call_greeks(
            stock_price=stock_price,
            strike=position.long_strike,
            days_to_expiry=long_dte,
            volatility=25.0
        )
        
        short_greeks = greeks_engine.calculate_call_greeks(
            stock_price=stock_price,
            strike=short_strike,
            days_to_expiry=short_dte,
            volatility=25.0
        )
        
        # Aggregate Greeks
        qty = position.quantity
        total_delta += (long_greeks.get("delta", 0) - short_greeks.get("delta", 0)) * qty
        total_theta += (-short_greeks.get("theta", 0) + long_greeks.get("theta", 0)) * qty
        total_vega += (long_greeks.get("vega", 0) - short_greeks.get("vega", 0)) * qty
        
        # Capital tracking
        capital = position.entry_price * 100 * qty
        total_capital += capital
        
        # Weekly extrinsic potential
        if active_cycle:
            weekly_extrinsic += active_cycle.entry_extrinsic * 100 * qty
        
        # Cumulative premium from all cycles
        for cycle in position.cycles:
            cumulative_extrinsic += cycle.entry_premium * 100 * qty
        
        # Update current value
        position.current_value = long_greeks.get("price")
        
        # Calculate P&L (simplified - would need historical data for proper calculation)
        leap_pnl = (long_greeks.get("price", position.entry_price) - position.entry_price) * 100 * qty
        cycle_pnl = sum(c.realized_pnl or 0 for c in position.cycles) * 100 * qty
        position_pnl = leap_pnl + cycle_pnl
        
        # Add to totals (simplified - assumes all gains are recent)
        pnl_ytd += position_pnl
        pnl_mtd += position_pnl * 0.3  # Rough estimate
        pnl_week += position_pnl * 0.1
        pnl_today += position_pnl * 0.02
        
        # Check for action items
        if active_cycle:
            extrinsic_remaining_pct = short_extrinsic / active_cycle.entry_extrinsic if active_cycle.entry_extrinsic > 0 else 1.0
            
            # Roll due
            if extrinsic_remaining_pct < 0.20:
                action_items.append(ActionItem(
                    priority="high" if extrinsic_remaining_pct < 0.10 else "medium",
                    type="roll_due",
                    position_id=position.id,
                    ticker=position.ticker,
                    message=f"{position.ticker} short call needs rolling",
                    detail=f"{extrinsic_remaining_pct*100:.0f}% extrinsic remaining"
                ))
        
        # LEAP expiring
        if long_dte < 60:
            action_items.append(ActionItem(
                priority="high",
                type="leap_expiring",
                position_id=position.id,
                ticker=position.ticker,
                message=f"{position.ticker} LEAP expiring soon",
                detail=f"Only {long_dte} days remaining"
            ))
        
        # Emergency exit check
        position_pnl_pct = (position_pnl / capital * 100) if capital > 0 else 0
        if position_pnl_pct < -30:
            action_items.append(ActionItem(
                priority="critical",
                type="emergency_exit",
                position_id=position.id,
                ticker=position.ticker,
                message=f"{position.ticker} exceeds loss threshold",
                detail=f"Position down {position_pnl_pct:.1f}%"
            ))
        elif position_pnl_pct > 50:
            action_items.append(ActionItem(
                priority="low",
                type="profit_target",
                position_id=position.id,
                ticker=position.ticker,
                message=f"{position.ticker} hit profit target",
                detail=f"Position up {position_pnl_pct:.1f}%"
            ))
    
    # Commit any updates
    await db.commit()
    
    # Sort action items by priority
    priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    action_items.sort(key=lambda x: priority_order.get(x.priority, 4))
    
    # Calculate vega/theta ratio
    vega_theta_ratio = abs(total_vega / total_theta) if total_theta != 0 else 0
    
    # Income velocity
    current_velocity = (weekly_extrinsic / total_capital * 100) if total_capital > 0 else 0
    
    # Get total position counts
    total_result = await db.execute(select(func.count(Position.id)))
    total_positions = total_result.scalar() or 0
    
    return DashboardSummary(
        greeks=PortfolioGreeks(
            net_delta=round(total_delta, 1),
            total_theta=round(total_theta * 100, 2),  # Convert to dollars
            total_vega=round(total_vega, 2),
            vega_theta_ratio=round(vega_theta_ratio, 2),
            position_count=len(positions)
        ),
        income_velocity=IncomeVelocity(
            current_weekly=round(current_velocity, 2),
            rolling_4_week=round(current_velocity * 0.95, 2),  # Simplified
            total_capital_deployed=round(total_capital, 2),
            weekly_extrinsic_target=round(total_capital * 0.02, 2)  # 2% target
        ),
        action_items=action_items,
        pnl_today=round(pnl_today, 2),
        pnl_week=round(pnl_week, 2),
        pnl_mtd=round(pnl_mtd, 2),
        pnl_ytd=round(pnl_ytd, 2),
        cumulative_extrinsic=round(cumulative_extrinsic, 2),
        active_positions=len(positions),
        total_positions=total_positions
    )


@router.get("/greeks")
async def get_portfolio_greeks(db: AsyncSession = Depends(get_db)):
    """Get just the portfolio Greeks."""
    summary = await get_dashboard_summary(db)
    return summary.greeks


@router.get("/alerts")
async def get_alerts(db: AsyncSession = Depends(get_db)):
    """Get just the action items/alerts."""
    summary = await get_dashboard_summary(db)
    return {
        "items": summary.action_items,
        "count": len(summary.action_items),
        "has_critical": any(item.priority == "critical" for item in summary.action_items)
    }


@router.get("/velocity")
async def get_income_velocity(db: AsyncSession = Depends(get_db)):
    """Get income velocity metrics."""
    summary = await get_dashboard_summary(db)
    return summary.income_velocity
