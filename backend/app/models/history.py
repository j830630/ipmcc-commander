"""
IPMCC Commander - Trade History & Portfolio Snapshot Models
Tracks all trades and daily portfolio snapshots for analytics
"""

from sqlalchemy import Column, String, Float, Integer, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
import uuid
from datetime import datetime
import enum


class TradeType(str, enum.Enum):
    """Trade type enumeration."""
    OPEN_LONG = "open_long"      # Buy to open LEAP
    CLOSE_LONG = "close_long"    # Sell to close LEAP
    OPEN_SHORT = "open_short"    # Sell to open short call
    CLOSE_SHORT = "close_short"  # Buy to close short call
    ROLL_SHORT = "roll_short"    # Roll short call (close + open)
    ASSIGNMENT = "assignment"    # Short call assigned
    EXPIRATION = "expiration"    # Option expired


class TradeHistory(Base):
    """
    Records every trade for P&L tracking and analytics.
    Each trade is immutable once recorded.
    """
    __tablename__ = "trade_history"
    
    # Primary key
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Position reference (optional - some trades may be standalone)
    position_id = Column(String(36), ForeignKey("positions.id"), nullable=True, index=True)
    cycle_id = Column(String(36), ForeignKey("short_call_cycles.id"), nullable=True)
    
    # Trade details
    trade_type = Column(String(20), nullable=False, index=True)
    ticker = Column(String(10), nullable=False, index=True)
    trade_date = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    trade_time = Column(String(8))  # HH:MM:SS
    
    # Option details
    option_type = Column(String(4), nullable=False)  # CALL or PUT
    strike = Column(Float, nullable=False)
    expiration = Column(String(10), nullable=False)  # YYYY-MM-DD
    
    # Execution details
    quantity = Column(Integer, nullable=False)
    price = Column(Float, nullable=False)  # Per-share price
    total_value = Column(Float, nullable=False)  # price * quantity * 100
    fees = Column(Float, default=0.0)
    
    # P&L (for closing trades)
    realized_pnl = Column(Float)
    
    # Greeks at time of trade (optional)
    delta = Column(Float)
    theta = Column(Float)
    iv = Column(Float)
    
    # Underlying price at trade time
    underlying_price = Column(Float)
    
    # Strategy classification
    strategy = Column(String(20), default="ipmcc")  # ipmcc, 112-trade, strangle, etc.
    
    # Notes
    notes = Column(Text)
    
    # Timestamps
    created_at = Column(String(25), default=lambda: datetime.now().isoformat())
    
    def __repr__(self):
        return f"<Trade {self.trade_type} {self.ticker} ${self.strike} {self.trade_date}>"
    
    @property
    def is_debit(self) -> bool:
        """Returns True if this trade was a debit (cost money)."""
        return self.trade_type in [TradeType.OPEN_LONG.value, TradeType.CLOSE_SHORT.value]
    
    @property
    def net_cash_flow(self) -> float:
        """Returns the cash flow impact (positive = received, negative = paid)."""
        if self.is_debit:
            return -abs(self.total_value) - self.fees
        return abs(self.total_value) - self.fees


class PortfolioSnapshot(Base):
    """
    Daily portfolio snapshots for charting and analytics.
    One record per day capturing end-of-day state.
    """
    __tablename__ = "portfolio_snapshots"
    
    # Primary key (date-based for easy querying)
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    snapshot_date = Column(String(10), nullable=False, unique=True, index=True)  # YYYY-MM-DD
    
    # Portfolio totals
    total_value = Column(Float, nullable=False)  # Total portfolio value
    cash_balance = Column(Float, default=0.0)  # Cash not in positions
    positions_value = Column(Float, default=0.0)  # Value of all positions
    
    # P&L metrics
    daily_pnl = Column(Float, default=0.0)  # Change from previous day
    daily_pnl_percent = Column(Float, default=0.0)
    cumulative_pnl = Column(Float, default=0.0)  # Total P&L since inception
    cumulative_pnl_percent = Column(Float, default=0.0)
    
    # Income tracking
    premium_collected_today = Column(Float, default=0.0)
    premium_collected_mtd = Column(Float, default=0.0)  # Month to date
    premium_collected_ytd = Column(Float, default=0.0)  # Year to date
    premium_collected_total = Column(Float, default=0.0)  # All time
    
    # Position counts
    active_positions = Column(Integer, default=0)
    active_short_calls = Column(Integer, default=0)
    
    # Greeks aggregates
    portfolio_delta = Column(Float)
    portfolio_theta = Column(Float)
    portfolio_vega = Column(Float)
    beta_weighted_delta = Column(Float)  # SPY-equivalent
    
    # Risk metrics
    max_drawdown = Column(Float)  # Max drawdown to date
    win_rate = Column(Float)  # % of winning trades
    avg_win = Column(Float)
    avg_loss = Column(Float)
    
    # Timestamps
    created_at = Column(String(25), default=lambda: datetime.now().isoformat())
    
    def __repr__(self):
        return f"<Snapshot {self.snapshot_date} ${self.total_value:,.2f}>"


class EarningsEvent(Base):
    """
    Tracks earnings dates for tickers in the portfolio.
    Used to warn about positions with upcoming earnings.
    """
    __tablename__ = "earnings_events"
    
    # Primary key
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Ticker and date
    ticker = Column(String(10), nullable=False, index=True)
    earnings_date = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    earnings_time = Column(String(10))  # BMO (before market), AMC (after market close), or time
    
    # Estimates (if available)
    eps_estimate = Column(Float)
    revenue_estimate = Column(Float)
    
    # Actual results (filled in after earnings)
    eps_actual = Column(Float)
    revenue_actual = Column(Float)
    eps_surprise_percent = Column(Float)
    
    # Metadata
    confirmed = Column(Boolean, default=False)  # Is date confirmed vs estimated
    source = Column(String(50))  # Where we got this data
    
    # Timestamps
    created_at = Column(String(25), default=lambda: datetime.now().isoformat())
    updated_at = Column(String(25), default=lambda: datetime.now().isoformat())
    
    def __repr__(self):
        return f"<Earnings {self.ticker} {self.earnings_date}>"
    
    @property
    def days_until(self) -> int:
        """Calculate days until earnings."""
        from datetime import date
        earnings = date.fromisoformat(self.earnings_date)
        today = date.today()
        return (earnings - today).days


class RollSuggestion(Base):
    """
    Stores roll suggestions generated by the analysis engine.
    """
    __tablename__ = "roll_suggestions"
    
    # Primary key
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Related entities
    position_id = Column(String(36), ForeignKey("positions.id"), nullable=False, index=True)
    cycle_id = Column(String(36), ForeignKey("short_call_cycles.id"), nullable=True)
    
    # Suggestion details
    suggestion_type = Column(String(30), nullable=False)  # roll_up, roll_down, roll_out, close, take_profit
    urgency = Column(String(10), nullable=False)  # low, medium, high, critical
    
    # Current position state
    current_strike = Column(Float)
    current_expiration = Column(String(10))
    current_price = Column(Float)
    current_delta = Column(Float)
    current_dte = Column(Integer)
    
    # Suggested action
    suggested_strike = Column(Float)
    suggested_expiration = Column(String(10))
    estimated_credit = Column(Float)  # Expected credit/debit from roll
    
    # Reasoning
    trigger_reason = Column(String(100))  # Why this suggestion was generated
    detailed_reasoning = Column(Text)
    
    # Status
    status = Column(String(20), default="pending")  # pending, executed, dismissed, expired
    executed_at = Column(String(25))
    dismissed_at = Column(String(25))
    dismissed_reason = Column(String(100))
    
    # Timestamps
    created_at = Column(String(25), default=lambda: datetime.now().isoformat())
    expires_at = Column(String(25))  # When this suggestion becomes stale
    
    def __repr__(self):
        return f"<RollSuggestion {self.suggestion_type} {self.urgency}>"
