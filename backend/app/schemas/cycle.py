"""
IPMCC Commander - Cycle Schemas
Pydantic models for Short Call Cycle API endpoints
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import date


class CycleBase(BaseModel):
    """Base schema for cycle data."""
    short_strike: float = Field(..., gt=0, description="Short call strike price")
    short_expiration: str = Field(..., description="Short call expiration (YYYY-MM-DD)")
    entry_date: str = Field(..., description="Cycle entry date (YYYY-MM-DD)")
    entry_premium: float = Field(..., gt=0, description="Premium received per share")
    entry_extrinsic: float = Field(..., ge=0, description="Extrinsic value portion")
    stock_price_at_entry: Optional[float] = Field(None, gt=0, description="Stock price at entry")
    notes: Optional[str] = Field(None, description="Cycle notes")
    
    @field_validator('short_expiration', 'entry_date')
    @classmethod
    def validate_date_format(cls, v: str) -> str:
        try:
            date.fromisoformat(v)
        except ValueError:
            raise ValueError(f"Invalid date format: {v}. Use YYYY-MM-DD.")
        return v


class CycleCreate(CycleBase):
    """Schema for creating a new cycle."""
    position_id: str = Field(..., description="Parent position ID")


class CycleUpdate(BaseModel):
    """Schema for updating a cycle (all fields optional)."""
    short_strike: Optional[float] = Field(None, gt=0)
    short_expiration: Optional[str] = None
    entry_date: Optional[str] = None
    entry_premium: Optional[float] = Field(None, gt=0)
    entry_extrinsic: Optional[float] = Field(None, ge=0)
    stock_price_at_entry: Optional[float] = Field(None, gt=0)
    notes: Optional[str] = None


class CycleResponse(CycleBase):
    """Schema for cycle response with computed fields."""
    id: str
    position_id: str
    cycle_number: int
    close_date: Optional[str] = None
    close_price: Optional[float] = None
    realized_pnl: Optional[float] = None
    close_reason: Optional[str] = None
    stock_price_at_close: Optional[float] = None
    created_at: str
    updated_at: str
    
    # Computed fields
    dte_remaining: int = 0
    is_open: bool = True
    is_profitable: Optional[bool] = None
    premium_captured_percent: Optional[float] = None
    
    class Config:
        from_attributes = True


class CycleClose(BaseModel):
    """Schema for closing a cycle."""
    close_date: str = Field(..., description="Date cycle was closed (YYYY-MM-DD)")
    close_price: float = Field(..., ge=0, description="Price paid to close (0 if expired worthless)")
    close_reason: str = Field(..., description="Reason: expired_otm, expired_itm, rolled, early_close, assignment")
    stock_price_at_close: Optional[float] = Field(None, gt=0, description="Stock price at close")
    
    @field_validator('close_date')
    @classmethod
    def validate_date_format(cls, v: str) -> str:
        try:
            date.fromisoformat(v)
        except ValueError:
            raise ValueError(f"Invalid date format: {v}. Use YYYY-MM-DD.")
        return v
    
    @field_validator('close_reason')
    @classmethod
    def validate_close_reason(cls, v: str) -> str:
        valid_reasons = ['expired_otm', 'expired_itm', 'rolled', 'early_close', 'assignment']
        if v.lower() not in valid_reasons:
            raise ValueError(f"Invalid close reason: {v}. Must be one of: {valid_reasons}")
        return v.lower()


class RollCycleRequest(BaseModel):
    """Schema for rolling a cycle to a new one."""
    # Closing current cycle
    close_price: float = Field(..., ge=0, description="Price to close current cycle")
    close_date: str = Field(..., description="Close date (YYYY-MM-DD)")
    stock_price_at_close: Optional[float] = Field(None, gt=0)
    
    # Opening new cycle
    new_short_strike: float = Field(..., gt=0, description="New short call strike")
    new_short_expiration: str = Field(..., description="New short call expiration (YYYY-MM-DD)")
    new_entry_premium: float = Field(..., gt=0, description="Premium for new call")
    new_entry_extrinsic: float = Field(..., ge=0, description="Extrinsic for new call")
    stock_price_at_entry: Optional[float] = Field(None, gt=0)
    notes: Optional[str] = None
    
    @field_validator('close_date', 'new_short_expiration')
    @classmethod
    def validate_date_format(cls, v: str) -> str:
        try:
            date.fromisoformat(v)
        except ValueError:
            raise ValueError(f"Invalid date format: {v}. Use YYYY-MM-DD.")
        return v
