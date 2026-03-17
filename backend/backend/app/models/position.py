"""
IPMCC Commander - Position Model
Represents a LEAP (Long-term Equity Anticipation Security) position
"""

from sqlalchemy import Column, String, Float, Integer, Text, Enum
from sqlalchemy.orm import relationship
from app.database import Base
import uuid
from datetime import datetime
import enum


class PositionStatus(str, enum.Enum):
    """Position status enumeration."""
    ACTIVE = "active"
    CLOSED = "closed"
    EXPIRED = "expired"


class Position(Base):
    """
    Represents an IPMCC position (the long LEAP).
    
    Each position can have multiple short call cycles over its lifetime.
    This is the core entity that tracks the LEAP and aggregates cycle performance.
    """
    __tablename__ = "positions"
    
    # Primary key
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Underlying asset
    ticker = Column(String(10), nullable=False, index=True)
    
    # Long LEAP details
    long_strike = Column(Float, nullable=False)
    long_expiration = Column(String(10), nullable=False)  # ISO date: YYYY-MM-DD
    entry_date = Column(String(10), nullable=False)
    entry_price = Column(Float, nullable=False)  # Per-share price paid
    entry_delta = Column(Float)  # Delta at entry (70-90 typical)
    quantity = Column(Integer, default=1, nullable=False)  # Number of contracts
    
    # Current state (updated periodically)
    current_value = Column(Float)  # Current LEAP price per share
    current_delta = Column(Float)  # Current delta
    last_price_update = Column(String(25))  # ISO datetime
    
    # Status tracking
    status = Column(String(10), default=PositionStatus.ACTIVE.value, nullable=False, index=True)
    close_date = Column(String(10))
    close_price = Column(Float)
    close_reason = Column(String(50))
    
    # Metadata
    notes = Column(Text)
    tags = Column(String(255))  # Comma-separated tags
    created_at = Column(String(25), default=lambda: datetime.now().isoformat())
    updated_at = Column(String(25), default=lambda: datetime.now().isoformat(), onupdate=lambda: datetime.now().isoformat())
    
    # Relationships
    cycles = relationship(
        "ShortCallCycle",
        back_populates="position",
        cascade="all, delete-orphan",
        order_by="ShortCallCycle.cycle_number.desc()"
    )
    snapshots = relationship(
        "PriceSnapshot",
        back_populates="position",
        cascade="all, delete-orphan",
        order_by="PriceSnapshot.snapshot_date.desc()"
    )
    
    def __repr__(self):
        return f"<Position {self.ticker} ${self.long_strike}c {self.long_expiration}>"
    
    @property
    def dte_remaining(self) -> int:
        """Calculate days to expiration."""
        from datetime import date
        exp_date = date.fromisoformat(self.long_expiration)
        today = date.today()
        return (exp_date - today).days
    
    @property
    def capital_at_risk(self) -> float:
        """Calculate total capital deployed."""
        return self.entry_price * 100 * self.quantity
    
    @property
    def leap_pnl(self) -> float:
        """Calculate P&L on the LEAP itself."""
        if self.current_value is None:
            return 0.0
        return (self.current_value - self.entry_price) * 100 * self.quantity
    
    @property
    def leap_pnl_percent(self) -> float:
        """Calculate LEAP P&L as percentage."""
        if self.entry_price == 0:
            return 0.0
        if self.current_value is None:
            return 0.0
        return ((self.current_value - self.entry_price) / self.entry_price) * 100
