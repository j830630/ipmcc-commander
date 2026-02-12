"""
IPMCC Commander - Position Schemas
Pydantic models for Position API endpoints
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import date, datetime


class PositionBase(BaseModel):
    """Base schema for position data."""
    ticker: str = Field(..., min_length=1, max_length=10, description="Stock ticker symbol")
    long_strike: float = Field(..., gt=0, description="LEAP strike price")
    long_expiration: str = Field(..., description="LEAP expiration date (YYYY-MM-DD)")
    entry_date: str = Field(..., description="Position entry date (YYYY-MM-DD)")
    entry_price: float = Field(..., gt=0, description="LEAP price per share at entry")
    entry_delta: Optional[float] = Field(None, ge=0, le=100, description="Delta at entry (0-100)")
    quantity: int = Field(default=1, ge=1, description="Number of contracts")
    notes: Optional[str] = Field(None, description="Position notes")
    
    @field_validator('ticker')
    @classmethod
    def uppercase_ticker(cls, v: str) -> str:
        return v.upper().strip()
    
    @field_validator('long_expiration', 'entry_date')
    @classmethod
    def validate_date_format(cls, v: str) -> str:
        try:
            date.fromisoformat(v)
        except ValueError:
            raise ValueError(f"Invalid date format: {v}. Use YYYY-MM-DD.")
        return v


class PositionCreate(PositionBase):
    """Schema for creating a new position."""
    pass


class PositionUpdate(BaseModel):
    """Schema for updating a position (all fields optional)."""
    ticker: Optional[str] = Field(None, min_length=1, max_length=10)
    long_strike: Optional[float] = Field(None, gt=0)
    long_expiration: Optional[str] = None
    entry_date: Optional[str] = None
    entry_price: Optional[float] = Field(None, gt=0)
    entry_delta: Optional[float] = Field(None, ge=0, le=100)
    quantity: Optional[int] = Field(None, ge=1)
    current_value: Optional[float] = Field(None, ge=0)
    current_delta: Optional[float] = Field(None, ge=0, le=100)
    notes: Optional[str] = None
    status: Optional[str] = None


class CycleSummary(BaseModel):
    """Summary of a cycle for embedding in position response."""
    id: str
    cycle_number: int
    short_strike: float
    short_expiration: str
    entry_premium: float
    realized_pnl: Optional[float]
    is_open: bool
    
    class Config:
        from_attributes = True


class PositionResponse(PositionBase):
    """Schema for position response with computed fields."""
    id: str
    status: str
    current_value: Optional[float] = None
    current_delta: Optional[float] = None
    close_date: Optional[str] = None
    close_price: Optional[float] = None
    close_reason: Optional[str] = None
    created_at: str
    updated_at: str
    
    # Computed fields
    dte_remaining: int = 0
    capital_at_risk: float = 0.0
    leap_pnl: float = 0.0
    leap_pnl_percent: float = 0.0
    
    # Aggregate from cycles
    total_cycles: int = 0
    cumulative_premium: float = 0.0
    cumulative_short_pnl: float = 0.0
    net_pnl: float = 0.0
    net_pnl_percent: float = 0.0
    
    # Active cycle info
    active_cycle: Optional[CycleSummary] = None
    
    class Config:
        from_attributes = True


class PositionSummary(BaseModel):
    """Condensed position info for list views."""
    id: str
    ticker: str
    long_strike: float
    long_expiration: str
    status: str
    entry_price: float
    current_value: Optional[float]
    dte_remaining: int
    total_cycles: int
    cumulative_premium: float
    net_pnl: float
    net_pnl_percent: float
    
    # Active cycle quick info
    active_short_strike: Optional[float] = None
    active_short_expiration: Optional[str] = None
    
    class Config:
        from_attributes = True


class PositionClose(BaseModel):
    """Schema for closing a position."""
    close_date: str = Field(..., description="Date position was closed (YYYY-MM-DD)")
    close_price: float = Field(..., ge=0, description="LEAP price at close")
    close_reason: str = Field(..., description="Reason for closing")
    
    @field_validator('close_date')
    @classmethod
    def validate_date_format(cls, v: str) -> str:
        try:
            date.fromisoformat(v)
        except ValueError:
            raise ValueError(f"Invalid date format: {v}. Use YYYY-MM-DD.")
        return v
