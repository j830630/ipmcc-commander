"""
IPMCC Commander - User Settings Model
Stores user preferences and configuration
"""

from sqlalchemy import Column, Integer, Float, String
from app.database import Base
from datetime import datetime


class UserSettings(Base):
    """
    User settings and preferences.
    
    For single-user local deployment, this is a single-row table.
    Can be extended for multi-user with a user_id foreign key.
    """
    __tablename__ = "user_settings"
    
    # Single row enforcement
    id = Column(Integer, primary_key=True, default=1)
    
    # IPMCC Strategy Defaults
    default_long_delta = Column(Float, default=80.0)
    default_short_dte = Column(Integer, default=7)
    
    # Alert Thresholds
    roll_alert_threshold = Column(Float, default=0.20)  # 20% extrinsic remaining
    emergency_exit_threshold = Column(Float, default=0.30)  # 30% loss
    profit_target_threshold = Column(Float, default=0.50)  # 50% gain
    
    # Display Preferences
    theme = Column(String(10), default="dark")  # dark, light, system
    currency = Column(String(3), default="USD")
    date_format = Column(String(20), default="MMM DD, YYYY")
    
    # Metadata
    created_at = Column(String(25), default=lambda: datetime.now().isoformat())
    updated_at = Column(String(25), default=lambda: datetime.now().isoformat())
    
    def __repr__(self):
        return f"<UserSettings theme={self.theme}>"
