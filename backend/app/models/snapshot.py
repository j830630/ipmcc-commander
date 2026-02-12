"""
IPMCC Commander - Price Snapshot Model
Stores daily snapshots of position values for charts and history
"""

from sqlalchemy import Column, String, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
import uuid
from datetime import datetime


class PriceSnapshot(Base):
    """
    Daily snapshot of position values.
    
    Used for:
    - P&L charts over time
    - Historical analysis
    - Performance reporting
    """
    __tablename__ = "price_snapshots"
    
    # Primary key
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Foreign key to position
    position_id = Column(String(36), ForeignKey("positions.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Snapshot date
    snapshot_date = Column(String(10), nullable=False, index=True)  # ISO date
    
    # Values at snapshot time
    stock_price = Column(Float)
    long_value = Column(Float)  # LEAP value
    long_delta = Column(Float)
    
    # Cumulative metrics at this point
    cumulative_premium = Column(Float)  # Total premium collected so far
    cumulative_short_pnl = Column(Float)  # Total short call P&L so far
    net_pnl = Column(Float)  # LEAP P&L + short call P&L
    
    # Metadata
    created_at = Column(String(25), default=lambda: datetime.now().isoformat())
    
    # Relationship
    position = relationship("Position", back_populates="snapshots")
    
    def __repr__(self):
        return f"<Snapshot {self.position_id[:8]} @ {self.snapshot_date}>"
