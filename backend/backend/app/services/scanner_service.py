"""
IPMCC Commander - Strategy Scanner Service
Scans for IPMCC, 112 Trade, Strangles, and Credit Spread setups using FREE data
"""

import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

logger = logging.getLogger(__name__)


class ScannerService:
    """
    Scans stocks for various options strategy setups.
    Uses Yahoo Finance (free, no API key required).
    """
    
    # Default watchlists
    LARGE_CAP = [
        "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK-B",
        "JPM", "V", "UNH", "HD", "PG", "MA", "DIS", "PYPL", "NFLX", "ADBE",
        "CRM", "INTC", "AMD", "QCOM", "TXN", "AVGO", "COST", "NKE", "MCD",
        "WMT", "KO", "PEP", "ABBV", "MRK", "PFE", "TMO", "ABT", "DHR",
        "LLY", "UPS", "BA", "CAT", "GE", "MMM", "HON", "RTX"
    ]
    
    HIGH_IV = [
        "TSLA", "NVDA", "AMD", "COIN", "MARA", "RIOT", "PLTR", "SOFI",
        "RIVN", "LCID", "NIO", "XPEV", "SNAP", "RBLX", "HOOD", "AFRM",
        "UPST", "SQ", "SHOP", "ROKU", "ZM", "DOCU", "PTON", "BYND"
    ]
    
    ETF_LIST = [
        "SPY", "QQQ", "IWM", "DIA", "XLF", "XLE", "XLK", "XLV", "XLI",
        "XLY", "XLP", "XLU", "XLRE", "XLB", "XLC", "GLD", "SLV", "TLT",
        "HYG", "EEM", "EFA", "VXX", "ARKK", "SOXL", "TQQQ"
    ]
    
    def __init__(self):
        self.cache = {}
        self.cache_ttl = 300  # 5 minutes
        self.last_fetch = {}
    
    def _calculate_rsi(self, prices: pd.Series, period: int = 14) -> float:
        """Calculate RSI indicator."""
        try:
            delta = prices.diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
            rs = gain / loss
            rsi = 100 - (100 / (1 + rs))
            return round(rsi.iloc[-1], 2) if not pd.isna(rsi.iloc[-1]) else 50
        except:
            return 50
    
    def _calculate_ema(self, prices: pd.Series, period: int) -> float:
        """Calculate EMA."""
        try:
            ema = prices.ewm(span=period, adjust=False).mean()
            return round(ema.iloc[-1], 2)
        except:
            return prices.iloc[-1] if len(prices) > 0 else 0
    
    def _get_trend(self, ticker_data: pd.DataFrame) -> Dict[str, Any]:
        """Determine price trend using EMAs."""
        try:
            close = ticker_data['Close']
            ema_21 = self._calculate_ema(close, 21)
            ema_50 = self._calculate_ema(close, 50)
            ema_200 = self._calculate_ema(close, 200) if len(close) >= 200 else ema_50
            current_price = close.iloc[-1]
            
            # Trend determination
            if current_price > ema_21 > ema_50:
                trend = "bullish"
            elif current_price < ema_21 < ema_50:
                trend = "bearish"
            else:
                trend = "neutral"
            
            # Weekly trend (simplified - above/below 21 EMA)
            weekly_trend = "bullish" if ema_21 > ema_50 else "bearish"
            
            return {
                "trend": trend,
                "weekly_trend": weekly_trend,
                "ema_21": ema_21,
                "ema_50": ema_50,
                "ema_200": ema_200,
                "price_vs_ema21": round((current_price / ema_21 - 1) * 100, 2),
                "ema21_vs_ema50": round((ema_21 / ema_50 - 1) * 100, 2)
            }
        except Exception as e:
            logger.warning(f"Error calculating trend: {e}")
            return {"trend": "unknown", "weekly_trend": "unknown"}
    
    def _get_support_resistance(self, ticker_data: pd.DataFrame) -> Dict[str, Any]:
        """Calculate basic support/resistance levels."""
        try:
            high = ticker_data['High']
            low = ticker_data['Low']
            close = ticker_data['Close']
            
            # Use recent highs/lows as S/R
            resistance = round(high.tail(20).max(), 2)
            support = round(low.tail(20).min(), 2)
            current = close.iloc[-1]
            
            # Distance to levels
            dist_to_resistance = round((resistance / current - 1) * 100, 2)
            dist_to_support = round((1 - support / current) * 100, 2)
            
            return {
                "resistance": resistance,
                "support": support,
                "dist_to_resistance_pct": dist_to_resistance,
                "dist_to_support_pct": dist_to_support,
                "near_support": dist_to_support < 3,  # Within 3%
                "near_resistance": dist_to_resistance < 3
            }
        except:
            return {"resistance": None, "support": None}
    
    def _get_options_data(self, ticker: yf.Ticker) -> Dict[str, Any]:
        """Get options chain data for analysis."""
        try:
            # Get expiration dates
            expirations = ticker.options
            if not expirations:
                return {"error": "No options available"}
            
            # Find LEAP expirations (>180 days)
            today = date.today()
            leap_exps = []
            weekly_exps = []
            
            for exp in expirations:
                exp_date = datetime.strptime(exp, "%Y-%m-%d").date()
                dte = (exp_date - today).days
                
                if dte >= 180:
                    leap_exps.append({"date": exp, "dte": dte})
                elif 5 <= dte <= 45:
                    weekly_exps.append({"date": exp, "dte": dte})
            
            # Get current price for IV calculation
            info = ticker.info
            current_price = info.get("currentPrice") or info.get("regularMarketPrice", 0)
            
            # Get IV from ATM options if available
            iv = None
            if weekly_exps:
                try:
                    chain = ticker.option_chain(weekly_exps[0]["date"])
                    calls = chain.calls
                    # Find ATM call
                    atm_idx = (calls['strike'] - current_price).abs().idxmin()
                    iv = calls.loc[atm_idx, 'impliedVolatility'] * 100
                    iv = round(iv, 1)
                except:
                    pass
            
            return {
                "has_options": True,
                "leap_expirations": leap_exps[:5],  # Top 5
                "weekly_expirations": weekly_exps[:5],
                "implied_volatility": iv,
                "current_price": round(current_price, 2) if current_price else None
            }
        except Exception as e:
            logger.warning(f"Error getting options data: {e}")
            return {"has_options": False, "error": str(e)}
    
    def scan_for_ipmcc(self, symbols: List[str] = None) -> Dict[str, Any]:
        """
        Scan for IPMCC (Income Poor Man's Covered Call) setups.
        
        Criteria:
        - Weekly uptrend (21 EMA > 50 EMA)
        - RSI between 30-70 (not overbought/oversold)
        - Has LEAP options available (>180 DTE)
        - Price near support preferred
        - IV not extremely low (<20% bad for premium)
        """
        if symbols is None:
            symbols = self.LARGE_CAP[:30]  # Limit for speed
        
        results = []
        
        def analyze_symbol(symbol: str) -> Optional[Dict]:
            try:
                ticker = yf.Ticker(symbol)
                hist = ticker.history(period="1y")
                
                if hist.empty or len(hist) < 50:
                    return None
                
                # Get current price
                current_price = hist['Close'].iloc[-1]
                
                # Calculate indicators
                rsi = self._calculate_rsi(hist['Close'])
                trend = self._get_trend(hist)
                sr = self._get_support_resistance(hist)
                options = self._get_options_data(ticker)
                
                # IPMCC scoring
                score = 0
                checks = []
                
                # Check 1: Weekly uptrend
                if trend.get("weekly_trend") == "bullish":
                    score += 25
                    checks.append({"name": "Weekly Uptrend", "passed": True})
                else:
                    checks.append({"name": "Weekly Uptrend", "passed": False})
                
                # Check 2: RSI in range
                if 30 <= rsi <= 70:
                    score += 20
                    checks.append({"name": "RSI 30-70", "passed": True, "value": rsi})
                else:
                    checks.append({"name": "RSI 30-70", "passed": False, "value": rsi})
                
                # Check 3: Has LEAPs
                if options.get("leap_expirations"):
                    score += 25
                    checks.append({"name": "LEAPs Available", "passed": True})
                else:
                    checks.append({"name": "LEAPs Available", "passed": False})
                    return None  # Can't do IPMCC without LEAPs
                
                # Check 4: Near support (bonus)
                if sr.get("near_support"):
                    score += 15
                    checks.append({"name": "Near Support", "passed": True})
                else:
                    checks.append({"name": "Near Support", "passed": False})
                
                # Check 5: IV reasonable
                iv = options.get("implied_volatility")
                if iv and iv >= 20:
                    score += 15
                    checks.append({"name": "IV >= 20%", "passed": True, "value": iv})
                elif iv:
                    checks.append({"name": "IV >= 20%", "passed": False, "value": iv})
                
                # Only return if passes minimum threshold
                if score >= 50:
                    return {
                        "symbol": symbol,
                        "price": round(current_price, 2),
                        "score": score,
                        "rsi": rsi,
                        "trend": trend.get("trend"),
                        "weekly_trend": trend.get("weekly_trend"),
                        "iv": iv,
                        "support": sr.get("support"),
                        "resistance": sr.get("resistance"),
                        "leap_expirations": options.get("leap_expirations", [])[:3],
                        "weekly_expirations": options.get("weekly_expirations", [])[:3],
                        "checks": checks
                    }
                return None
                
            except Exception as e:
                logger.warning(f"Error analyzing {symbol}: {e}")
                return None
        
        # Use thread pool for faster scanning
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = {executor.submit(analyze_symbol, s): s for s in symbols}
            for future in as_completed(futures):
                result = future.result()
                if result:
                    results.append(result)
        
        # Sort by score
        results.sort(key=lambda x: x["score"], reverse=True)
        
        return {
            "strategy": "IPMCC",
            "results": results,
            "total_scanned": len(symbols),
            "matches_found": len(results),
            "timestamp": datetime.now().isoformat()
        }
    
    def scan_for_112_trade(self, symbols: List[str] = None) -> Dict[str, Any]:
        """
        Scan for 112 Trade setups (1 Put Debit Spread + 2 Naked Puts).
        
        Criteria:
        - Neutral to slightly bearish bias acceptable
        - IV elevated (good for selling premium)
        - Strong support level identified
        - Weekly options available (14-17 DTE target)
        - Liquid options market
        """
        if symbols is None:
            symbols = self.HIGH_IV[:20]
        
        results = []
        
        def analyze_symbol(symbol: str) -> Optional[Dict]:
            try:
                ticker = yf.Ticker(symbol)
                hist = ticker.history(period="6mo")
                
                if hist.empty or len(hist) < 50:
                    return None
                
                current_price = hist['Close'].iloc[-1]
                rsi = self._calculate_rsi(hist['Close'])
                trend = self._get_trend(hist)
                sr = self._get_support_resistance(hist)
                options = self._get_options_data(ticker)
                
                # 112 Trade scoring
                score = 0
                checks = []
                
                # Check 1: IV elevated (good for premium selling)
                iv = options.get("implied_volatility")
                if iv and iv >= 35:
                    score += 30
                    checks.append({"name": "IV >= 35%", "passed": True, "value": iv})
                elif iv and iv >= 25:
                    score += 15
                    checks.append({"name": "IV >= 25%", "passed": True, "value": iv})
                else:
                    checks.append({"name": "High IV", "passed": False, "value": iv})
                
                # Check 2: Has 14-17 DTE options
                target_exp = None
                for exp in options.get("weekly_expirations", []):
                    if 14 <= exp["dte"] <= 21:
                        target_exp = exp
                        score += 25
                        checks.append({"name": "14-21 DTE Available", "passed": True, "value": exp["dte"]})
                        break
                
                if not target_exp:
                    checks.append({"name": "14-21 DTE Available", "passed": False})
                    return None
                
                # Check 3: Clear support level
                if sr.get("support") and sr.get("dist_to_support_pct", 100) > 5:
                    score += 20
                    checks.append({"name": "Support Identified", "passed": True, "value": sr["support"]})
                else:
                    checks.append({"name": "Support Identified", "passed": False})
                
                # Check 4: Not oversold (RSI > 30)
                if rsi > 30:
                    score += 15
                    checks.append({"name": "RSI > 30", "passed": True, "value": rsi})
                else:
                    checks.append({"name": "RSI > 30", "passed": False, "value": rsi})
                
                # Check 5: Price > $20 (for decent spread widths)
                if current_price >= 20:
                    score += 10
                    checks.append({"name": "Price >= $20", "passed": True})
                else:
                    checks.append({"name": "Price >= $20", "passed": False})
                
                if score >= 50:
                    return {
                        "symbol": symbol,
                        "price": round(current_price, 2),
                        "score": score,
                        "rsi": rsi,
                        "trend": trend.get("trend"),
                        "iv": iv,
                        "support": sr.get("support"),
                        "target_expiration": target_exp,
                        "checks": checks
                    }
                return None
                
            except Exception as e:
                logger.warning(f"Error analyzing {symbol} for 112: {e}")
                return None
        
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = {executor.submit(analyze_symbol, s): s for s in symbols}
            for future in as_completed(futures):
                result = future.result()
                if result:
                    results.append(result)
        
        results.sort(key=lambda x: x["score"], reverse=True)
        
        return {
            "strategy": "112 Trade",
            "results": results,
            "total_scanned": len(symbols),
            "matches_found": len(results),
            "timestamp": datetime.now().isoformat()
        }
    
    def scan_for_strangles(self, symbols: List[str] = None) -> Dict[str, Any]:
        """
        Scan for Short Strangle setups.
        
        Criteria:
        - IV Rank high (sell premium when IV is elevated)
        - Range-bound price action preferred
        - Liquid options
        - Price not near earnings
        """
        if symbols is None:
            symbols = self.ETF_LIST[:15]
        
        results = []
        
        def analyze_symbol(symbol: str) -> Optional[Dict]:
            try:
                ticker = yf.Ticker(symbol)
                hist = ticker.history(period="3mo")
                
                if hist.empty:
                    return None
                
                current_price = hist['Close'].iloc[-1]
                rsi = self._calculate_rsi(hist['Close'])
                trend = self._get_trend(hist)
                options = self._get_options_data(ticker)
                
                score = 0
                checks = []
                
                # Check 1: IV elevated
                iv = options.get("implied_volatility")
                if iv and iv >= 30:
                    score += 35
                    checks.append({"name": "IV >= 30%", "passed": True, "value": iv})
                elif iv:
                    checks.append({"name": "IV >= 30%", "passed": False, "value": iv})
                
                # Check 2: Not strongly trending (RSI 40-60 ideal)
                if 40 <= rsi <= 60:
                    score += 25
                    checks.append({"name": "RSI 40-60 (Neutral)", "passed": True, "value": rsi})
                else:
                    checks.append({"name": "RSI 40-60 (Neutral)", "passed": False, "value": rsi})
                
                # Check 3: 30-45 DTE available
                target_exp = None
                for exp in options.get("weekly_expirations", []):
                    if 30 <= exp["dte"] <= 45:
                        target_exp = exp
                        score += 25
                        checks.append({"name": "30-45 DTE", "passed": True, "value": exp["dte"]})
                        break
                
                if not target_exp:
                    checks.append({"name": "30-45 DTE", "passed": False})
                
                # Check 4: Neutral trend
                if trend.get("trend") == "neutral":
                    score += 15
                    checks.append({"name": "Neutral Trend", "passed": True})
                else:
                    checks.append({"name": "Neutral Trend", "passed": False})
                
                if score >= 50:
                    return {
                        "symbol": symbol,
                        "price": round(current_price, 2),
                        "score": score,
                        "rsi": rsi,
                        "trend": trend.get("trend"),
                        "iv": iv,
                        "target_expiration": target_exp,
                        "checks": checks
                    }
                return None
                
            except Exception as e:
                logger.warning(f"Error analyzing {symbol} for strangles: {e}")
                return None
        
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = {executor.submit(analyze_symbol, s): s for s in symbols}
            for future in as_completed(futures):
                result = future.result()
                if result:
                    results.append(result)
        
        results.sort(key=lambda x: x["score"], reverse=True)
        
        return {
            "strategy": "Strangles",
            "results": results,
            "total_scanned": len(symbols),
            "matches_found": len(results),
            "timestamp": datetime.now().isoformat()
        }
    
    def get_watchlists(self) -> Dict[str, List[str]]:
        """Return available watchlists."""
        return {
            "large_cap": self.LARGE_CAP,
            "high_iv": self.HIGH_IV,
            "etfs": self.ETF_LIST
        }


# Singleton instance
scanner_service = ScannerService()
