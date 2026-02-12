"""
IPMCC Commander - Input Validation Schemas
Strict Pydantic validation for trade entry logic and IPMCC structural rules
"""

from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, List, Literal
from datetime import date, datetime
from enum import Enum


class OptionType(str, Enum):
    CALL = "CALL"
    PUT = "PUT"


class OrderAction(str, Enum):
    BUY_TO_OPEN = "BUY_TO_OPEN"
    BUY_TO_CLOSE = "BUY_TO_CLOSE"
    SELL_TO_OPEN = "SELL_TO_OPEN"
    SELL_TO_CLOSE = "SELL_TO_CLOSE"


class StrategyType(str, Enum):
    IPMCC = "IPMCC"
    TRADE_112 = "112_TRADE"
    STRANGLE = "STRANGLE"
    CREDIT_SPREAD = "CREDIT_SPREAD"
    PMCC = "PMCC"  # Standard PMCC (OTM short)


class IPMCCSetupInput(BaseModel):
    """
    Strict validation for IPMCC trade setup.
    
    IPMCC Rules Enforced:
    1. Long strike MUST be < Short strike (bullish diagonal)
    2. Long DTE MUST be > Short DTE (calendar aspect)
    3. Long DTE >= 180 days (LEAP requirement)
    4. Short DTE between 3-21 days (weekly income)
    5. Quantity must be positive
    6. Strikes must be positive
    7. Both legs must be CALLS (not puts)
    """
    
    ticker: str = Field(..., min_length=1, max_length=10, description="Stock ticker symbol")
    
    # Long leg (LEAP)
    long_strike: float = Field(..., gt=0, description="LEAP call strike price")
    long_expiration: date = Field(..., description="LEAP expiration date")
    long_premium: Optional[float] = Field(None, ge=0, description="Premium paid for LEAP")
    long_delta: Optional[float] = Field(None, ge=0, le=1, description="LEAP delta (0-1)")
    
    # Short leg (Weekly)
    short_strike: float = Field(..., gt=0, description="Short call strike price")
    short_expiration: date = Field(..., description="Short call expiration date")
    short_premium: Optional[float] = Field(None, ge=0, description="Premium received for short")
    short_delta: Optional[float] = Field(None, ge=0, le=1, description="Short call delta (0-1)")
    
    # Trade details
    quantity: int = Field(1, ge=1, le=100, description="Number of contracts")
    current_stock_price: Optional[float] = Field(None, gt=0, description="Current underlying price")
    
    @field_validator('ticker')
    @classmethod
    def validate_ticker(cls, v: str) -> str:
        """Sanitize and validate ticker."""
        v = v.upper().strip()
        # Remove any non-alphanumeric characters except common suffixes
        allowed_chars = set('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-/')
        if not all(c in allowed_chars for c in v):
            raise ValueError(f"Invalid ticker format: {v}")
        return v
    
    @model_validator(mode='after')
    def validate_ipmcc_structure(self):
        """Validate IPMCC structural requirements."""
        errors = []
        
        # Rule 1: Long strike < Short strike (bullish diagonal)
        if self.long_strike >= self.short_strike:
            errors.append(
                f"IPMCC requires Long Strike ({self.long_strike}) < Short Strike ({self.short_strike}). "
                "This creates a bullish diagonal spread. "
                "If reversed, you have a bearish spread which will invert P&L calculations."
            )
        
        # Rule 2: Long DTE > Short DTE (calendar aspect)
        if self.long_expiration <= self.short_expiration:
            errors.append(
                f"IPMCC requires Long Expiration ({self.long_expiration}) > Short Expiration ({self.short_expiration}). "
                "The LEAP must expire after the short call."
            )
        
        # Rule 3: Long DTE >= 180 days (LEAP requirement)
        today = date.today()
        long_dte = (self.long_expiration - today).days
        if long_dte < 180:
            errors.append(
                f"IPMCC requires LEAP with >= 180 DTE. Current DTE: {long_dte}. "
                "LEAP options provide the leverage needed for this strategy."
            )
        
        # Rule 4: Short DTE between 3-21 days (weekly income)
        short_dte = (self.short_expiration - today).days
        if short_dte < 3:
            errors.append(
                f"Short DTE ({short_dte}) is too short. Minimum 3 days recommended. "
                "Very short DTE has high gamma risk."
            )
        if short_dte > 21:
            errors.append(
                f"Short DTE ({short_dte}) is longer than recommended (max 21 days). "
                "IPMCC targets weekly income with 7-14 DTE."
            )
        
        # Rule 5: Validate delta if provided
        if self.long_delta is not None:
            if self.long_delta < 0.60:
                errors.append(
                    f"LEAP delta ({self.long_delta:.2f}) is too low. "
                    "IPMCC requires 70-90 delta (0.70-0.90) for the LEAP."
                )
            elif self.long_delta > 0.95:
                errors.append(
                    f"LEAP delta ({self.long_delta:.2f}) is very high (deep ITM). "
                    "Consider 70-90 delta for better leverage."
                )
        
        # Validate price consistency if stock price provided
        if self.current_stock_price:
            # Long strike should be below current price for ITM LEAP
            if self.long_strike > self.current_stock_price * 1.1:
                errors.append(
                    f"LEAP strike ({self.long_strike}) is significantly above current price ({self.current_stock_price}). "
                    "IPMCC uses ITM LEAPs (typically 70-90 delta)."
                )
        
        if errors:
            raise ValueError(" | ".join(errors))
        
        return self
    
    def get_dte(self) -> dict:
        """Calculate DTE for both legs."""
        today = date.today()
        return {
            "long_dte": (self.long_expiration - today).days,
            "short_dte": (self.short_expiration - today).days
        }


class Trade112Input(BaseModel):
    """
    Validation for 112 Trade setup (1 Put Debit Spread + 2 Naked Puts).
    
    Rules:
    1. All strikes must be below current price (puts)
    2. Long put strike > Short put strikes
    3. All same expiration (typically 14-17 DTE)
    4. 1:1:2 ratio enforced
    """
    
    ticker: str = Field(..., min_length=1, max_length=10)
    
    # Long put (bought)
    long_put_strike: float = Field(..., gt=0, description="Long put strike (higher)")
    
    # Short puts (2x, same strike, sold)
    short_put_strike: float = Field(..., gt=0, description="Short put strike (lower)")
    
    expiration: date = Field(..., description="All legs same expiration")
    
    quantity: int = Field(1, ge=1, le=50, description="Number of 112 units")
    current_stock_price: Optional[float] = Field(None, gt=0)
    
    @field_validator('ticker')
    @classmethod
    def validate_ticker(cls, v: str) -> str:
        return v.upper().strip()
    
    @model_validator(mode='after')
    def validate_112_structure(self):
        """Validate 112 Trade structure."""
        errors = []
        
        # Long put must be higher strike than short puts
        if self.long_put_strike <= self.short_put_strike:
            errors.append(
                f"112 Trade requires Long Put Strike ({self.long_put_strike}) > Short Put Strike ({self.short_put_strike}). "
                "This creates a put debit spread plus naked puts below."
            )
        
        # DTE validation
        today = date.today()
        dte = (self.expiration - today).days
        if dte < 7:
            errors.append(f"DTE ({dte}) too short. 112 Trade typically uses 14-17 DTE.")
        if dte > 45:
            errors.append(f"DTE ({dte}) too long. 112 Trade typically uses 14-17 DTE.")
        
        # Strikes should be below current price for puts
        if self.current_stock_price:
            if self.long_put_strike > self.current_stock_price:
                errors.append(
                    f"Long put strike ({self.long_put_strike}) is ITM (above current price {self.current_stock_price}). "
                    "112 Trade typically uses OTM puts."
                )
        
        if errors:
            raise ValueError(" | ".join(errors))
        
        return self


class StrangleInput(BaseModel):
    """
    Validation for Short Strangle setup.
    
    Rules:
    1. Call strike > Current price > Put strike (both OTM)
    2. Same expiration for both legs
    3. Typically 30-45 DTE
    """
    
    ticker: str = Field(..., min_length=1, max_length=10)
    
    call_strike: float = Field(..., gt=0, description="Short call strike (above price)")
    put_strike: float = Field(..., gt=0, description="Short put strike (below price)")
    expiration: date = Field(..., description="Expiration for both legs")
    
    quantity: int = Field(1, ge=1, le=50)
    current_stock_price: Optional[float] = Field(None, gt=0)
    
    @field_validator('ticker')
    @classmethod
    def validate_ticker(cls, v: str) -> str:
        return v.upper().strip()
    
    @model_validator(mode='after')
    def validate_strangle_structure(self):
        """Validate strangle structure."""
        errors = []
        
        # Call must be higher than put
        if self.call_strike <= self.put_strike:
            errors.append(
                f"Strangle requires Call Strike ({self.call_strike}) > Put Strike ({self.put_strike})."
            )
        
        # Both should be OTM if price provided
        if self.current_stock_price:
            if self.call_strike < self.current_stock_price:
                errors.append(
                    f"Call strike ({self.call_strike}) should be above current price ({self.current_stock_price}) for short strangle."
                )
            if self.put_strike > self.current_stock_price:
                errors.append(
                    f"Put strike ({self.put_strike}) should be below current price ({self.current_stock_price}) for short strangle."
                )
        
        # DTE validation
        today = date.today()
        dte = (self.expiration - today).days
        if dte < 21:
            errors.append(f"DTE ({dte}) may be too short. Strangles typically use 30-45 DTE.")
        
        if errors:
            raise ValueError(" | ".join(errors))
        
        return self


class PositionInput(BaseModel):
    """Validation for general position creation."""
    
    ticker: str = Field(..., min_length=1, max_length=10)
    strategy: StrategyType = Field(...)
    
    # Position details
    long_strike: Optional[float] = Field(None, gt=0)
    long_expiration: Optional[date] = None
    long_premium: Optional[float] = Field(None, ge=0)
    long_quantity: Optional[int] = Field(None, ge=1)
    
    short_strike: Optional[float] = Field(None, gt=0)
    short_expiration: Optional[date] = None
    short_premium: Optional[float] = Field(None, ge=0)
    short_quantity: Optional[int] = Field(None, ge=1)
    
    notes: Optional[str] = Field(None, max_length=1000)
    
    @field_validator('ticker')
    @classmethod
    def validate_ticker(cls, v: str) -> str:
        v = v.upper().strip()
        allowed_chars = set('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-/')
        if not all(c in allowed_chars for c in v):
            raise ValueError(f"Invalid ticker format: {v}")
        return v
    
    @field_validator('notes')
    @classmethod
    def sanitize_notes(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        # Basic sanitization - remove potential script tags
        dangerous_patterns = ['<script', 'javascript:', 'onclick', 'onerror']
        v_lower = v.lower()
        for pattern in dangerous_patterns:
            if pattern in v_lower:
                raise ValueError("Invalid characters in notes")
        return v.strip()


class OrderInput(BaseModel):
    """Validation for order placement."""
    
    account_hash: str = Field(..., min_length=1)
    ticker: str = Field(..., min_length=1, max_length=10)
    action: OrderAction = Field(...)
    quantity: int = Field(..., ge=1, le=1000)
    
    # Option details (optional for stock orders)
    option_type: Optional[OptionType] = None
    strike: Optional[float] = Field(None, gt=0)
    expiration: Optional[date] = None
    
    # Order type
    order_type: Literal["MARKET", "LIMIT", "STOP", "STOP_LIMIT"] = "LIMIT"
    limit_price: Optional[float] = Field(None, ge=0)
    stop_price: Optional[float] = Field(None, ge=0)
    
    # Time in force
    time_in_force: Literal["DAY", "GTC", "GTD"] = "DAY"
    
    @field_validator('ticker')
    @classmethod
    def validate_ticker(cls, v: str) -> str:
        return v.upper().strip()
    
    @model_validator(mode='after')
    def validate_order(self):
        """Validate order consistency."""
        errors = []
        
        # Limit orders require limit price
        if self.order_type in ("LIMIT", "STOP_LIMIT") and self.limit_price is None:
            errors.append("Limit price required for LIMIT/STOP_LIMIT orders")
        
        # Stop orders require stop price
        if self.order_type in ("STOP", "STOP_LIMIT") and self.stop_price is None:
            errors.append("Stop price required for STOP/STOP_LIMIT orders")
        
        # Option orders require option details
        if self.option_type and (self.strike is None or self.expiration is None):
            errors.append("Option orders require strike and expiration")
        
        if errors:
            raise ValueError(" | ".join(errors))
        
        return self
