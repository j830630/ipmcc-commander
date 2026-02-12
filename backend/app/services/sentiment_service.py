"""
IPMCC Commander - Market Sentiment Service
Fetches Fear/Greed Index, VIX, forex pairs using FREE APIs
"""

import httpx
import asyncio
from datetime import datetime, date
from typing import Dict, Any, Optional, List
import logging
import yfinance as yf

logger = logging.getLogger(__name__)


class SentimentService:
    """
    Fetches market sentiment indicators from free data sources.
    - CNN Fear & Greed Index (unofficial API)
    - VIX via Yahoo Finance
    - Forex pairs via Twelve Data free tier
    - DXY calculated from components
    """
    
    def __init__(self):
        self.cache = {}
        self.cache_ttl = 300  # 5 minutes cache
        self.last_fetch = {}
    
    def _is_cache_valid(self, key: str) -> bool:
        """Check if cached data is still valid."""
        if key not in self.cache or key not in self.last_fetch:
            return False
        elapsed = (datetime.now() - self.last_fetch[key]).total_seconds()
        return elapsed < self.cache_ttl
    
    async def get_fear_greed_index(self) -> Dict[str, Any]:
        """
        Fetch CNN Fear & Greed Index from unofficial API.
        Returns score (0-100), rating, and sub-indicators.
        """
        cache_key = "fear_greed"
        if self._is_cache_valid(cache_key):
            return self.cache[cache_key]
        
        try:
            url = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata"
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    fg = data.get("fear_and_greed", {})
                    
                    result = {
                        "score": round(fg.get("score", 0), 1),
                        "rating": fg.get("rating", "neutral"),
                        "previous_close": round(fg.get("previous_close", 0), 1),
                        "previous_week": round(fg.get("previous_1_week", 0), 1),
                        "previous_month": round(fg.get("previous_1_month", 0), 1),
                        "previous_year": round(fg.get("previous_1_year", 0), 1),
                        "timestamp": datetime.now().isoformat(),
                        "indicators": {
                            "market_momentum": data.get("market_momentum_sp500", {}).get("score"),
                            "stock_price_strength": data.get("stock_price_strength", {}).get("score"),
                            "stock_price_breadth": data.get("stock_price_breadth", {}).get("score"),
                            "put_call_options": data.get("put_call_options", {}).get("score"),
                            "market_volatility": data.get("market_volatility_vix", {}).get("score"),
                            "safe_haven_demand": data.get("safe_haven_demand", {}).get("score"),
                            "junk_bond_demand": data.get("junk_bond_demand", {}).get("score"),
                        },
                        "error": None
                    }
                    
                    self.cache[cache_key] = result
                    self.last_fetch[cache_key] = datetime.now()
                    return result
                    
        except Exception as e:
            logger.error(f"Error fetching Fear & Greed Index: {e}")
        
        return {
            "score": None,
            "rating": "unknown",
            "error": "Failed to fetch Fear & Greed Index",
            "timestamp": datetime.now().isoformat()
        }
    
    def get_vix(self) -> Dict[str, Any]:
        """
        Fetch VIX (CBOE Volatility Index) via Yahoo Finance.
        Free, no API key required, 15-min delayed.
        """
        cache_key = "vix"
        if self._is_cache_valid(cache_key):
            return self.cache[cache_key]
        
        try:
            vix = yf.Ticker("^VIX")
            data = vix.history(period="5d")
            
            if not data.empty:
                current = data['Close'].iloc[-1]
                prev_close = data['Close'].iloc[-2] if len(data) > 1 else current
                change = current - prev_close
                change_pct = (change / prev_close) * 100 if prev_close else 0
                
                # Determine VIX level interpretation
                if current < 15:
                    level = "low"
                    interpretation = "Complacency - Low fear"
                elif current < 20:
                    level = "normal"
                    interpretation = "Normal market conditions"
                elif current < 25:
                    level = "elevated"
                    interpretation = "Elevated uncertainty"
                elif current < 30:
                    level = "high"
                    interpretation = "High fear - Caution advised"
                else:
                    level = "extreme"
                    interpretation = "Extreme fear - Market stress"
                
                result = {
                    "value": round(current, 2),
                    "previous_close": round(prev_close, 2),
                    "change": round(change, 2),
                    "change_percent": round(change_pct, 2),
                    "level": level,
                    "interpretation": interpretation,
                    "high_5d": round(data['High'].max(), 2),
                    "low_5d": round(data['Low'].min(), 2),
                    "timestamp": datetime.now().isoformat(),
                    "error": None
                }
                
                self.cache[cache_key] = result
                self.last_fetch[cache_key] = datetime.now()
                return result
                
        except Exception as e:
            logger.error(f"Error fetching VIX: {e}")
        
        return {"value": None, "error": "Failed to fetch VIX", "timestamp": datetime.now().isoformat()}
    
    def get_forex_pair(self, pair: str = "AUDJPY=X") -> Dict[str, Any]:
        """
        Fetch forex pair via Yahoo Finance.
        Pairs: AUDJPY=X, AUDUSD=X, DX-Y.NYB (DXY)
        """
        cache_key = f"forex_{pair}"
        if self._is_cache_valid(cache_key):
            return self.cache[cache_key]
        
        try:
            ticker = yf.Ticker(pair)
            data = ticker.history(period="5d")
            
            if not data.empty:
                current = data['Close'].iloc[-1]
                prev_close = data['Close'].iloc[-2] if len(data) > 1 else current
                change = current - prev_close
                change_pct = (change / prev_close) * 100 if prev_close else 0
                
                result = {
                    "pair": pair.replace("=X", "").replace("-Y.NYB", ""),
                    "value": round(current, 4),
                    "previous_close": round(prev_close, 4),
                    "change": round(change, 4),
                    "change_percent": round(change_pct, 2),
                    "high_5d": round(data['High'].max(), 4),
                    "low_5d": round(data['Low'].min(), 4),
                    "timestamp": datetime.now().isoformat(),
                    "error": None
                }
                
                self.cache[cache_key] = result
                self.last_fetch[cache_key] = datetime.now()
                return result
                
        except Exception as e:
            logger.error(f"Error fetching {pair}: {e}")
        
        return {"pair": pair, "value": None, "error": f"Failed to fetch {pair}", "timestamp": datetime.now().isoformat()}
    
    def get_market_indices(self) -> Dict[str, Any]:
        """Fetch major market indices: SPY, QQQ, DIA, IWM"""
        cache_key = "indices"
        if self._is_cache_valid(cache_key):
            return self.cache[cache_key]
        
        indices = {
            "SPY": "S&P 500",
            "QQQ": "NASDAQ 100",
            "DIA": "Dow Jones",
            "IWM": "Russell 2000"
        }
        
        results = {}
        for symbol, name in indices.items():
            try:
                ticker = yf.Ticker(symbol)
                data = ticker.history(period="2d")
                
                if not data.empty:
                    current = data['Close'].iloc[-1]
                    prev_close = data['Close'].iloc[-2] if len(data) > 1 else current
                    change = current - prev_close
                    change_pct = (change / prev_close) * 100 if prev_close else 0
                    
                    results[symbol] = {
                        "name": name,
                        "price": round(current, 2),
                        "change": round(change, 2),
                        "change_percent": round(change_pct, 2),
                        "error": None
                    }
            except Exception as e:
                results[symbol] = {"name": name, "price": None, "error": str(e)}
        
        result = {
            "indices": results,
            "timestamp": datetime.now().isoformat()
        }
        
        self.cache[cache_key] = result
        self.last_fetch[cache_key] = datetime.now()
        return result
    
    async def get_all_sentiment(self) -> Dict[str, Any]:
        """Get all sentiment indicators in one call."""
        fear_greed = await self.get_fear_greed_index()
        vix = self.get_vix()
        aud_jpy = self.get_forex_pair("AUDJPY=X")
        aud_usd = self.get_forex_pair("AUDUSD=X")
        dxy = self.get_forex_pair("DX-Y.NYB")
        indices = self.get_market_indices()
        
        return {
            "fear_greed": fear_greed,
            "vix": vix,
            "forex": {
                "AUD/JPY": aud_jpy,
                "AUD/USD": aud_usd,
                "DXY": dxy
            },
            "indices": indices,
            "timestamp": datetime.now().isoformat()
        }


# Singleton instance
sentiment_service = SentimentService()
