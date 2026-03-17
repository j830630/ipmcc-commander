"""
IPMCC Commander - Analytics Service
Aggregates portfolio data for charts and metrics
"""

import logging
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
from collections import defaultdict
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.position import Position
from app.models.cycle import ShortCallCycle
from app.models.history import TradeHistory, PortfolioSnapshot

logger = logging.getLogger(__name__)


class AnalyticsService:
    """
    Provides analytics and aggregated metrics for the portfolio.
    """
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_portfolio_summary(self) -> Dict[str, Any]:
        """Get high-level portfolio summary including trade history."""
        # Get all positions
        positions = self.db.query(Position).all()
        active_positions = [p for p in positions if p.status == "active"]
        closed_positions = [p for p in positions if p.status == "closed"]
        
        # Calculate totals from positions
        total_capital = sum(p.capital_at_risk for p in active_positions)
        total_leap_pnl = sum(p.leap_pnl for p in active_positions)
        
        # Get trade history stats
        trades = self.db.query(TradeHistory).all()
        
        # Calculate from trade history
        total_credits = 0
        total_debits = 0
        total_fees = 0
        trades_by_ticker = defaultdict(lambda: {"credits": 0, "debits": 0, "count": 0})
        
        for trade in trades:
            total_fees += trade.fees or 0
            if trade.trade_type in ["open_short", "close_long"]:
                total_credits += trade.total_value
                trades_by_ticker[trade.ticker]["credits"] += trade.total_value
            else:
                total_debits += trade.total_value
                trades_by_ticker[trade.ticker]["debits"] += trade.total_value
            trades_by_ticker[trade.ticker]["count"] += 1
        
        # Also check cycles for backward compatibility
        winning_cycles = 0
        losing_cycles = 0
        cycle_premium = 0
        
        all_cycles = self.db.query(ShortCallCycle).all()
        for cycle in all_cycles:
            if cycle.status == "closed":
                pnl = (cycle.premium_collected or 0) - ((cycle.close_price or 0) * 100 * (cycle.quantity or 1))
                if pnl > 0:
                    winning_cycles += 1
                else:
                    losing_cycles += 1
            cycle_premium += cycle.premium_collected or 0
        
        # Calculate totals (use trade history if available, fallback to cycles)
        if trades:
            net_premium = total_credits - total_debits - total_fees
            total_trades = len(trades)
            # Estimate win rate from credits vs debits per ticker
            winning_tickers = sum(1 for t in trades_by_ticker.values() if t["credits"] > t["debits"])
            total_tickers = len(trades_by_ticker)
            win_rate = (winning_tickers / total_tickers * 100) if total_tickers > 0 else 0
        else:
            net_premium = cycle_premium
            total_trades = winning_cycles + losing_cycles
            win_rate = (winning_cycles / total_trades * 100) if total_trades > 0 else 0
        
        total_pnl = total_leap_pnl + net_premium
        
        return {
            "total_capital_deployed": total_capital,
            "active_positions": len(active_positions),
            "closed_positions": len(closed_positions),
            "total_premium_collected": total_credits if trades else cycle_premium,
            "total_premium_paid": total_debits,
            "total_fees": total_fees,
            "net_premium": net_premium,
            "leap_pnl": total_leap_pnl,
            "total_pnl": total_pnl,
            "total_pnl_percent": (total_pnl / total_capital * 100) if total_capital > 0 else 0,
            "win_rate": win_rate,
            "winning_trades": winning_cycles,
            "losing_trades": losing_cycles,
            "total_trades": total_trades,
            "unique_tickers": len(trades_by_ticker),
        }
    
    def get_pnl_over_time(self, days: int = 90) -> List[Dict[str, Any]]:
        """
        Get P&L data over time for charting.
        Returns daily data points calculated from trade history.
        """
        start_date = (date.today() - timedelta(days=days)).isoformat()
        
        # Try to get from snapshots first
        snapshots = self.db.query(PortfolioSnapshot).filter(
            PortfolioSnapshot.snapshot_date >= start_date
        ).order_by(PortfolioSnapshot.snapshot_date).all()
        
        if snapshots:
            return [
                {
                    "date": s.snapshot_date,
                    "total_value": s.total_value,
                    "daily_pnl": s.daily_pnl,
                    "cumulative_pnl": s.cumulative_pnl,
                    "premium_collected": s.premium_collected_total,
                }
                for s in snapshots
            ]
        
        # Generate from trade history
        trades = self.db.query(TradeHistory).filter(
            TradeHistory.trade_date >= start_date
        ).order_by(TradeHistory.trade_date).all()
        
        # Calculate daily net cash flow (credits - debits)
        daily_cashflow = defaultdict(lambda: {"credits": 0, "debits": 0, "fees": 0})
        
        for trade in trades:
            trade_date = trade.trade_date
            fees = trade.fees or 0
            daily_cashflow[trade_date]["fees"] += fees
            
            if trade.trade_type in ["open_short", "close_long"]:
                # Credit trades (money received)
                daily_cashflow[trade_date]["credits"] += trade.total_value
            else:
                # Debit trades (money paid)
                daily_cashflow[trade_date]["debits"] += trade.total_value
        
        # Build cumulative data
        result = []
        cumulative = 0
        cumulative_credits = 0
        current_date = date.today() - timedelta(days=days)
        
        while current_date <= date.today():
            date_str = current_date.isoformat()
            day_data = daily_cashflow.get(date_str, {"credits": 0, "debits": 0, "fees": 0})
            
            daily_net = day_data["credits"] - day_data["debits"] - day_data["fees"]
            cumulative += daily_net
            cumulative_credits += day_data["credits"]
            
            result.append({
                "date": date_str,
                "daily_pnl": daily_net,
                "cumulative_pnl": cumulative,
                "premium_collected": cumulative_credits,
                "credits": day_data["credits"],
                "debits": day_data["debits"],
            })
            current_date += timedelta(days=1)
        
        return result
    
    def get_income_by_period(self, period: str = "monthly") -> List[Dict[str, Any]]:
        """
        Get premium income aggregated by period from trade history.
        period: 'daily', 'weekly', 'monthly'
        """
        # Get credit trades (premium received)
        trades = self.db.query(TradeHistory).filter(
            TradeHistory.trade_type.in_(["open_short", "close_long"])
        ).all()
        
        grouping = defaultdict(float)
        
        for trade in trades:
            trade_date = trade.trade_date
            
            if period == "daily":
                key = trade_date
            elif period == "weekly":
                d = date.fromisoformat(trade_date)
                week_start = d - timedelta(days=d.weekday())
                key = week_start.isoformat()
            else:  # monthly
                key = trade_date[:7]  # YYYY-MM
            
            grouping[key] += trade.total_value or 0
        
        # If no trades, fall back to cycles
        if not grouping:
            cycles = self.db.query(ShortCallCycle).filter(
                ShortCallCycle.status == "closed"
            ).all()
            
            for cycle in cycles:
                if cycle.close_date:
                    if period == "daily":
                        key = cycle.close_date
                    elif period == "weekly":
                        d = date.fromisoformat(cycle.close_date)
                        week_start = d - timedelta(days=d.weekday())
                        key = week_start.isoformat()
                    else:
                        key = cycle.close_date[:7]
                    grouping[key] += cycle.premium_collected or 0
        
        return [
            {"period": k, "premium": v}
            for k, v in sorted(grouping.items())
        ]
    
    def get_performance_by_ticker(self) -> List[Dict[str, Any]]:
        """Get performance breakdown by ticker from trade history."""
        ticker_stats = defaultdict(lambda: {
            "credits": 0,
            "debits": 0,
            "fees": 0,
            "trades": 0,
            "credit_trades": 0,
        })
        
        # Get from trade history first
        trades = self.db.query(TradeHistory).all()
        
        for trade in trades:
            ticker = trade.ticker
            ticker_stats[ticker]["trades"] += 1
            ticker_stats[ticker]["fees"] += trade.fees or 0
            
            if trade.trade_type in ["open_short", "close_long"]:
                ticker_stats[ticker]["credits"] += trade.total_value
                ticker_stats[ticker]["credit_trades"] += 1
            else:
                ticker_stats[ticker]["debits"] += trade.total_value
        
        # Also include position/cycle data for backward compatibility
        positions = self.db.query(Position).all()
        for position in positions:
            ticker = position.ticker
            # Only add if not already from trade history
            if ticker not in ticker_stats or ticker_stats[ticker]["trades"] == 0:
                for cycle in position.cycles:
                    ticker_stats[ticker]["trades"] += 1
                    ticker_stats[ticker]["credits"] += cycle.premium_collected or 0
                    if cycle.status == "closed" and (cycle.close_price or 0) > 0:
                        ticker_stats[ticker]["debits"] += (cycle.close_price or 0) * 100 * (cycle.quantity or 1)
        
        result = []
        for ticker, stats in ticker_stats.items():
            net_pnl = stats["credits"] - stats["debits"] - stats["fees"]
            win_rate = (stats["credit_trades"] / stats["trades"] * 100) if stats["trades"] > 0 else 0
            result.append({
                "ticker": ticker,
                "total_pnl": net_pnl,
                "premium_collected": stats["credits"],
                "trades": stats["trades"],
                "win_rate": win_rate,
            })
        
        # Sort by total_pnl descending
        result.sort(key=lambda x: x["total_pnl"], reverse=True)
        return result
    
    def get_performance_by_strategy(self) -> List[Dict[str, Any]]:
        """Get performance breakdown by strategy."""
        # For now, assume all are IPMCC since that's the main strategy
        # In future, could track strategy per position
        trades = self.db.query(TradeHistory).all()
        
        strategy_stats = defaultdict(lambda: {
            "total_pnl": 0,
            "trades": 0,
            "wins": 0,
            "total_premium": 0,
        })
        
        for trade in trades:
            strategy = trade.strategy or "ipmcc"
            strategy_stats[strategy]["trades"] += 1
            
            if trade.realized_pnl:
                strategy_stats[strategy]["total_pnl"] += trade.realized_pnl
                if trade.realized_pnl > 0:
                    strategy_stats[strategy]["wins"] += 1
            
            if not trade.is_debit:
                strategy_stats[strategy]["total_premium"] += trade.total_value
        
        # If no trades, return sample data
        if not strategy_stats:
            return [
                {"strategy": "ipmcc", "total_pnl": 0, "trades": 0, "win_rate": 0, "total_premium": 0}
            ]
        
        return [
            {
                "strategy": strategy,
                "total_pnl": stats["total_pnl"],
                "trades": stats["trades"],
                "win_rate": (stats["wins"] / stats["trades"] * 100) if stats["trades"] > 0 else 0,
                "total_premium": stats["total_premium"],
            }
            for strategy, stats in strategy_stats.items()
        ]
    
    def get_greeks_history(self, days: int = 30) -> List[Dict[str, Any]]:
        """Get portfolio Greeks over time."""
        snapshots = self.db.query(PortfolioSnapshot).filter(
            PortfolioSnapshot.snapshot_date >= (date.today() - timedelta(days=days)).isoformat()
        ).order_by(PortfolioSnapshot.snapshot_date).all()
        
        if snapshots:
            return [
                {
                    "date": s.snapshot_date,
                    "delta": s.portfolio_delta,
                    "theta": s.portfolio_theta,
                    "vega": s.portfolio_vega,
                    "beta_weighted_delta": s.beta_weighted_delta,
                }
                for s in snapshots
            ]
        
        # Return empty if no data
        return []
    
    def get_drawdown_analysis(self) -> Dict[str, Any]:
        """Calculate drawdown metrics."""
        snapshots = self.db.query(PortfolioSnapshot).order_by(
            PortfolioSnapshot.snapshot_date
        ).all()
        
        if not snapshots:
            return {
                "max_drawdown": 0,
                "max_drawdown_date": None,
                "current_drawdown": 0,
                "recovery_days": 0,
            }
        
        # Calculate running max and drawdowns
        peak = snapshots[0].total_value if snapshots[0].total_value else 0
        max_drawdown = 0
        max_drawdown_date = None
        
        for snapshot in snapshots:
            value = snapshot.total_value or 0
            if value > peak:
                peak = value
            
            drawdown = (peak - value) / peak if peak > 0 else 0
            if drawdown > max_drawdown:
                max_drawdown = drawdown
                max_drawdown_date = snapshot.snapshot_date
        
        # Current drawdown
        current_value = snapshots[-1].total_value if snapshots else 0
        current_drawdown = (peak - current_value) / peak if peak > 0 else 0
        
        return {
            "max_drawdown": max_drawdown * 100,
            "max_drawdown_date": max_drawdown_date,
            "current_drawdown": current_drawdown * 100,
            "peak_value": peak,
            "current_value": current_value,
        }
    
    def get_trade_statistics(self) -> Dict[str, Any]:
        """Get detailed trade statistics from trade history."""
        # Get all trades
        trades = self.db.query(TradeHistory).order_by(TradeHistory.trade_date).all()
        
        if not trades:
            # Fall back to cycles
            cycles = self.db.query(ShortCallCycle).filter(
                ShortCallCycle.status == "closed"
            ).all()
            
            if not cycles:
                return {
                    "total_trades": 0,
                    "winning_trades": 0,
                    "losing_trades": 0,
                    "win_rate": 0,
                    "avg_trade_duration": 0,
                    "avg_win": 0,
                    "avg_loss": 0,
                    "largest_win": 0,
                    "largest_loss": 0,
                    "total_profit": 0,
                    "total_loss": 0,
                    "net_profit": 0,
                    "profit_factor": 0,
                }
            
            # Calculate from cycles
            wins = []
            losses = []
            durations = []
            
            for cycle in cycles:
                pnl = (cycle.premium_collected or 0) - ((cycle.close_price or 0) * 100 * (cycle.quantity or 1))
                if pnl > 0:
                    wins.append(pnl)
                else:
                    losses.append(abs(pnl))
                
                if cycle.entry_date and cycle.close_date:
                    try:
                        entry = date.fromisoformat(cycle.entry_date)
                        close = date.fromisoformat(cycle.close_date)
                        durations.append((close - entry).days)
                    except:
                        pass
            
            total_wins = sum(wins)
            total_losses = sum(losses)
            
            return {
                "total_trades": len(cycles),
                "winning_trades": len(wins),
                "losing_trades": len(losses),
                "win_rate": (len(wins) / len(cycles) * 100) if cycles else 0,
                "avg_trade_duration": sum(durations) / len(durations) if durations else 0,
                "avg_win": sum(wins) / len(wins) if wins else 0,
                "avg_loss": sum(losses) / len(losses) if losses else 0,
                "largest_win": max(wins) if wins else 0,
                "largest_loss": max(losses) if losses else 0,
                "total_profit": total_wins,
                "total_loss": total_losses,
                "net_profit": total_wins - total_losses,
                "profit_factor": (total_wins / total_losses) if total_losses > 0 else 0,
            }
        
        # Calculate from trade history
        credits = []  # Credit trades (income)
        debits = []   # Debit trades (cost)
        
        for trade in trades:
            if trade.trade_type in ["open_short", "close_long"]:
                credits.append(trade.total_value)
            else:
                debits.append(trade.total_value)
        
        total_credits = sum(credits)
        total_debits = sum(debits)
        total_fees = sum(t.fees or 0 for t in trades)
        
        # For win rate, count credit trades as "wins"
        credit_count = len(credits)
        debit_count = len(debits)
        
        # Calculate average trade size
        avg_credit = sum(credits) / len(credits) if credits else 0
        avg_debit = sum(debits) / len(debits) if debits else 0
        
        return {
            "total_trades": len(trades),
            "winning_trades": credit_count,
            "losing_trades": debit_count,
            "win_rate": (credit_count / len(trades) * 100) if trades else 0,
            "avg_trade_duration": 7,  # Default to weekly for options
            "avg_win": avg_credit,
            "avg_loss": avg_debit,
            "largest_win": max(credits) if credits else 0,
            "largest_loss": max(debits) if debits else 0,
            "total_profit": total_credits,
            "total_loss": total_debits,
            "total_fees": total_fees,
            "net_profit": total_credits - total_debits - total_fees,
            "profit_factor": (total_credits / total_debits) if total_debits > 0 else 0,
        }
    
    def record_daily_snapshot(self) -> Optional[PortfolioSnapshot]:
        """Record today's portfolio snapshot."""
        today = date.today().isoformat()
        
        # Check if already exists
        existing = self.db.query(PortfolioSnapshot).filter(
            PortfolioSnapshot.snapshot_date == today
        ).first()
        
        if existing:
            return existing
        
        # Calculate current portfolio state
        summary = self.get_portfolio_summary()
        
        # Get previous snapshot for daily change
        yesterday = (date.today() - timedelta(days=1)).isoformat()
        prev_snapshot = self.db.query(PortfolioSnapshot).filter(
            PortfolioSnapshot.snapshot_date == yesterday
        ).first()
        
        prev_value = prev_snapshot.total_value if prev_snapshot else summary["total_capital_deployed"]
        current_value = summary["total_capital_deployed"] + summary["total_pnl"]
        
        daily_pnl = current_value - prev_value
        daily_pnl_percent = (daily_pnl / prev_value * 100) if prev_value > 0 else 0
        
        snapshot = PortfolioSnapshot(
            snapshot_date=today,
            total_value=current_value,
            positions_value=summary["total_capital_deployed"],
            daily_pnl=daily_pnl,
            daily_pnl_percent=daily_pnl_percent,
            cumulative_pnl=summary["total_pnl"],
            cumulative_pnl_percent=summary["total_pnl_percent"],
            premium_collected_total=summary["total_premium_collected"],
            active_positions=summary["active_positions"],
            win_rate=summary["win_rate"],
        )
        
        self.db.add(snapshot)
        self.db.commit()
        self.db.refresh(snapshot)
        
        return snapshot


def get_analytics_service(db: Session) -> AnalyticsService:
    """Get analytics service instance."""
    return AnalyticsService(db)
