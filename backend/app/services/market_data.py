"""
IPMCC Commander - Market Data Service
Free market data via Yahoo Finance (yfinance)
"""

import yfinance as yf
from datetime import datetime, date
from typing import Optional, List, Dict, Any
import pandas as pd
from functools import lru_cache
import logging

logger = logging.getLogger(__name__)


class MarketDataService:
    """
    Free market data provider using Yahoo Finance.
    
    Note: Data is delayed 15-20 minutes. For real-time data,
    upgrade to Polygon.io or similar paid provider.
    """
    
    def __init__(self):
        self._quote_cache: Dict[str, tuple] = {}  # ticker -> (data, timestamp)
        self._cache_ttl = 60  # seconds
    
    def _is_cache_valid(self, ticker: str) -> bool:
        """Check if cached data is still valid."""
        if ticker not in self._quote_cache:
            return False
        _, timestamp = self._quote_cache[ticker]
        age = (datetime.now() - timestamp).total_seconds()
        return age < self._cache_ttl
    
    def get_quote(self, ticker: str) -> Dict[str, Any]:
        """
        Get current stock quote.
        
        Returns:
            Dict with price, change, volume, etc.
        """
        ticker = ticker.upper().strip()
        
        # Check cache first
        if self._is_cache_valid(ticker):
            data, _ = self._quote_cache[ticker]
            return data
        
        try:
            stock = yf.Ticker(ticker)
            info = stock.info
            
            # Handle potential missing fields
            price = (
                info.get("currentPrice") or 
                info.get("regularMarketPrice") or
                info.get("previousClose")
            )
            
            result = {
                "ticker": ticker,
                "price": round(price, 2) if price else None,
                "change": round(info.get("regularMarketChange", 0) or 0, 2),
                "change_percent": round(info.get("regularMarketChangePercent", 0) or 0, 2),
                "volume": info.get("volume"),
                "market_cap": info.get("marketCap"),
                "name": info.get("shortName", ticker),
                "bid": info.get("bid"),
                "ask": info.get("ask"),
                "day_high": info.get("dayHigh"),
                "day_low": info.get("dayLow"),
                "fifty_two_week_high": info.get("fiftyTwoWeekHigh"),
                "fifty_two_week_low": info.get("fiftyTwoWeekLow"),
                "timestamp": datetime.now().isoformat(),
                "error": None
            }
            
            # Cache the result
            self._quote_cache[ticker] = (result, datetime.now())
            
            return result
            
        except Exception as e:
            logger.error(f"Error fetching quote for {ticker}: {e}")
            return {
                "ticker": ticker,
                "price": None,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    def get_options_expirations(self, ticker: str) -> List[str]:
        """
        Get available options expiration dates.
        
        Returns:
            List of expiration dates as strings (YYYY-MM-DD)
        """
        ticker = ticker.upper().strip()
        
        try:
            stock = yf.Ticker(ticker)
            expirations = list(stock.options)
            return expirations
        except Exception as e:
            logger.error(f"Error fetching expirations for {ticker}: {e}")
            return []
    
    def get_options_chain(
        self, 
        ticker: str, 
        expiration: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get options chain for a ticker.
        
        Args:
            ticker: Stock symbol
            expiration: Specific expiration date (YYYY-MM-DD), or None for first available
            
        Returns:
            Dict with calls, puts, and metadata
        """
        ticker = ticker.upper().strip()
        
        try:
            stock = yf.Ticker(ticker)
            expirations = list(stock.options)
            
            if not expirations:
                return {
                    "ticker": ticker,
                    "error": "No options available for this ticker",
                    "timestamp": datetime.now().isoformat()
                }
            
            # Use provided expiration or first available
            exp = expiration if expiration and expiration in expirations else expirations[0]
            chain = stock.option_chain(exp)
            
            # Get underlying price
            quote = self.get_quote(ticker)
            underlying_price = quote.get("price")
            
            # Process calls
            calls = self._process_options_df(chain.calls, "call", underlying_price)
            puts = self._process_options_df(chain.puts, "put", underlying_price)
            
            return {
                "ticker": ticker,
                "expiration": exp,
                "expirations_available": expirations,
                "underlying_price": underlying_price,
                "calls": calls,
                "puts": puts,
                "timestamp": datetime.now().isoformat(),
                "error": None
            }
            
        except Exception as e:
            logger.error(f"Error fetching options chain for {ticker}: {e}")
            return {
                "ticker": ticker,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    def _process_options_df(
        self, 
        df: pd.DataFrame, 
        option_type: str,
        underlying_price: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """Process options DataFrame into list of dicts."""
        if df.empty:
            return []
        
        records = []
        for _, row in df.iterrows():
            strike = row.get("strike", 0)
            last_price = row.get("lastPrice")
            
            # Calculate intrinsic/extrinsic
            intrinsic = 0.0
            extrinsic = last_price or 0.0
            
            if underlying_price and last_price:
                if option_type == "call":
                    intrinsic = max(0, underlying_price - strike)
                else:
                    intrinsic = max(0, strike - underlying_price)
                extrinsic = max(0, last_price - intrinsic)
            
            records.append({
                "strike": strike,
                "last_price": last_price,
                "bid": row.get("bid"),
                "ask": row.get("ask"),
                "volume": int(row.get("volume", 0) or 0),
                "open_interest": int(row.get("openInterest", 0) or 0),
                "implied_volatility": round((row.get("impliedVolatility", 0) or 0) * 100, 2),
                "in_the_money": bool(row.get("inTheMoney", False)),
                "contract_symbol": row.get("contractSymbol"),
                "option_type": option_type,
                "intrinsic": round(intrinsic, 2),
                "extrinsic": round(extrinsic, 2)
            })
        
        return records
    
    def get_historical_data(
        self, 
        ticker: str, 
        period: str = "1y"
    ) -> List[Dict[str, Any]]:
        """
        Get historical price data for charts.
        
        Args:
            ticker: Stock symbol
            period: Time period (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)
            
        Returns:
            List of OHLCV data points
        """
        ticker = ticker.upper().strip()
        
        try:
            stock = yf.Ticker(ticker)
            hist = stock.history(period=period)
            
            if hist.empty:
                return []
            
            return [
                {
                    "date": idx.strftime("%Y-%m-%d"),
                    "open": round(row["Open"], 2),
                    "high": round(row["High"], 2),
                    "low": round(row["Low"], 2),
                    "close": round(row["Close"], 2),
                    "volume": int(row["Volume"])
                }
                for idx, row in hist.iterrows()
            ]
            
        except Exception as e:
            logger.error(f"Error fetching history for {ticker}: {e}")
            return []
    
    def get_technical_indicators(self, ticker: str) -> Dict[str, Any]:
        """
        Get basic technical indicators for IPMCC entry analysis.
        
        Calculates:
        - RSI (14-period)
        - Moving averages (21, 50, 200 EMA)
        - Bollinger Bands
        """
        ticker = ticker.upper().strip()
        
        try:
            stock = yf.Ticker(ticker)
            hist = stock.history(period="6mo")
            
            if hist.empty or len(hist) < 50:
                return {"error": "Insufficient data for technical analysis"}
            
            close = hist["Close"]
            
            # RSI calculation
            delta = close.diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
            rs = gain / loss
            rsi = 100 - (100 / (1 + rs))
            
            # EMAs
            ema_21 = close.ewm(span=21, adjust=False).mean()
            ema_50 = close.ewm(span=50, adjust=False).mean()
            ema_200 = close.ewm(span=200, adjust=False).mean() if len(close) >= 200 else None
            
            # Bollinger Bands (20-period, 2 std)
            sma_20 = close.rolling(window=20).mean()
            std_20 = close.rolling(window=20).std()
            bb_upper = sma_20 + (std_20 * 2)
            bb_lower = sma_20 - (std_20 * 2)
            
            current_price = close.iloc[-1]
            
            return {
                "ticker": ticker,
                "price": round(current_price, 2),
                "rsi_14": round(rsi.iloc[-1], 2),
                "ema_21": round(ema_21.iloc[-1], 2),
                "ema_50": round(ema_50.iloc[-1], 2),
                "ema_200": round(ema_200.iloc[-1], 2) if ema_200 is not None else None,
                "bb_upper": round(bb_upper.iloc[-1], 2),
                "bb_lower": round(bb_lower.iloc[-1], 2),
                "bb_middle": round(sma_20.iloc[-1], 2),
                "above_ema_21": current_price > ema_21.iloc[-1],
                "above_ema_50": current_price > ema_50.iloc[-1],
                "weekly_uptrend": ema_21.iloc[-1] > ema_50.iloc[-1],
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error calculating technicals for {ticker}: {e}")
            return {"error": str(e)}
    
    def clear_cache(self):
        """Clear the quote cache."""
        self._quote_cache.clear()


# Singleton instance
market_data = MarketDataService()
