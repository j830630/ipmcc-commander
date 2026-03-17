"""
IPMCC Commander - Analysis Schemas
Pydantic models for Trade Lab validation and Greeks calculation
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import date


# ============================================================================
# VALIDATION SCHEMAS
# ============================================================================

class ValidationCheck(BaseModel):
    """Individual validation check result."""
    rule: str
    passed: bool
    value: Optional[float] = None
    target: Optional[str] = None
    message: str


class ValidationWarning(BaseModel):
    """Warning about suboptimal but acceptable parameters."""
    code: str
    message: str
    severity: str = "warning"  # warning, info


class ValidationMetrics(BaseModel):
    """Calculated metrics for a potential IPMCC trade."""
    capital_required: float = Field(..., description="Total capital needed (LEAP cost × 100 × quantity)")
    weekly_extrinsic: float = Field(..., description="Weekly extrinsic value capture")
    weeks_to_payback: float = Field(..., description="Weeks of premium to recoup LEAP cost")
    theoretical_annual_roi: float = Field(..., description="Projected annual ROI if extrinsic maintained")
    breakeven_price: float = Field(..., description="Stock price at which position breaks even")
    max_weekly_profit: float = Field(..., description="Maximum weekly profit (capped at extrinsic)")
    downside_vs_stock: float = Field(..., description="Capital reduction vs owning stock directly")
    net_theta_daily: float = Field(..., description="Net theta (positive = theta positive)")
    net_delta: float = Field(..., description="Net position delta")


class ValidationRequest(BaseModel):
    """Request to validate an IPMCC setup."""
    ticker: str = Field(..., min_length=1, max_length=10)
    long_strike: float = Field(..., gt=0)
    long_expiration: str = Field(..., description="YYYY-MM-DD")
    short_strike: float = Field(..., gt=0)
    short_expiration: str = Field(..., description="YYYY-MM-DD")
    quantity: int = Field(default=1, ge=1)
    
    @field_validator('ticker')
    @classmethod
    def uppercase_ticker(cls, v: str) -> str:
        return v.upper().strip()
    
    @field_validator('long_expiration', 'short_expiration')
    @classmethod
    def validate_date_format(cls, v: str) -> str:
        try:
            date.fromisoformat(v)
        except ValueError:
            raise ValueError(f"Invalid date format: {v}. Use YYYY-MM-DD.")
        return v


class ValidationResponse(BaseModel):
    """Response from validating an IPMCC setup."""
    valid: bool = Field(..., description="Whether the setup passes validation")
    score: int = Field(..., ge=0, le=100, description="Validation score out of 100")
    checks: List[ValidationCheck] = Field(..., description="Individual check results")
    warnings: List[ValidationWarning] = Field(default_factory=list)
    metrics: Optional[ValidationMetrics] = None
    error: Optional[str] = None


# ============================================================================
# GREEKS SCHEMAS
# ============================================================================

class OptionGreeks(BaseModel):
    """Greeks for a single option."""
    price: float
    delta: float = Field(..., description="Delta as percentage (0-100)")
    gamma: float
    theta: float = Field(..., description="Daily theta")
    vega: float
    intrinsic: float
    extrinsic: float
    dte: int
    iv: float = Field(..., description="Implied volatility as percentage")


class GreeksRequest(BaseModel):
    """Request to calculate Greeks for an option."""
    stock_price: float = Field(..., gt=0)
    strike: float = Field(..., gt=0)
    expiration: str = Field(..., description="YYYY-MM-DD")
    volatility: float = Field(..., gt=0, le=500, description="IV as percentage (e.g., 25 for 25%)")
    option_type: str = Field(default="call", description="call or put")
    
    @field_validator('expiration')
    @classmethod
    def validate_date_format(cls, v: str) -> str:
        try:
            date.fromisoformat(v)
        except ValueError:
            raise ValueError(f"Invalid date format: {v}. Use YYYY-MM-DD.")
        return v
    
    @field_validator('option_type')
    @classmethod
    def validate_option_type(cls, v: str) -> str:
        if v.lower() not in ['call', 'put']:
            raise ValueError("option_type must be 'call' or 'put'")
        return v.lower()


class GreeksResponse(BaseModel):
    """Response with calculated Greeks."""
    greeks: Optional[OptionGreeks] = None
    error: Optional[str] = None


class IPMCCGreeksRequest(BaseModel):
    """Request to calculate combined Greeks for an IPMCC position."""
    stock_price: float = Field(..., gt=0)
    long_strike: float = Field(..., gt=0)
    long_expiration: str
    long_iv: float = Field(..., gt=0, le=500)
    short_strike: float = Field(..., gt=0)
    short_expiration: str
    short_iv: float = Field(..., gt=0, le=500)
    quantity: int = Field(default=1, ge=1)


class IPMCCGreeksResponse(BaseModel):
    """Combined Greeks for an IPMCC position."""
    long: OptionGreeks
    short: OptionGreeks
    net: dict = Field(..., description="Net Greeks (long - short)")
    metrics: dict = Field(..., description="Position metrics")
    error: Optional[str] = None


# ============================================================================
# MARKET DATA SCHEMAS
# ============================================================================

class MarketQuote(BaseModel):
    """Stock quote data."""
    ticker: str
    price: Optional[float] = None
    change: Optional[float] = None
    change_percent: Optional[float] = None
    volume: Optional[int] = None
    market_cap: Optional[int] = None
    name: Optional[str] = None
    timestamp: str
    error: Optional[str] = None


class OptionContract(BaseModel):
    """Single option contract data."""
    strike: float
    last_price: Optional[float] = None
    bid: Optional[float] = None
    ask: Optional[float] = None
    volume: Optional[int] = None
    open_interest: Optional[int] = None
    implied_volatility: float = 0
    in_the_money: bool = False
    contract_symbol: Optional[str] = None
    option_type: str


class OptionsChain(BaseModel):
    """Options chain for a ticker."""
    ticker: str
    expiration: str
    expirations_available: List[str] = Field(default_factory=list)
    underlying_price: Optional[float] = None
    calls: List[OptionContract] = Field(default_factory=list)
    puts: List[OptionContract] = Field(default_factory=list)
    timestamp: str
    error: Optional[str] = None


# ============================================================================
# DASHBOARD SCHEMAS
# ============================================================================

class PortfolioGreeks(BaseModel):
    """Aggregate Greeks across all positions."""
    net_delta: float
    total_theta: float
    total_vega: float
    vega_theta_ratio: float
    position_count: int


class IncomeVelocity(BaseModel):
    """Income velocity metrics."""
    current_weekly: float = Field(..., description="Current week extrinsic / capital")
    rolling_4_week: float = Field(..., description="4-week rolling average")
    total_capital_deployed: float
    weekly_extrinsic_target: float


class ActionItem(BaseModel):
    """Dashboard action item."""
    priority: str = Field(..., description="critical, high, medium, low")
    type: str = Field(..., description="roll_due, assignment_risk, emergency_exit, profit_target, leap_expiring")
    position_id: str
    ticker: str
    message: str
    detail: Optional[str] = None


class DashboardSummary(BaseModel):
    """Complete dashboard summary."""
    greeks: PortfolioGreeks
    income_velocity: IncomeVelocity
    action_items: List[ActionItem]
    pnl_today: float
    pnl_week: float
    pnl_mtd: float
    pnl_ytd: float
    cumulative_extrinsic: float
    active_positions: int
    total_positions: int
