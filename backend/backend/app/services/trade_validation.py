"""
IPMCC Commander - Trade Validation Service
Strict input validation and IPMCC structural rules enforcement
"""

from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, List, Literal
from datetime import date, datetime
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class OptionType(str, Enum):
    CALL = "CALL"
    PUT = "PUT"


class PositionType(str, Enum):
    LONG = "LONG"
    SHORT = "SHORT"


class ValidationSeverity(str, Enum):
    ERROR = "error"      # Blocks trade - invalid structure
    WARNING = "warning"  # Caution - risky but valid
    INFO = "info"        # Informational note


class ValidationResult(BaseModel):
    """Single validation check result."""
    rule: str
    passed: bool
    severity: ValidationSeverity
    message: str
    value: Optional[str] = None
    expected: Optional[str] = None


class TradeValidationReport(BaseModel):
    """Complete validation report for a trade."""
    valid: bool
    score: int  # 0-100
    errors: List[ValidationResult]
    warnings: List[ValidationResult]
    info: List[ValidationResult]
    summary: str


# ==================== INPUT MODELS WITH VALIDATION ====================

class OptionLegInput(BaseModel):
    """Validated option leg input."""
    symbol: str = Field(..., min_length=1, max_length=21)
    option_type: OptionType
    position_type: PositionType
    strike: float = Field(..., gt=0, description="Strike price must be positive")
    expiration: date
    quantity: int = Field(..., ge=1, le=1000, description="Quantity 1-1000")
    premium: Optional[float] = Field(None, ge=0, description="Premium paid/received")
    
    @field_validator('strike')
    @classmethod
    def validate_strike(cls, v):
        """Strike must be reasonable (0.01 to 100000)."""
        if v < 0.01 or v > 100000:
            raise ValueError(f"Strike {v} is outside reasonable range (0.01-100000)")
        return round(v, 2)
    
    @field_validator('expiration')
    @classmethod
    def validate_expiration(cls, v):
        """Expiration must be in the future."""
        if v < date.today():
            raise ValueError(f"Expiration {v} is in the past")
        return v


class IPMCCTradeInput(BaseModel):
    """
    Validated IPMCC trade input.
    
    IPMCC Structure:
    - LONG CALL (LEAP): 70-90 delta, 180+ DTE
    - SHORT CALL: ATM/ITM, 5-14 DTE
    - Long Strike < Short Strike (diagonal spread)
    """
    ticker: str = Field(..., min_length=1, max_length=10, pattern=r'^[A-Z]{1,5}$')
    underlying_price: float = Field(..., gt=0)
    
    # Long LEAP
    long_strike: float = Field(..., gt=0)
    long_expiration: date
    long_premium: float = Field(..., ge=0)
    long_delta: Optional[float] = Field(None, ge=0, le=1)
    
    # Short Call
    short_strike: float = Field(..., gt=0)
    short_expiration: date
    short_premium: float = Field(..., ge=0)
    short_delta: Optional[float] = Field(None, ge=0, le=1)
    
    # Position sizing
    contracts: int = Field(1, ge=1, le=100)
    
    @model_validator(mode='after')
    def validate_ipmcc_structure(self):
        """Validate IPMCC structural requirements."""
        errors = []
        
        # Rule 1: Long Strike < Short Strike (for calls, this creates a diagonal)
        if self.long_strike >= self.short_strike:
            raise ValueError(
                f"IPMCC INVALID: Long strike ({self.long_strike}) must be < "
                f"Short strike ({self.short_strike}). "
                f"This would create a credit spread, not a diagonal."
            )
        
        # Rule 2: Long expiration > Short expiration
        if self.long_expiration <= self.short_expiration:
            raise ValueError(
                f"IPMCC INVALID: Long expiration ({self.long_expiration}) must be > "
                f"Short expiration ({self.short_expiration}). "
                f"The LEAP must have more time than the short call."
            )
        
        # Rule 3: Both must be in the future
        today = date.today()
        if self.long_expiration <= today:
            raise ValueError(f"Long expiration ({self.long_expiration}) must be in the future")
        if self.short_expiration <= today:
            raise ValueError(f"Short expiration ({self.short_expiration}) must be in the future")
        
        # Rule 4: Net debit (long premium > short premium for initial entry)
        # Note: This is typical but not strictly required for rolls
        
        return self
    
    @property
    def long_dte(self) -> int:
        """Days to expiration for long leg."""
        return (self.long_expiration - date.today()).days
    
    @property
    def short_dte(self) -> int:
        """Days to expiration for short leg."""
        return (self.short_expiration - date.today()).days
    
    @property
    def net_debit(self) -> float:
        """Net cost of the position."""
        return (self.long_premium - self.short_premium) * self.contracts * 100
    
    @property
    def max_profit(self) -> float:
        """Maximum profit potential."""
        spread_width = self.short_strike - self.long_strike
        return (spread_width - (self.long_premium - self.short_premium)) * self.contracts * 100
    
    @property
    def max_loss(self) -> float:
        """Maximum loss (debit paid)."""
        return self.net_debit


class Trade112Input(BaseModel):
    """
    Validated 112 Trade input.
    
    112 Structure:
    - 1 Put Debit Spread (Buy higher strike, Sell lower strike)
    - 2 Naked Puts at or below the lower strike
    """
    ticker: str = Field(..., min_length=1, max_length=10, pattern=r'^[A-Z]{1,5}$')
    underlying_price: float = Field(..., gt=0)
    
    # Put Debit Spread
    long_put_strike: float = Field(..., gt=0)
    short_put_strike: float = Field(..., gt=0)
    spread_expiration: date
    spread_debit: float = Field(..., ge=0)
    
    # Naked Puts (2x)
    naked_put_strike: float = Field(..., gt=0)
    naked_put_expiration: date
    naked_put_credit: float = Field(..., ge=0)  # Per contract
    
    @model_validator(mode='after')
    def validate_112_structure(self):
        """Validate 112 trade structural requirements."""
        
        # Rule 1: Long put strike > Short put strike (debit spread)
        if self.long_put_strike <= self.short_put_strike:
            raise ValueError(
                f"112 INVALID: Long put strike ({self.long_put_strike}) must be > "
                f"Short put strike ({self.short_put_strike}) for a debit spread."
            )
        
        # Rule 2: Naked put strike <= Short put strike
        if self.naked_put_strike > self.short_put_strike:
            raise ValueError(
                f"112 INVALID: Naked put strike ({self.naked_put_strike}) must be <= "
                f"Short put strike ({self.short_put_strike}) for downside protection."
            )
        
        # Rule 3: Same expiration for all legs
        if self.spread_expiration != self.naked_put_expiration:
            raise ValueError(
                f"112 INVALID: All legs must have same expiration. "
                f"Spread: {self.spread_expiration}, Naked: {self.naked_put_expiration}"
            )
        
        return self


class StrangleInput(BaseModel):
    """
    Validated Short Strangle input.
    
    Structure:
    - Short Put (below current price)
    - Short Call (above current price)
    """
    ticker: str = Field(..., min_length=1, max_length=10, pattern=r'^[A-Z]{1,5}$')
    underlying_price: float = Field(..., gt=0)
    
    put_strike: float = Field(..., gt=0)
    call_strike: float = Field(..., gt=0)
    expiration: date
    put_credit: float = Field(..., ge=0)
    call_credit: float = Field(..., ge=0)
    contracts: int = Field(1, ge=1, le=100)
    
    @model_validator(mode='after')
    def validate_strangle_structure(self):
        """Validate strangle structural requirements."""
        
        # Rule 1: Put strike < underlying price
        if self.put_strike >= self.underlying_price:
            raise ValueError(
                f"STRANGLE INVALID: Put strike ({self.put_strike}) must be < "
                f"underlying price ({self.underlying_price})."
            )
        
        # Rule 2: Call strike > underlying price
        if self.call_strike <= self.underlying_price:
            raise ValueError(
                f"STRANGLE INVALID: Call strike ({self.call_strike}) must be > "
                f"underlying price ({self.underlying_price})."
            )
        
        # Rule 3: Put strike < Call strike
        if self.put_strike >= self.call_strike:
            raise ValueError(
                f"STRANGLE INVALID: Put strike ({self.put_strike}) must be < "
                f"Call strike ({self.call_strike})."
            )
        
        return self


# ==================== VALIDATION ENGINE ====================

class TradeValidator:
    """
    Comprehensive trade validation engine.
    Enforces strategy rules and generates warnings/alerts.
    """
    
    # IPMCC Strategy Parameters
    IPMCC_MIN_LONG_DTE = 180
    IPMCC_MAX_LONG_DTE = 730  # 2 years
    IPMCC_MIN_SHORT_DTE = 5
    IPMCC_MAX_SHORT_DTE = 21
    IPMCC_TARGET_LONG_DELTA = (0.70, 0.90)
    IPMCC_TARGET_SHORT_DELTA = (0.30, 0.60)
    IPMCC_MIN_EXTRINSIC_PCT = 1.0  # Minimum 1% weekly return target
    
    def validate_ipmcc(self, trade: IPMCCTradeInput) -> TradeValidationReport:
        """
        Validate IPMCC trade against strategy rules.
        Returns detailed validation report.
        """
        errors = []
        warnings = []
        info = []
        score = 100
        
        # === STRUCTURAL CHECKS (Errors) ===
        
        # Check 1: Long DTE range
        if trade.long_dte < self.IPMCC_MIN_LONG_DTE:
            errors.append(ValidationResult(
                rule="Long DTE Minimum",
                passed=False,
                severity=ValidationSeverity.ERROR,
                message=f"Long DTE ({trade.long_dte}) is below minimum {self.IPMCC_MIN_LONG_DTE}",
                value=str(trade.long_dte),
                expected=f">= {self.IPMCC_MIN_LONG_DTE}"
            ))
            score -= 30
        elif trade.long_dte < 270:  # Warning if < 9 months
            warnings.append(ValidationResult(
                rule="Long DTE Warning",
                passed=True,
                severity=ValidationSeverity.WARNING,
                message=f"Long DTE ({trade.long_dte}) is getting short. Consider rolling.",
                value=str(trade.long_dte),
                expected=f">= 270 recommended"
            ))
            score -= 10
        else:
            info.append(ValidationResult(
                rule="Long DTE",
                passed=True,
                severity=ValidationSeverity.INFO,
                message=f"Long DTE ({trade.long_dte}) is acceptable",
                value=str(trade.long_dte)
            ))
        
        # Check 2: Short DTE range
        if trade.short_dte < self.IPMCC_MIN_SHORT_DTE:
            errors.append(ValidationResult(
                rule="Short DTE Minimum",
                passed=False,
                severity=ValidationSeverity.ERROR,
                message=f"Short DTE ({trade.short_dte}) is below minimum {self.IPMCC_MIN_SHORT_DTE}",
                value=str(trade.short_dte),
                expected=f">= {self.IPMCC_MIN_SHORT_DTE}"
            ))
            score -= 20
        elif trade.short_dte > self.IPMCC_MAX_SHORT_DTE:
            warnings.append(ValidationResult(
                rule="Short DTE Maximum",
                passed=True,
                severity=ValidationSeverity.WARNING,
                message=f"Short DTE ({trade.short_dte}) exceeds target {self.IPMCC_MAX_SHORT_DTE}",
                value=str(trade.short_dte),
                expected=f"<= {self.IPMCC_MAX_SHORT_DTE}"
            ))
            score -= 5
        else:
            info.append(ValidationResult(
                rule="Short DTE",
                passed=True,
                severity=ValidationSeverity.INFO,
                message=f"Short DTE ({trade.short_dte}) is in target range",
                value=str(trade.short_dte)
            ))
        
        # Check 3: Long Delta (if provided)
        if trade.long_delta is not None:
            min_d, max_d = self.IPMCC_TARGET_LONG_DELTA
            if trade.long_delta < min_d:
                warnings.append(ValidationResult(
                    rule="Long Delta Low",
                    passed=True,
                    severity=ValidationSeverity.WARNING,
                    message=f"Long delta ({trade.long_delta:.2f}) is below target range",
                    value=f"{trade.long_delta:.2f}",
                    expected=f"{min_d}-{max_d}"
                ))
                score -= 10
            elif trade.long_delta > max_d:
                info.append(ValidationResult(
                    rule="Long Delta High",
                    passed=True,
                    severity=ValidationSeverity.INFO,
                    message=f"Long delta ({trade.long_delta:.2f}) is above target (more ITM)",
                    value=f"{trade.long_delta:.2f}",
                    expected=f"{min_d}-{max_d}"
                ))
            else:
                info.append(ValidationResult(
                    rule="Long Delta",
                    passed=True,
                    severity=ValidationSeverity.INFO,
                    message=f"Long delta ({trade.long_delta:.2f}) is in target range",
                    value=f"{trade.long_delta:.2f}"
                ))
        
        # Check 4: Short Delta (if provided)
        if trade.short_delta is not None:
            min_d, max_d = self.IPMCC_TARGET_SHORT_DELTA
            if trade.short_delta > max_d:
                warnings.append(ValidationResult(
                    rule="Short Delta High - Assignment Risk",
                    passed=True,
                    severity=ValidationSeverity.WARNING,
                    message=f"Short delta ({trade.short_delta:.2f}) indicates high assignment risk",
                    value=f"{trade.short_delta:.2f}",
                    expected=f"{min_d}-{max_d}"
                ))
                score -= 15
            elif trade.short_delta < min_d:
                info.append(ValidationResult(
                    rule="Short Delta Low",
                    passed=True,
                    severity=ValidationSeverity.INFO,
                    message=f"Short delta ({trade.short_delta:.2f}) is conservative",
                    value=f"{trade.short_delta:.2f}"
                ))
        
        # Check 5: Spread width sanity
        spread_width = trade.short_strike - trade.long_strike
        if spread_width < 0:
            errors.append(ValidationResult(
                rule="Spread Width",
                passed=False,
                severity=ValidationSeverity.ERROR,
                message="Invalid spread: Short strike must be > Long strike",
                value=f"{spread_width}",
                expected="> 0"
            ))
            score -= 50
        elif spread_width / trade.underlying_price < 0.02:
            warnings.append(ValidationResult(
                rule="Spread Width Narrow",
                passed=True,
                severity=ValidationSeverity.WARNING,
                message=f"Spread width ({spread_width:.2f}) is very narrow",
                value=f"{spread_width:.2f}"
            ))
            score -= 5
        
        # Check 6: Position sizing relative to account
        # (Would need account data - placeholder)
        
        # Calculate final validity
        has_errors = len(errors) > 0
        
        return TradeValidationReport(
            valid=not has_errors,
            score=max(0, min(100, score)),
            errors=errors,
            warnings=warnings,
            info=info,
            summary=self._generate_summary(has_errors, score, len(warnings))
        )
    
    def _generate_summary(self, has_errors: bool, score: int, warning_count: int) -> str:
        """Generate human-readable summary."""
        if has_errors:
            return "❌ INVALID: Trade has structural errors that must be fixed"
        elif score >= 80:
            return f"✅ VALID: Trade structure is sound (Score: {score}/100)"
        elif score >= 60:
            return f"⚠️ CAUTION: Trade is valid but has {warning_count} warning(s) (Score: {score}/100)"
        else:
            return f"⚠️ RISKY: Trade is technically valid but consider the warnings (Score: {score}/100)"


# Singleton instance
trade_validator = TradeValidator()
