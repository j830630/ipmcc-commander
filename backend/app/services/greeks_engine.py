"""
IPMCC Commander - Greeks Engine
Black-Scholes option pricing and Greeks calculation using mibian
"""

import mibian
from datetime import date, datetime
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


class GreeksEngine:
    """
    Calculate option Greeks using Black-Scholes model.
    
    Uses the mibian library for calculations.
    All volatility inputs/outputs are in percentage form (e.g., 25 for 25%).
    Delta is returned as percentage (0-100) for easier interpretation.
    """
    
    def __init__(self, risk_free_rate: float = 5.0):
        """
        Initialize Greeks engine.
        
        Args:
            risk_free_rate: Risk-free rate as percentage (e.g., 5.0 for 5%)
        """
        self.risk_free_rate = risk_free_rate
    
    def calculate_days_to_expiry(self, expiration: str) -> int:
        """Calculate days from today to expiration date."""
        exp_date = date.fromisoformat(expiration)
        today = date.today()
        days = (exp_date - today).days
        return max(0, days)
    
    def calculate_call_greeks(
        self,
        stock_price: float,
        strike: float,
        days_to_expiry: int,
        volatility: float,  # As percentage, e.g., 25 for 25%
    ) -> Dict[str, Any]:
        """
        Calculate Greeks for a call option.
        
        Args:
            stock_price: Current stock price
            strike: Option strike price
            days_to_expiry: Days until expiration
            volatility: Implied volatility as percentage
            
        Returns:
            Dict with price, delta, gamma, theta, vega, intrinsic, extrinsic
        """
        
        # Handle expired options
        if days_to_expiry <= 0:
            intrinsic = max(0, stock_price - strike)
            return {
                "price": intrinsic,
                "delta": 100.0 if stock_price > strike else 0.0,
                "gamma": 0.0,
                "theta": 0.0,
                "vega": 0.0,
                "intrinsic": round(intrinsic, 2),
                "extrinsic": 0.0,
                "dte": 0,
                "iv": volatility,
                "error": "Option has expired" if days_to_expiry < 0 else None
            }
        
        try:
            # mibian BS: [underlyingPrice, strikePrice, interestRate, daysToExpiration]
            bs = mibian.BS(
                [stock_price, strike, self.risk_free_rate, days_to_expiry],
                volatility=volatility
            )
            
            # Calculate intrinsic and extrinsic
            intrinsic = max(0, stock_price - strike)
            extrinsic = max(0, bs.callPrice - intrinsic)
            
            return {
                "price": round(bs.callPrice, 2),
                "delta": round(bs.callDelta * 100, 1),  # Convert to percentage
                "gamma": round(bs.gamma, 4),
                "theta": round(bs.callTheta, 4),  # Daily theta decay
                "vega": round(bs.vega, 4),
                "intrinsic": round(intrinsic, 2),
                "extrinsic": round(extrinsic, 2),
                "dte": days_to_expiry,
                "iv": volatility,
                "error": None
            }
            
        except Exception as e:
            logger.error(f"Error calculating call Greeks: {e}")
            return {"error": str(e)}
    
    def calculate_put_greeks(
        self,
        stock_price: float,
        strike: float,
        days_to_expiry: int,
        volatility: float,
    ) -> Dict[str, Any]:
        """
        Calculate Greeks for a put option.
        
        Args:
            stock_price: Current stock price
            strike: Option strike price
            days_to_expiry: Days until expiration
            volatility: Implied volatility as percentage
            
        Returns:
            Dict with price, delta, gamma, theta, vega, intrinsic, extrinsic
        """
        
        # Handle expired options
        if days_to_expiry <= 0:
            intrinsic = max(0, strike - stock_price)
            return {
                "price": intrinsic,
                "delta": -100.0 if stock_price < strike else 0.0,
                "gamma": 0.0,
                "theta": 0.0,
                "vega": 0.0,
                "intrinsic": round(intrinsic, 2),
                "extrinsic": 0.0,
                "dte": 0,
                "iv": volatility,
                "error": "Option has expired" if days_to_expiry < 0 else None
            }
        
        try:
            bs = mibian.BS(
                [stock_price, strike, self.risk_free_rate, days_to_expiry],
                volatility=volatility
            )
            
            intrinsic = max(0, strike - stock_price)
            extrinsic = max(0, bs.putPrice - intrinsic)
            
            return {
                "price": round(bs.putPrice, 2),
                "delta": round(bs.putDelta * 100, 1),  # Negative for puts
                "gamma": round(bs.gamma, 4),
                "theta": round(bs.putTheta, 4),
                "vega": round(bs.vega, 4),
                "intrinsic": round(intrinsic, 2),
                "extrinsic": round(extrinsic, 2),
                "dte": days_to_expiry,
                "iv": volatility,
                "error": None
            }
            
        except Exception as e:
            logger.error(f"Error calculating put Greeks: {e}")
            return {"error": str(e)}
    
    def calculate_ipmcc_position(
        self,
        stock_price: float,
        long_strike: float,
        long_dte: int,
        long_iv: float,
        short_strike: float,
        short_dte: int,
        short_iv: float,
        quantity: int = 1
    ) -> Dict[str, Any]:
        """
        Calculate combined Greeks for an IPMCC position.
        
        An IPMCC position consists of:
        - Long LEAP call (70-90 delta, 180+ DTE)
        - Short call (ATM/ITM, 7-14 DTE)
        
        Args:
            stock_price: Current stock price
            long_strike: LEAP strike price
            long_dte: Days to LEAP expiration
            long_iv: LEAP implied volatility (%)
            short_strike: Short call strike price
            short_dte: Days to short call expiration
            short_iv: Short call implied volatility (%)
            quantity: Number of contracts
            
        Returns:
            Dict with long Greeks, short Greeks, net Greeks, and metrics
        """
        
        long_greeks = self.calculate_call_greeks(
            stock_price, long_strike, long_dte, long_iv
        )
        short_greeks = self.calculate_call_greeks(
            stock_price, short_strike, short_dte, short_iv
        )
        
        # Check for errors
        if "error" in long_greeks and long_greeks["error"]:
            return {"error": f"Long leg error: {long_greeks['error']}"}
        if "error" in short_greeks and short_greeks["error"]:
            return {"error": f"Short leg error: {short_greeks['error']}"}
        
        # Calculate net Greeks
        # For IPMCC: Long the LEAP, Short the call
        net_delta = (long_greeks["delta"] - short_greeks["delta"]) * quantity
        net_gamma = (long_greeks["gamma"] - short_greeks["gamma"]) * quantity
        # Theta is negative for long options, positive for short
        # Net theta = short theta (positive, we collect) - long theta (negative, we pay)
        net_theta = (-short_greeks["theta"] + long_greeks["theta"]) * quantity  # Positive = collecting theta
        net_vega = (long_greeks["vega"] - short_greeks["vega"]) * quantity
        
        # Calculate position metrics
        capital_required = long_greeks["price"] * 100 * quantity
        weekly_extrinsic = short_greeks["extrinsic"] * 100 * quantity
        
        # Theoretical metrics
        weeks_to_breakeven = capital_required / weekly_extrinsic if weekly_extrinsic > 0 else float('inf')
        annual_roi = (weekly_extrinsic * 52 / capital_required * 100) if capital_required > 0 else 0
        
        # Downside comparison vs stock
        stock_cost = stock_price * 100 * quantity
        capital_savings = (1 - capital_required / stock_cost) * 100 if stock_cost > 0 else 0
        
        return {
            "long": long_greeks,
            "short": short_greeks,
            "net": {
                "delta": round(net_delta, 1),
                "gamma": round(net_gamma, 4),
                "theta": round(net_theta, 2),  # Positive = theta positive position
                "vega": round(net_vega, 2),
            },
            "metrics": {
                "capital_required": round(capital_required, 2),
                "weekly_extrinsic": round(weekly_extrinsic, 2),
                "weeks_to_breakeven": round(weeks_to_breakeven, 1),
                "theoretical_annual_roi": round(annual_roi, 1),
                "downside_vs_stock_percent": round(capital_savings, 1),
                "extrinsic_yield_percent": round(
                    (short_greeks["extrinsic"] / long_greeks["price"]) * 100, 2
                ) if long_greeks["price"] > 0 else 0
            },
            "error": None
        }
    
    def implied_volatility_from_price(
        self,
        stock_price: float,
        strike: float,
        days_to_expiry: int,
        option_price: float,
        option_type: str = "call"
    ) -> Optional[float]:
        """
        Calculate implied volatility from option price.
        
        Args:
            stock_price: Current stock price
            strike: Option strike price
            days_to_expiry: Days until expiration
            option_price: Current option price
            option_type: "call" or "put"
            
        Returns:
            Implied volatility as percentage, or None if calculation fails
        """
        if days_to_expiry <= 0 or option_price <= 0:
            return None
        
        try:
            if option_type.lower() == "call":
                bs = mibian.BS(
                    [stock_price, strike, self.risk_free_rate, days_to_expiry],
                    callPrice=option_price
                )
                return round(bs.impliedVolatility, 2)
            else:
                bs = mibian.BS(
                    [stock_price, strike, self.risk_free_rate, days_to_expiry],
                    putPrice=option_price
                )
                return round(bs.impliedVolatility, 2)
                
        except Exception as e:
            logger.error(f"Error calculating IV: {e}")
            return None


# Singleton instance
greeks_engine = GreeksEngine()
