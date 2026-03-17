"""
IPMCC Commander - Short Call Cycle Model
Represents a single short call cycle within an IPMCC position
"""

from sqlalchemy import Column, String, Float, Integer, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
import uuid
from datetime import datetime
import enum


class CloseReason(str, enum.Enum):
    """Reasons for closing a short call cycle."""
    EXPIRED_OTM = "expired_otm"  # Expired worthless (out of the money)
    EXPIRED_ITM = "expired_itm"  # Expired in the money
    ROLLED = "rolled"  # Rolled to next expiration
    EARLY_CLOSE = "early_close"  # Closed early for profit
    ASSIGNMENT = "assignment"  # Got assigned


class ShortCallCycle(Base):
    """
    Represents a single short call cycle.
    
    In the Income PMCC strategy, each LEAP position has multiple short call
    cycles over its lifetime (typically weekly). This model tracks each cycle
    individually to calculate cumulative premium and P&L.
    
    Key insight: The strategy's success is measured by cumulative extrinsic
    value collected, not individual cycle wins/losses.
    """
    __tablename__ = "short_call_cycles"
    
    # Primary key
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Foreign key to position
    position_id = Column(String(36), ForeignKey("positions.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Cycle tracking
    cycle_number = Column(Integer, nullable=False)
    
    # Short call details
    short_strike = Column(Float, nullable=False)
    short_expiration = Column(String(10), nullable=False)  # ISO date
    entry_date = Column(String(10), nullable=False)
    entry_premium = Column(Float, nullable=False)  # Total premium received
    entry_extrinsic = Column(Float, nullable=False)  # Extrinsic portion (this is what we care about!)
    
    # Close details
    close_date = Column(String(10))
    close_price = Column(Float)  # Price paid to close (0 if expired worthless)
    realized_pnl = Column(Float)  # entry_premium - close_price
    close_reason = Column(String(20))
    
    # Price context (for analysis)
    stock_price_at_entry = Column(Float)
    stock_price_at_close = Column(Float)
    
    # Metadata
    notes = Column(Text)
    created_at = Column(String(25), default=lambda: datetime.now().isoformat())
    updated_at = Column(String(25), default=lambda: datetime.now().isoformat())
    
    # Relationship back to position
    position = relationship("Position", back_populates="cycles")
    
    def __repr__(self):
        return f"<Cycle #{self.cycle_number} ${self.short_strike}c {self.short_expiration}>"
    
    @property
    def dte_remaining(self) -> int:
        """Calculate days to expiration for this cycle."""
        from datetime import date
        if self.close_date:
            return 0
        exp_date = date.fromisoformat(self.short_expiration)
        today = date.today()
        return max(0, (exp_date - today).days)
    
    @property
    def is_open(self) -> bool:
        """Check if this cycle is still open."""
        return self.close_date is None
    
    @property
    def is_profitable(self) -> bool:
        """Check if this cycle was profitable."""
        if self.realized_pnl is None:
            return False
        return self.realized_pnl > 0
    
    @property
    def premium_captured_percent(self) -> float:
        """Calculate what percentage of entry premium was captured."""
        if self.entry_premium == 0 or self.realized_pnl is None:
            return 0.0
        return (self.realized_pnl / self.entry_premium) * 100
    
    def calculate_pnl(self, close_price: float) -> float:
        """
        Calculate P&L for this cycle.
        
        For a short call:
        - We received premium at entry (positive)
        - We pay to close (negative)
        - P&L = entry_premium - close_price
        
        Example:
        - Sold call for $7.20
        - Bought back for $3.80
        - P&L = $7.20 - $3.80 = $3.40 profit (per share)
        """
        return self.entry_premium - close_price
