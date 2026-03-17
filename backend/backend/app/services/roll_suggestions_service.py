"""
IPMCC Commander - Roll Suggestions Service
Analyzes positions and generates intelligent roll recommendations
"""

import logging
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.models.position import Position
from app.models.cycle import ShortCallCycle
from app.models.history import RollSuggestion

logger = logging.getLogger(__name__)


class RollSuggestionsService:
    """
    Analyzes positions and generates roll suggestions based on:
    - DTE thresholds
    - Delta thresholds (assignment risk)
    - Profit targets reached
    - Time-based rules (weekly roll schedule)
    - Market conditions
    """
    
    # Thresholds for generating suggestions
    THRESHOLDS = {
        # DTE triggers
        "dte_critical": 1,      # Must roll today
        "dte_high": 2,          # Roll soon
        "dte_medium": 3,        # Consider rolling
        
        # Delta triggers (short call)
        "delta_critical": 0.85,  # Very high assignment risk
        "delta_high": 0.70,      # High assignment risk
        "delta_warning": 0.60,   # Elevated assignment risk
        
        # Profit triggers
        "profit_target_aggressive": 0.90,  # 90% of max profit
        "profit_target_standard": 0.80,    # 80% of max profit
        "profit_target_conservative": 0.50, # 50% of max profit
        
        # LEAP health
        "leap_dte_warning": 90,  # LEAP getting short
        "leap_dte_critical": 60, # LEAP needs attention
    }
    
    def __init__(self, db: Session):
        self.db = db
    
    def analyze_position(
        self, 
        position: Position, 
        current_price: float,
        short_call_price: Optional[float] = None,
        short_call_delta: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """
        Analyze a single position and generate any applicable suggestions.
        
        Returns list of suggestion dictionaries.
        """
        suggestions = []
        
        # Get active cycle if exists
        active_cycle = None
        for cycle in position.cycles:
            if cycle.status == "open":
                active_cycle = cycle
                break
        
        # Check LEAP health
        leap_suggestions = self._check_leap_health(position)
        suggestions.extend(leap_suggestions)
        
        # Check short call if active
        if active_cycle:
            short_suggestions = self._check_short_call(
                position, 
                active_cycle, 
                current_price,
                short_call_price,
                short_call_delta
            )
            suggestions.extend(short_suggestions)
        else:
            # No active short - suggest opening one
            suggestions.append({
                "suggestion_type": "open_short",
                "urgency": "low",
                "trigger_reason": "No active short call",
                "detailed_reasoning": "Position has no active short call. Consider selling a covered call to generate income.",
                "position_id": position.id,
            })
        
        return suggestions
    
    def _check_leap_health(self, position: Position) -> List[Dict[str, Any]]:
        """Check LEAP position health and generate suggestions."""
        suggestions = []
        dte = position.dte_remaining
        
        if dte <= self.THRESHOLDS["leap_dte_critical"]:
            suggestions.append({
                "suggestion_type": "roll_leap",
                "urgency": "critical",
                "trigger_reason": f"LEAP DTE critical ({dte} days)",
                "detailed_reasoning": f"Your LEAP expires in {dte} days. This is below the critical threshold of {self.THRESHOLDS['leap_dte_critical']} days. "
                    "Consider rolling to a later expiration to maintain time value and avoid rapid theta decay.",
                "position_id": position.id,
                "current_expiration": position.long_expiration,
                "current_dte": dte,
            })
        elif dte <= self.THRESHOLDS["leap_dte_warning"]:
            suggestions.append({
                "suggestion_type": "roll_leap",
                "urgency": "medium",
                "trigger_reason": f"LEAP DTE warning ({dte} days)",
                "detailed_reasoning": f"Your LEAP expires in {dte} days. Consider planning to roll to a later expiration "
                    "within the next few weeks to maintain optimal time value.",
                "position_id": position.id,
                "current_expiration": position.long_expiration,
                "current_dte": dte,
            })
        
        return suggestions
    
    def _check_short_call(
        self,
        position: Position,
        cycle: ShortCallCycle,
        current_price: float,
        short_call_price: Optional[float] = None,
        short_call_delta: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """Check short call and generate roll suggestions."""
        suggestions = []
        
        # Calculate DTE
        exp_date = date.fromisoformat(cycle.expiration)
        today = date.today()
        dte = (exp_date - today).days
        
        # Calculate profit captured if we have current price
        profit_captured = 0
        if short_call_price is not None and cycle.entry_price:
            profit_captured = (cycle.entry_price - short_call_price) / cycle.entry_price
        
        # Check DTE triggers
        if dte <= self.THRESHOLDS["dte_critical"]:
            suggestions.append({
                "suggestion_type": "roll_out",
                "urgency": "critical",
                "trigger_reason": f"Expiration imminent ({dte} DTE)",
                "detailed_reasoning": f"Short call expires {'today' if dte == 0 else 'tomorrow'}! "
                    "Roll immediately to avoid assignment or letting it expire ITM.",
                "position_id": position.id,
                "cycle_id": cycle.id,
                "current_strike": cycle.strike,
                "current_expiration": cycle.expiration,
                "current_dte": dte,
                "suggested_expiration": self._get_next_weekly_expiration(),
            })
        elif dte <= self.THRESHOLDS["dte_high"]:
            suggestions.append({
                "suggestion_type": "roll_out",
                "urgency": "high",
                "trigger_reason": f"Low DTE ({dte} days remaining)",
                "detailed_reasoning": f"Short call expires in {dte} days. Plan to roll to next week's expiration. "
                    f"Current profit captured: {profit_captured*100:.0f}%",
                "position_id": position.id,
                "cycle_id": cycle.id,
                "current_strike": cycle.strike,
                "current_expiration": cycle.expiration,
                "current_dte": dte,
                "suggested_expiration": self._get_next_weekly_expiration(),
            })
        
        # Check delta triggers (assignment risk)
        if short_call_delta is not None:
            if short_call_delta >= self.THRESHOLDS["delta_critical"]:
                suggestions.append({
                    "suggestion_type": "roll_up_out",
                    "urgency": "critical",
                    "trigger_reason": f"Very high delta ({short_call_delta:.0%})",
                    "detailed_reasoning": f"Short call delta is {short_call_delta:.0%}, indicating very high assignment risk. "
                        "Consider rolling up to a higher strike and/or out to a later expiration to reduce assignment probability.",
                    "position_id": position.id,
                    "cycle_id": cycle.id,
                    "current_strike": cycle.strike,
                    "current_delta": short_call_delta,
                    "suggested_strike": self._suggest_roll_up_strike(cycle.strike, current_price),
                })
            elif short_call_delta >= self.THRESHOLDS["delta_high"]:
                suggestions.append({
                    "suggestion_type": "roll_up",
                    "urgency": "high",
                    "trigger_reason": f"High delta ({short_call_delta:.0%})",
                    "detailed_reasoning": f"Short call delta is {short_call_delta:.0%}. The call is deep ITM. "
                        "Consider rolling up to a higher strike to reduce assignment risk while capturing some profit.",
                    "position_id": position.id,
                    "cycle_id": cycle.id,
                    "current_strike": cycle.strike,
                    "current_delta": short_call_delta,
                    "suggested_strike": self._suggest_roll_up_strike(cycle.strike, current_price),
                })
            elif short_call_delta >= self.THRESHOLDS["delta_warning"]:
                suggestions.append({
                    "suggestion_type": "monitor_closely",
                    "urgency": "medium",
                    "trigger_reason": f"Elevated delta ({short_call_delta:.0%})",
                    "detailed_reasoning": f"Short call delta is {short_call_delta:.0%}, which is elevated. "
                        "Monitor closely and be ready to roll if stock continues higher.",
                    "position_id": position.id,
                    "cycle_id": cycle.id,
                    "current_strike": cycle.strike,
                    "current_delta": short_call_delta,
                })
        
        # Check profit targets
        if profit_captured >= self.THRESHOLDS["profit_target_aggressive"]:
            suggestions.append({
                "suggestion_type": "take_profit",
                "urgency": "low",
                "trigger_reason": f"Profit target reached ({profit_captured*100:.0f}%)",
                "detailed_reasoning": f"Short call has captured {profit_captured*100:.0f}% of maximum profit. "
                    "Consider closing and rolling to next week to lock in gains and start a new cycle.",
                "position_id": position.id,
                "cycle_id": cycle.id,
                "current_price": short_call_price,
                "estimated_credit": cycle.entry_price - short_call_price if short_call_price else None,
            })
        elif profit_captured >= self.THRESHOLDS["profit_target_standard"]:
            # Only suggest if DTE is also getting low
            if dte <= 3:
                suggestions.append({
                    "suggestion_type": "take_profit",
                    "urgency": "low",
                    "trigger_reason": f"Good profit ({profit_captured*100:.0f}%) with low DTE",
                    "detailed_reasoning": f"Short call has captured {profit_captured*100:.0f}% profit with only {dte} DTE remaining. "
                        "Good time to close and roll to capture gains.",
                    "position_id": position.id,
                    "cycle_id": cycle.id,
                })
        
        return suggestions
    
    def _get_next_weekly_expiration(self) -> str:
        """Get the next Friday expiration date."""
        today = date.today()
        days_until_friday = (4 - today.weekday()) % 7
        if days_until_friday == 0:
            days_until_friday = 7  # If today is Friday, get next Friday
        next_friday = today + timedelta(days=days_until_friday)
        return next_friday.isoformat()
    
    def _suggest_roll_up_strike(self, current_strike: float, current_price: float) -> float:
        """Suggest a strike to roll up to (ATM or slightly OTM)."""
        # Round to nearest $5 for most stocks, $1 for cheaper ones
        increment = 5 if current_price > 100 else 1
        suggested = round(current_price / increment) * increment
        # Ensure it's at least $5 higher than current
        if suggested <= current_strike:
            suggested = current_strike + increment
        return suggested
    
    def analyze_all_positions(self, positions: List[Position]) -> List[Dict[str, Any]]:
        """Analyze all positions and return aggregated suggestions."""
        all_suggestions = []
        
        for position in positions:
            if position.status != "active":
                continue
            
            # In production, you'd fetch current prices here
            # For now, use stored values
            current_price = position.current_value or position.entry_price
            
            suggestions = self.analyze_position(position, current_price)
            all_suggestions.extend(suggestions)
        
        # Sort by urgency
        urgency_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        all_suggestions.sort(key=lambda x: urgency_order.get(x.get("urgency", "low"), 4))
        
        return all_suggestions
    
    def save_suggestion(self, suggestion_data: Dict[str, Any]) -> RollSuggestion:
        """Save a suggestion to the database."""
        suggestion = RollSuggestion(
            position_id=suggestion_data.get("position_id"),
            cycle_id=suggestion_data.get("cycle_id"),
            suggestion_type=suggestion_data.get("suggestion_type"),
            urgency=suggestion_data.get("urgency"),
            current_strike=suggestion_data.get("current_strike"),
            current_expiration=suggestion_data.get("current_expiration"),
            current_price=suggestion_data.get("current_price"),
            current_delta=suggestion_data.get("current_delta"),
            current_dte=suggestion_data.get("current_dte"),
            suggested_strike=suggestion_data.get("suggested_strike"),
            suggested_expiration=suggestion_data.get("suggested_expiration"),
            estimated_credit=suggestion_data.get("estimated_credit"),
            trigger_reason=suggestion_data.get("trigger_reason"),
            detailed_reasoning=suggestion_data.get("detailed_reasoning"),
            expires_at=(datetime.now() + timedelta(days=1)).isoformat(),
        )
        self.db.add(suggestion)
        self.db.commit()
        self.db.refresh(suggestion)
        return suggestion


# Singleton instance
roll_suggestions_service = None

def get_roll_suggestions_service(db: Session) -> RollSuggestionsService:
    """Get or create roll suggestions service instance."""
    return RollSuggestionsService(db)
