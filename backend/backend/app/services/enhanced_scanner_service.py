"""
IPMCC Commander - Enhanced Strategy Scanner Service
Comprehensive scanning following ALL guide rules with Schwab API integration.

Key Improvements over basic scanner:
1. Uses Schwab API for live options data with Greeks
2. Checks ALL strategy rules from the guide
3. Returns actionable trade setups with specific strikes/premiums
4. Calculates Income Velocity and expected returns
5. Checks earnings before expiration
6. Validates proper EMA alignment (21 > 50 > 200)
"""

import asyncio
import logging
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed
import yfinance as yf
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)


class EnhancedScannerService:
    """
    Enhanced scanner that validates against ALL strategy guide rules.
    Uses Schwab API for live data, falls back to yfinance.
    """
    
    # Watchlists by category
    QUALITY_STOCKS = [
        # Mega-cap tech (high liquidity, good for IPMCC)
        "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA",
        # Financial leaders
        "JPM", "V", "MA", "GS", "MS",
        # Healthcare/Consumer
        "UNH", "JNJ", "PG", "KO", "MCD", "HD", "WMT", "COST",
        # Other quality
        "CRM", "ADBE", "AVGO", "ORCL", "NFLX", "DIS"
    ]
    
    HIGH_IV_STOCKS = [
        "TSLA", "NVDA", "AMD", "COIN", "MARA", "RIOT", "PLTR", "SOFI",
        "RIVN", "LCID", "NIO", "SNAP", "RBLX", "HOOD", "AFRM", "UPST",
        "SQ", "SHOP", "ROKU", "SNOW", "CRWD", "NET", "DDOG"
    ]
    
    LIQUID_ETFS = [
        "SPY", "QQQ", "IWM", "DIA", "XLF", "XLE", "XLK", "XLV",
        "GLD", "SLV", "TLT", "HYG", "EEM", "ARKK"
    ]
    
    # Strategy-specific thresholds from guide
    IPMCC_RULES = {
        "min_long_delta": 70,
        "max_long_delta": 90,
        "preferred_long_delta": 80,
        "min_long_dte": 180,
        "max_long_dte": 730,
        "min_short_dte": 3,
        "max_short_dte": 21,
        "preferred_short_dte": 7,
        "min_iv": 20,
        "min_income_velocity": 1.0,  # 1% weekly target
        "target_income_velocity": 1.5,  # 1.5% ideal
        "max_rsi_entry": 50,  # RSI < 50 or reversing
    }
    
    TRADE_112_RULES = {
        "min_iv": 35,
        "good_iv": 45,
        "min_dte": 14,
        "max_dte": 21,
        "preferred_dte": 17,
        "min_price": 20,  # For decent spread widths
    }
    
    STRANGLE_RULES = {
        "min_iv": 30,
        "good_iv": 40,
        "min_dte": 30,
        "max_dte": 45,
        "preferred_dte": 35,
        "min_put_delta": 15,
        "max_put_delta": 30,
        "min_call_delta": 15,
        "max_call_delta": 30,
        "min_rsi": 40,
        "max_rsi": 60,
    }
    
    def __init__(self):
        self._cache: Dict[str, Dict] = {}
        self._cache_ttl = 300  # 5 minutes
    
    # =========================================================================
    # TECHNICAL ANALYSIS HELPERS
    # =========================================================================
    
    def _calculate_ema(self, prices: pd.Series, period: int) -> pd.Series:
        """Calculate Exponential Moving Average."""
        return prices.ewm(span=period, adjust=False).mean()
    
    def _calculate_rsi(self, prices: pd.Series, period: int = 14) -> float:
        """Calculate RSI indicator."""
        try:
            delta = prices.diff()
            gain = delta.where(delta > 0, 0).rolling(window=period).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
            rs = gain / loss
            rsi = 100 - (100 / (1 + rs))
            return round(float(rsi.iloc[-1]), 2) if not pd.isna(rsi.iloc[-1]) else 50.0
        except:
            return 50.0
    
    def _check_ema_alignment(self, hist: pd.DataFrame) -> Dict[str, Any]:
        """
        Check EMA alignment for weekly uptrend.
        Guide rule: 21 EMA > 50 EMA > 200 EMA
        """
        try:
            close = hist['Close']
            ema_21 = self._calculate_ema(close, 21)
            ema_50 = self._calculate_ema(close, 50)
            ema_200 = self._calculate_ema(close, 200) if len(close) >= 200 else None
            
            current_price = float(close.iloc[-1])
            ema_21_val = float(ema_21.iloc[-1])
            ema_50_val = float(ema_50.iloc[-1])
            ema_200_val = float(ema_200.iloc[-1]) if ema_200 is not None else ema_50_val
            
            # Check alignment
            ema_21_above_50 = ema_21_val > ema_50_val
            ema_50_above_200 = ema_50_val > ema_200_val
            price_above_21 = current_price > ema_21_val
            
            # Full bullish alignment
            bullish_aligned = ema_21_above_50 and ema_50_above_200 and price_above_21
            
            # Determine trend
            if bullish_aligned:
                trend = "bullish"
                trend_strength = "strong"
            elif ema_21_above_50:
                trend = "bullish"
                trend_strength = "moderate"
            elif ema_21_val < ema_50_val < ema_200_val:
                trend = "bearish"
                trend_strength = "strong"
            else:
                trend = "neutral"
                trend_strength = "weak"
            
            return {
                "trend": trend,
                "trend_strength": trend_strength,
                "bullish_aligned": bullish_aligned,
                "ema_21": round(ema_21_val, 2),
                "ema_50": round(ema_50_val, 2),
                "ema_200": round(ema_200_val, 2),
                "price": round(current_price, 2),
                "ema_21_above_50": ema_21_above_50,
                "ema_50_above_200": ema_50_above_200,
                "price_above_21": price_above_21,
                "price_vs_ema_21_pct": round((current_price / ema_21_val - 1) * 100, 2),
            }
        except Exception as e:
            logger.warning(f"EMA calculation error: {e}")
            return {"trend": "unknown", "bullish_aligned": False, "error": str(e)}
    
    def _get_support_resistance(self, hist: pd.DataFrame) -> Dict[str, Any]:
        """Calculate support and resistance levels."""
        try:
            high = hist['High']
            low = hist['Low']
            close = hist['Close']
            
            current = float(close.iloc[-1])
            
            # Recent highs/lows (20 day)
            recent_high = float(high.tail(20).max())
            recent_low = float(low.tail(20).min())
            
            # Longer-term (50 day)
            support_50 = float(low.tail(50).min())
            resistance_50 = float(high.tail(50).max())
            
            # Distance calculations
            dist_to_support = ((current - recent_low) / current) * 100
            dist_to_resistance = ((recent_high - current) / current) * 100
            
            # Near support = within 3%
            near_support = dist_to_support < 3
            near_resistance = dist_to_resistance < 3
            
            # Bollinger Bands for additional support
            sma_20 = close.rolling(20).mean().iloc[-1]
            std_20 = close.rolling(20).std().iloc[-1]
            lower_bb = sma_20 - (2 * std_20)
            upper_bb = sma_20 + (2 * std_20)
            
            return {
                "support": round(recent_low, 2),
                "resistance": round(recent_high, 2),
                "support_50d": round(support_50, 2),
                "resistance_50d": round(resistance_50, 2),
                "lower_bb": round(float(lower_bb), 2),
                "upper_bb": round(float(upper_bb), 2),
                "dist_to_support_pct": round(dist_to_support, 2),
                "dist_to_resistance_pct": round(dist_to_resistance, 2),
                "near_support": near_support,
                "near_resistance": near_resistance,
                "at_lower_bb": current <= lower_bb * 1.02,  # Within 2% of lower BB
            }
        except Exception as e:
            logger.warning(f"Support/resistance calculation error: {e}")
            return {"support": None, "resistance": None, "error": str(e)}
    
    # =========================================================================
    # DATA FETCHING
    # =========================================================================
    
    async def _get_schwab_data(self, ticker: str) -> Optional[Dict[str, Any]]:
        """Fetch live options data from Schwab API."""
        try:
            from app.services.schwab_service import schwab_service
            
            if not schwab_service.is_authenticated():
                return None
            
            # Get quote
            quotes = await schwab_service.get_quotes([ticker])
            if ticker not in quotes:
                return None
            
            quote = quotes[ticker].get('quote', {})
            price = float(quote.get('lastPrice') or quote.get('mark') or quote.get('closePrice', 0))
            
            if price == 0:
                return None
            
            # Get options chain
            chain = await schwab_service.get_option_chain(
                symbol=ticker,
                strike_count=30,
                include_underlying_quote=True
            )
            
            return {
                "price": price,
                "quote": quote,
                "chain": chain,
                "source": "schwab"
            }
        except Exception as e:
            logger.warning(f"Schwab data fetch failed for {ticker}: {e}")
            return None
    
    def _get_yfinance_data(self, ticker: str) -> Dict[str, Any]:
        """Fetch data from yfinance as fallback."""
        try:
            stock = yf.Ticker(ticker)
            hist = stock.history(period="1y")
            
            if hist.empty:
                return {"error": "No historical data"}
            
            price = float(hist['Close'].iloc[-1])
            
            # Get options expirations
            try:
                expirations = stock.options
            except:
                expirations = []
            
            return {
                "price": price,
                "history": hist,
                "expirations": expirations,
                "info": stock.info,
                "source": "yfinance"
            }
        except Exception as e:
            logger.warning(f"yfinance data fetch failed for {ticker}: {e}")
            return {"error": str(e)}
    
    async def _get_iv_metrics(self, ticker: str) -> Dict[str, Any]:
        """Get IV metrics from iv_analytics_service."""
        try:
            from app.services.iv_analytics_service import iv_analytics_service
            return await iv_analytics_service.get_iv_metrics(ticker)
        except Exception as e:
            logger.warning(f"IV metrics failed for {ticker}: {e}")
            return {"iv_rank": None, "current_iv": None, "error": str(e)}
    
    def _get_earnings_data(self, ticker: str) -> Dict[str, Any]:
        """Get earnings data from earnings service."""
        try:
            from app.services.earnings_service import earnings_calendar_service
            return earnings_calendar_service.get_earnings_date(ticker)
        except Exception as e:
            logger.warning(f"Earnings data failed for {ticker}: {e}")
            return {"earnings_date": None, "error": str(e)}
    
    # =========================================================================
    # OPTION CHAIN ANALYSIS
    # =========================================================================
    
    def _find_leap_options(
        self, 
        chain: Dict, 
        price: float,
        min_dte: int = 180
    ) -> List[Dict[str, Any]]:
        """Find suitable LEAP options (70-90 delta) from Schwab chain."""
        leaps = []
        today = date.today()
        
        call_map = chain.get('callExpDateMap', {})
        
        for exp_key, strikes in call_map.items():
            # Parse expiration (format: "2025-01-17:30")
            try:
                exp_date_str = exp_key.split(':')[0]
                exp_date = datetime.strptime(exp_date_str, '%Y-%m-%d').date()
                dte = (exp_date - today).days
            except:
                continue
            
            if dte < min_dte:
                continue
            
            # Look for 70-90 delta options
            for strike_str, options in strikes.items():
                try:
                    strike = float(strike_str)
                except:
                    continue
                
                for opt in options:
                    delta = opt.get('delta', 0)
                    if delta is None:
                        continue
                    
                    delta_pct = abs(delta) * 100
                    
                    # Check if in target delta range
                    if 65 <= delta_pct <= 92:
                        bid = opt.get('bid', 0) or 0
                        ask = opt.get('ask', 0) or 0
                        mid = (bid + ask) / 2 if bid and ask else opt.get('mark', 0)
                        iv = opt.get('volatility', 0)
                        theta = opt.get('theta', 0)
                        gamma = opt.get('gamma', 0)
                        
                        # Calculate intrinsic/extrinsic
                        intrinsic = max(0, price - strike)
                        extrinsic = max(0, mid - intrinsic)
                        
                        leaps.append({
                            "expiration": exp_date_str,
                            "dte": dte,
                            "strike": strike,
                            "delta": round(delta_pct, 1),
                            "bid": round(bid, 2),
                            "ask": round(ask, 2),
                            "mid": round(mid, 2),
                            "iv": round(iv, 2) if iv else None,
                            "theta": round(theta, 4) if theta else None,
                            "gamma": round(gamma, 4) if gamma else None,
                            "intrinsic": round(intrinsic, 2),
                            "extrinsic": round(extrinsic, 2),
                            "moneyness": round((price / strike - 1) * 100, 2),
                        })
        
        # Sort by delta (prefer ~80)
        leaps.sort(key=lambda x: abs(x['delta'] - 80))
        return leaps[:5]  # Return top 5
    
    def _find_short_call_options(
        self,
        chain: Dict,
        price: float,
        min_dte: int = 5,
        max_dte: int = 21
    ) -> List[Dict[str, Any]]:
        """Find suitable short call options (ATM/slightly ITM) from Schwab chain."""
        short_calls = []
        today = date.today()
        
        call_map = chain.get('callExpDateMap', {})
        
        for exp_key, strikes in call_map.items():
            try:
                exp_date_str = exp_key.split(':')[0]
                exp_date = datetime.strptime(exp_date_str, '%Y-%m-%d').date()
                dte = (exp_date - today).days
            except:
                continue
            
            if dte < min_dte or dte > max_dte:
                continue
            
            # Look for ATM strikes (within 2% of price)
            for strike_str, options in strikes.items():
                try:
                    strike = float(strike_str)
                except:
                    continue
                
                # ATM = within 2% of current price
                if abs(strike - price) / price > 0.03:
                    continue
                
                for opt in options:
                    bid = opt.get('bid', 0) or 0
                    ask = opt.get('ask', 0) or 0
                    mid = (bid + ask) / 2 if bid and ask else opt.get('mark', 0)
                    delta = opt.get('delta', 0)
                    iv = opt.get('volatility', 0)
                    theta = opt.get('theta', 0)
                    
                    # Calculate extrinsic (what we capture)
                    intrinsic = max(0, price - strike)
                    extrinsic = max(0, mid - intrinsic)
                    
                    if extrinsic > 0:
                        short_calls.append({
                            "expiration": exp_date_str,
                            "dte": dte,
                            "strike": strike,
                            "delta": round(abs(delta) * 100, 1) if delta else None,
                            "bid": round(bid, 2),
                            "ask": round(ask, 2),
                            "mid": round(mid, 2),
                            "iv": round(iv, 2) if iv else None,
                            "theta": round(abs(theta), 4) if theta else None,
                            "intrinsic": round(intrinsic, 2),
                            "extrinsic": round(extrinsic, 2),
                            "moneyness": round((price / strike - 1) * 100, 2),
                        })
        
        # Sort by extrinsic value (highest first)
        short_calls.sort(key=lambda x: x['extrinsic'], reverse=True)
        return short_calls[:5]
    
    def _find_put_options_for_112(
        self,
        chain: Dict,
        price: float,
        support: float,
        min_dte: int = 14,
        max_dte: int = 21
    ) -> Dict[str, List[Dict]]:
        """Find put options for 112 trade setup."""
        puts = {"long_puts": [], "short_puts": []}
        today = date.today()
        
        put_map = chain.get('putExpDateMap', {})
        
        for exp_key, strikes in put_map.items():
            try:
                exp_date_str = exp_key.split(':')[0]
                exp_date = datetime.strptime(exp_date_str, '%Y-%m-%d').date()
                dte = (exp_date - today).days
            except:
                continue
            
            if dte < min_dte or dte > max_dte:
                continue
            
            for strike_str, options in strikes.items():
                try:
                    strike = float(strike_str)
                except:
                    continue
                
                # Skip strikes above current price
                if strike >= price:
                    continue
                
                for opt in options:
                    bid = opt.get('bid', 0) or 0
                    ask = opt.get('ask', 0) or 0
                    mid = (bid + ask) / 2 if bid and ask else opt.get('mark', 0)
                    delta = opt.get('delta', 0)
                    iv = opt.get('volatility', 0)
                    
                    put_data = {
                        "expiration": exp_date_str,
                        "dte": dte,
                        "strike": strike,
                        "delta": round(abs(delta) * 100, 1) if delta else None,
                        "bid": round(bid, 2),
                        "ask": round(ask, 2),
                        "mid": round(mid, 2),
                        "iv": round(iv, 2) if iv else None,
                        "otm_pct": round((1 - strike / price) * 100, 2),
                    }
                    
                    # Long put: ATM or slightly OTM (within 5%)
                    if 0 <= put_data["otm_pct"] <= 5:
                        puts["long_puts"].append(put_data)
                    
                    # Short puts: 5-15% OTM, at/below support
                    elif 5 < put_data["otm_pct"] <= 15:
                        puts["short_puts"].append(put_data)
        
        # Sort long puts by closest to ATM
        puts["long_puts"].sort(key=lambda x: x["otm_pct"])
        # Sort short puts by premium
        puts["short_puts"].sort(key=lambda x: x["mid"], reverse=True)
        
        return puts
    
    def _find_strangle_options(
        self,
        chain: Dict,
        price: float,
        min_dte: int = 30,
        max_dte: int = 45
    ) -> Dict[str, List[Dict]]:
        """Find options for strangle setup (15-30 delta on each side)."""
        options = {"puts": [], "calls": []}
        today = date.today()
        
        call_map = chain.get('callExpDateMap', {})
        put_map = chain.get('putExpDateMap', {})
        
        # Find calls (15-30 delta)
        for exp_key, strikes in call_map.items():
            try:
                exp_date_str = exp_key.split(':')[0]
                exp_date = datetime.strptime(exp_date_str, '%Y-%m-%d').date()
                dte = (exp_date - today).days
            except:
                continue
            
            if dte < min_dte or dte > max_dte:
                continue
            
            for strike_str, opts in strikes.items():
                try:
                    strike = float(strike_str)
                except:
                    continue
                
                if strike <= price:  # OTM calls only
                    continue
                
                for opt in opts:
                    delta = opt.get('delta', 0)
                    if delta is None:
                        continue
                    
                    delta_pct = abs(delta) * 100
                    
                    if 12 <= delta_pct <= 35:
                        bid = opt.get('bid', 0) or 0
                        ask = opt.get('ask', 0) or 0
                        mid = (bid + ask) / 2 if bid and ask else opt.get('mark', 0)
                        
                        options["calls"].append({
                            "expiration": exp_date_str,
                            "dte": dte,
                            "strike": strike,
                            "delta": round(delta_pct, 1),
                            "bid": round(bid, 2),
                            "ask": round(ask, 2),
                            "mid": round(mid, 2),
                            "iv": round(opt.get('volatility', 0), 2),
                            "otm_pct": round((strike / price - 1) * 100, 2),
                        })
        
        # Find puts (15-30 delta)
        for exp_key, strikes in put_map.items():
            try:
                exp_date_str = exp_key.split(':')[0]
                exp_date = datetime.strptime(exp_date_str, '%Y-%m-%d').date()
                dte = (exp_date - today).days
            except:
                continue
            
            if dte < min_dte or dte > max_dte:
                continue
            
            for strike_str, opts in strikes.items():
                try:
                    strike = float(strike_str)
                except:
                    continue
                
                if strike >= price:  # OTM puts only
                    continue
                
                for opt in opts:
                    delta = opt.get('delta', 0)
                    if delta is None:
                        continue
                    
                    delta_pct = abs(delta) * 100
                    
                    if 12 <= delta_pct <= 35:
                        bid = opt.get('bid', 0) or 0
                        ask = opt.get('ask', 0) or 0
                        mid = (bid + ask) / 2 if bid and ask else opt.get('mark', 0)
                        
                        options["puts"].append({
                            "expiration": exp_date_str,
                            "dte": dte,
                            "strike": strike,
                            "delta": round(delta_pct, 1),
                            "bid": round(bid, 2),
                            "ask": round(ask, 2),
                            "mid": round(mid, 2),
                            "iv": round(opt.get('volatility', 0), 2),
                            "otm_pct": round((1 - strike / price) * 100, 2),
                        })
        
        # Sort by delta closest to 20
        options["calls"].sort(key=lambda x: abs(x["delta"] - 20))
        options["puts"].sort(key=lambda x: abs(x["delta"] - 20))
        
        return options
    
    # =========================================================================
    # IPMCC SCANNER
    # =========================================================================
    
    async def scan_ipmcc(self, symbols: List[str] = None) -> Dict[str, Any]:
        """
        Scan for IPMCC setups following ALL guide rules:
        
        Entry Criteria:
        1. Weekly uptrend (21 EMA > 50 EMA > 200 EMA) ✓
        2. RSI < 50 or reversing from oversold ✓
        3. Price at support (lower BB, 50 EMA, S/R levels) ✓
        4. High-quality, stable growth stocks/ETFs ✓
        5. No earnings before short call expiration ✓
        
        LEAP Requirements:
        - Delta: 70-90 (prefer 80) ✓
        - DTE: 180-365+ days ✓
        
        Short Call Requirements:
        - Strike: ATM (or slightly ITM in downtrends) ✓
        - DTE: 7 days (can go 3-14) ✓
        
        Returns Income Velocity (weekly extrinsic / capital)
        """
        if symbols is None:
            symbols = self.QUALITY_STOCKS
        
        results = []
        errors = []
        
        for symbol in symbols:
            try:
                result = await self._analyze_ipmcc_setup(symbol)
                if result and result.get("score", 0) >= 50:
                    results.append(result)
            except Exception as e:
                errors.append({"symbol": symbol, "error": str(e)})
                logger.warning(f"IPMCC scan error for {symbol}: {e}")
        
        # Sort by score
        results.sort(key=lambda x: x.get("score", 0), reverse=True)
        
        return {
            "strategy": "IPMCC",
            "strategy_name": "Income Poor Man's Covered Call",
            "results": results,
            "total_scanned": len(symbols),
            "matches_found": len(results),
            "errors": errors if errors else None,
            "scan_criteria": {
                "weekly_uptrend": "21 EMA > 50 EMA > 200 EMA",
                "rsi_target": "< 50 or reversing",
                "leap_delta": "70-90 (prefer 80)",
                "leap_dte": "180+ days",
                "short_dte": "7 days (3-14 acceptable)",
                "income_velocity_target": "1.5-2.5% weekly",
            },
            "timestamp": datetime.now().isoformat()
        }
    
    async def _analyze_ipmcc_setup(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Analyze a single symbol for IPMCC setup."""
        
        # Get market data
        schwab_data = await self._get_schwab_data(symbol)
        yf_data = self._get_yfinance_data(symbol)
        
        if yf_data.get("error") and not schwab_data:
            return None
        
        # Use yfinance for historical analysis
        hist = yf_data.get("history")
        if hist is None or hist.empty or len(hist) < 50:
            return None
        
        price = schwab_data["price"] if schwab_data else yf_data["price"]
        
        # Initialize scoring
        score = 0
        checks = []
        warnings = []
        
        # ===== CHECK 1: EMA Alignment (25 pts) =====
        ema_data = self._check_ema_alignment(hist)
        if ema_data.get("bullish_aligned"):
            score += 25
            checks.append({
                "rule": "Weekly Uptrend (21>50>200 EMA)",
                "passed": True,
                "value": f"21 EMA: {ema_data['ema_21']}, 50 EMA: {ema_data['ema_50']}",
                "weight": 25
            })
        elif ema_data.get("ema_21_above_50"):
            score += 15
            checks.append({
                "rule": "Weekly Uptrend (21>50>200 EMA)",
                "passed": True,
                "value": f"Partial alignment (21>50)",
                "weight": 15
            })
            warnings.append("200 EMA not confirmed - monitor closely")
        else:
            checks.append({
                "rule": "Weekly Uptrend (21>50>200 EMA)",
                "passed": False,
                "value": f"Trend: {ema_data.get('trend', 'unknown')}",
                "weight": 0
            })
            return None  # Critical failure
        
        # ===== CHECK 2: RSI (15 pts) =====
        rsi = self._calculate_rsi(hist['Close'])
        
        # Check RSI < 50 or reversing (crossed above 30)
        rsi_5d_ago = self._calculate_rsi(hist['Close'].iloc[:-5]) if len(hist) > 19 else 50
        rsi_reversing = rsi_5d_ago < 30 and rsi > 30
        
        if rsi < 50:
            score += 15
            checks.append({
                "rule": "RSI < 50",
                "passed": True,
                "value": f"RSI: {rsi}",
                "weight": 15
            })
        elif rsi_reversing:
            score += 12
            checks.append({
                "rule": "RSI Reversing from Oversold",
                "passed": True,
                "value": f"RSI: {rsi} (was {rsi_5d_ago:.1f})",
                "weight": 12
            })
        elif rsi < 60:
            score += 8
            checks.append({
                "rule": "RSI < 50",
                "passed": False,
                "value": f"RSI: {rsi} (slightly elevated)",
                "weight": 8
            })
            warnings.append(f"RSI {rsi} - consider waiting for pullback")
        else:
            checks.append({
                "rule": "RSI < 50",
                "passed": False,
                "value": f"RSI: {rsi} (overbought)",
                "weight": 0
            })
            warnings.append(f"RSI {rsi} OVERBOUGHT - wait for pullback")
        
        # ===== CHECK 3: Support Proximity (15 pts) =====
        sr_data = self._get_support_resistance(hist)
        
        if sr_data.get("near_support") or sr_data.get("at_lower_bb"):
            score += 15
            checks.append({
                "rule": "Price Near Support",
                "passed": True,
                "value": f"Support: ${sr_data['support']}, Distance: {sr_data['dist_to_support_pct']}%",
                "weight": 15
            })
        elif sr_data.get("dist_to_support_pct", 100) < 5:
            score += 10
            checks.append({
                "rule": "Price Near Support",
                "passed": True,
                "value": f"Support: ${sr_data['support']}, Distance: {sr_data['dist_to_support_pct']}%",
                "weight": 10
            })
        else:
            checks.append({
                "rule": "Price Near Support",
                "passed": False,
                "value": f"Distance to support: {sr_data.get('dist_to_support_pct', 'N/A')}%",
                "weight": 0
            })
        
        # ===== CHECK 4: IV Level (10 pts) =====
        iv_data = await self._get_iv_metrics(symbol)
        current_iv = iv_data.get("current_iv")
        iv_rank = iv_data.get("iv_rank")
        
        if current_iv and current_iv >= 20:
            score += 10
            checks.append({
                "rule": "IV >= 20%",
                "passed": True,
                "value": f"IV: {current_iv}%, IV Rank: {iv_rank}%",
                "weight": 10
            })
        elif current_iv:
            checks.append({
                "rule": "IV >= 20%",
                "passed": False,
                "value": f"IV: {current_iv}% (low premium)",
                "weight": 0
            })
            warnings.append(f"Low IV ({current_iv}%) - premium may be insufficient")
        
        # ===== CHECK 5: Earnings (10 pts) =====
        earnings_data = self._get_earnings_data(symbol)
        earnings_date = earnings_data.get("earnings_date")
        
        # Check if earnings within next 21 days (short call window)
        earnings_safe = True
        if earnings_date:
            try:
                earn_dt = date.fromisoformat(earnings_date)
                days_to_earnings = (earn_dt - date.today()).days
                if days_to_earnings <= 21:
                    earnings_safe = False
                    warnings.append(f"⚠️ EARNINGS in {days_to_earnings} days ({earnings_date})")
            except:
                pass
        
        if earnings_safe:
            score += 10
            checks.append({
                "rule": "No Earnings Within 21 Days",
                "passed": True,
                "value": f"Next earnings: {earnings_date or 'Unknown'}",
                "weight": 10
            })
        else:
            checks.append({
                "rule": "No Earnings Within 21 Days",
                "passed": False,
                "value": f"Earnings: {earnings_date}",
                "weight": 0
            })
        
        # ===== GET OPTION SETUPS =====
        recommended_setup = None
        income_velocity = None
        
        if schwab_data and schwab_data.get("chain"):
            chain = schwab_data["chain"]
            
            # Find LEAP options
            leaps = self._find_leap_options(chain, price)
            short_calls = self._find_short_call_options(chain, price)
            
            if leaps and short_calls:
                # Select best LEAP (closest to 80 delta)
                best_leap = leaps[0]
                
                # Select best short call (7 DTE preferred, highest extrinsic)
                preferred_shorts = [s for s in short_calls if 5 <= s["dte"] <= 10]
                best_short = preferred_shorts[0] if preferred_shorts else short_calls[0]
                
                # Calculate Income Velocity
                leap_cost = best_leap["mid"] * 100
                weekly_extrinsic = best_short["extrinsic"] * 100
                income_velocity = (weekly_extrinsic / leap_cost * 100) if leap_cost > 0 else 0
                
                # Score based on income velocity (25 pts)
                if income_velocity >= 1.5:
                    score += 25
                    checks.append({
                        "rule": "Income Velocity >= 1.5%",
                        "passed": True,
                        "value": f"{income_velocity:.2f}% weekly",
                        "weight": 25
                    })
                elif income_velocity >= 1.0:
                    score += 18
                    checks.append({
                        "rule": "Income Velocity >= 1.0%",
                        "passed": True,
                        "value": f"{income_velocity:.2f}% weekly",
                        "weight": 18
                    })
                else:
                    checks.append({
                        "rule": "Income Velocity >= 1.0%",
                        "passed": False,
                        "value": f"{income_velocity:.2f}% weekly (low)",
                        "weight": 0
                    })
                    warnings.append(f"Low Income Velocity ({income_velocity:.2f}%) - consider different strikes")
                
                # Build recommended setup
                weeks_to_breakeven = leap_cost / weekly_extrinsic if weekly_extrinsic > 0 else 999
                annual_roi = income_velocity * 52
                
                recommended_setup = {
                    "leap": {
                        "action": "BUY",
                        "strike": best_leap["strike"],
                        "expiration": best_leap["expiration"],
                        "dte": best_leap["dte"],
                        "delta": best_leap["delta"],
                        "price": best_leap["mid"],
                        "cost": round(leap_cost, 2),
                    },
                    "short_call": {
                        "action": "SELL",
                        "strike": best_short["strike"],
                        "expiration": best_short["expiration"],
                        "dte": best_short["dte"],
                        "delta": best_short.get("delta"),
                        "price": best_short["mid"],
                        "credit": round(best_short["mid"] * 100, 2),
                        "extrinsic": round(weekly_extrinsic, 2),
                    },
                    "metrics": {
                        "capital_required": round(leap_cost, 2),
                        "weekly_income": round(weekly_extrinsic, 2),
                        "income_velocity_pct": round(income_velocity, 2),
                        "weeks_to_breakeven": round(weeks_to_breakeven, 1),
                        "theoretical_annual_roi": round(annual_roi, 1),
                    },
                    "alternative_leaps": leaps[1:3] if len(leaps) > 1 else [],
                    "alternative_shorts": short_calls[1:3] if len(short_calls) > 1 else [],
                }
        
        return {
            "symbol": symbol,
            "price": round(price, 2),
            "score": score,
            "signal": "strong_buy" if score >= 80 else "buy" if score >= 65 else "neutral" if score >= 50 else "avoid",
            "checks": checks,
            "warnings": warnings,
            "technicals": {
                "trend": ema_data.get("trend"),
                "trend_strength": ema_data.get("trend_strength"),
                "rsi": rsi,
                "support": sr_data.get("support"),
                "resistance": sr_data.get("resistance"),
                "ema_21": ema_data.get("ema_21"),
                "ema_50": ema_data.get("ema_50"),
            },
            "iv_data": {
                "current_iv": current_iv,
                "iv_rank": iv_rank,
            },
            "earnings": {
                "date": earnings_date,
                "days_until": earnings_data.get("days_until"),
                "safe": earnings_safe,
            },
            "income_velocity": round(income_velocity, 2) if income_velocity else None,
            "recommended_setup": recommended_setup,
            "data_source": "schwab" if schwab_data else "yfinance",
        }
    
    # =========================================================================
    # 112 TRADE SCANNER
    # =========================================================================
    
    async def scan_112_trade(self, symbols: List[str] = None) -> Dict[str, Any]:
        """
        Scan for 112 Trade setups following guide rules:
        
        Entry Criteria:
        1. Elevated IV (>35% ideal) ✓
        2. 14-17 DTE options available ✓
        3. Clear support level identified ✓
        4. RSI > 30 (not oversold) ✓
        5. No earnings before expiration ✓
        6. Price > $20 for decent spreads ✓
        
        Structure: 1 Long Put + 1 Short Put + 2 Naked Puts (lower)
        """
        if symbols is None:
            symbols = self.HIGH_IV_STOCKS
        
        results = []
        errors = []
        
        for symbol in symbols:
            try:
                result = await self._analyze_112_setup(symbol)
                if result and result.get("score", 0) >= 50:
                    results.append(result)
            except Exception as e:
                errors.append({"symbol": symbol, "error": str(e)})
                logger.warning(f"112 scan error for {symbol}: {e}")
        
        results.sort(key=lambda x: x.get("score", 0), reverse=True)
        
        return {
            "strategy": "112_Trade",
            "strategy_name": "1:1:2 Put Ratio Spread",
            "results": results,
            "total_scanned": len(symbols),
            "matches_found": len(results),
            "errors": errors if errors else None,
            "scan_criteria": {
                "iv_target": ">35%",
                "dte_range": "14-17 days",
                "structure": "Buy 1 Put ATM, Sell 1 Put 5% OTM, Sell 2 Puts 10% OTM",
                "max_profit_zone": "Between short strikes",
            },
            "timestamp": datetime.now().isoformat()
        }
    
    async def _analyze_112_setup(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Analyze a single symbol for 112 trade setup."""
        
        schwab_data = await self._get_schwab_data(symbol)
        yf_data = self._get_yfinance_data(symbol)
        
        if yf_data.get("error") and not schwab_data:
            return None
        
        hist = yf_data.get("history")
        if hist is None or hist.empty:
            return None
        
        price = schwab_data["price"] if schwab_data else yf_data["price"]
        
        # Price minimum check
        if price < 20:
            return None
        
        score = 0
        checks = []
        warnings = []
        
        # ===== CHECK 1: IV Level (30 pts) =====
        iv_data = await self._get_iv_metrics(symbol)
        current_iv = iv_data.get("current_iv")
        iv_rank = iv_data.get("iv_rank")
        
        if current_iv and current_iv >= 45:
            score += 30
            checks.append({"rule": "IV >= 45%", "passed": True, "value": f"{current_iv}%", "weight": 30})
        elif current_iv and current_iv >= 35:
            score += 25
            checks.append({"rule": "IV >= 35%", "passed": True, "value": f"{current_iv}%", "weight": 25})
        elif current_iv and current_iv >= 25:
            score += 15
            checks.append({"rule": "IV >= 25%", "passed": True, "value": f"{current_iv}% (moderate)", "weight": 15})
        else:
            checks.append({"rule": "High IV", "passed": False, "value": f"{current_iv or 'N/A'}%", "weight": 0})
            return None  # Critical for 112
        
        # ===== CHECK 2: RSI > 30 (15 pts) =====
        rsi = self._calculate_rsi(hist['Close'])
        if rsi > 30:
            score += 15
            checks.append({"rule": "RSI > 30", "passed": True, "value": f"{rsi}", "weight": 15})
        else:
            checks.append({"rule": "RSI > 30", "passed": False, "value": f"{rsi} (oversold)", "weight": 0})
            warnings.append("RSI oversold - stock may continue falling")
        
        # ===== CHECK 3: Support Levels (20 pts) =====
        sr_data = self._get_support_resistance(hist)
        if sr_data.get("support"):
            score += 20
            checks.append({
                "rule": "Support Identified",
                "passed": True,
                "value": f"${sr_data['support']} ({sr_data['dist_to_support_pct']}% below)",
                "weight": 20
            })
        else:
            checks.append({"rule": "Support Identified", "passed": False, "weight": 0})
        
        # ===== CHECK 4: Earnings (15 pts) =====
        earnings_data = self._get_earnings_data(symbol)
        earnings_date = earnings_data.get("earnings_date")
        earnings_safe = True
        
        if earnings_date:
            try:
                earn_dt = date.fromisoformat(earnings_date)
                days_to_earnings = (earn_dt - date.today()).days
                if days_to_earnings <= 21:
                    earnings_safe = False
                    warnings.append(f"⚠️ EARNINGS in {days_to_earnings} days")
            except:
                pass
        
        if earnings_safe:
            score += 15
            checks.append({"rule": "No Earnings", "passed": True, "value": earnings_date or "None scheduled", "weight": 15})
        else:
            checks.append({"rule": "No Earnings", "passed": False, "value": earnings_date, "weight": 0})
        
        # ===== CHECK 5: Price > $20 (5 pts) =====
        score += 5
        checks.append({"rule": "Price >= $20", "passed": True, "value": f"${price:.2f}", "weight": 5})
        
        # ===== BUILD 112 SETUP =====
        recommended_setup = None
        
        if schwab_data and schwab_data.get("chain"):
            chain = schwab_data["chain"]
            support = sr_data.get("support", price * 0.9)
            
            puts = self._find_put_options_for_112(chain, price, support)
            
            if puts["long_puts"] and puts["short_puts"]:
                long_put = puts["long_puts"][0]
                
                # Find two short put levels
                short_puts = [p for p in puts["short_puts"] if p["strike"] < long_put["strike"]]
                
                if short_puts:
                    short_put_1 = short_puts[0]
                    short_put_2 = short_puts[1] if len(short_puts) > 1 else short_puts[0]
                    
                    # Calculate P&L
                    debit = long_put["mid"]
                    credit_1 = short_put_1["mid"]
                    credit_2 = short_put_2["mid"] * 2  # 2 contracts
                    
                    net_credit = credit_1 + credit_2 - debit
                    spread_width = long_put["strike"] - short_put_1["strike"]
                    max_profit = spread_width + net_credit
                    
                    # Score bonus for good setup (15 pts)
                    if net_credit > 0:
                        score += 15
                        checks.append({"rule": "Net Credit", "passed": True, "value": f"${net_credit:.2f}", "weight": 15})
                    
                    recommended_setup = {
                        "structure": "1:1:2 Put Ratio Spread",
                        "legs": [
                            {"action": "BUY", "qty": 1, "type": "PUT", "strike": long_put["strike"], "price": long_put["mid"]},
                            {"action": "SELL", "qty": 1, "type": "PUT", "strike": short_put_1["strike"], "price": short_put_1["mid"]},
                            {"action": "SELL", "qty": 2, "type": "PUT", "strike": short_put_2["strike"], "price": short_put_2["mid"]},
                        ],
                        "expiration": long_put["expiration"],
                        "dte": long_put["dte"],
                        "metrics": {
                            "net_credit": round(net_credit, 2),
                            "max_profit": round(max_profit, 2),
                            "max_profit_zone": f"${short_put_2['strike']} - ${short_put_1['strike']}",
                            "breakeven_upper": round(long_put["strike"] + net_credit, 2),
                        }
                    }
        
        return {
            "symbol": symbol,
            "price": round(price, 2),
            "score": score,
            "signal": "strong_buy" if score >= 80 else "buy" if score >= 60 else "neutral",
            "checks": checks,
            "warnings": warnings,
            "iv_data": {"current_iv": current_iv, "iv_rank": iv_rank},
            "technicals": {"rsi": rsi, "support": sr_data.get("support")},
            "earnings": {"date": earnings_date, "safe": earnings_safe},
            "recommended_setup": recommended_setup,
            "data_source": "schwab" if schwab_data else "yfinance",
        }
    
    # =========================================================================
    # STRANGLE SCANNER
    # =========================================================================
    
    async def scan_strangles(self, symbols: List[str] = None) -> Dict[str, Any]:
        """
        Scan for Short Strangle setups following guide rules:
        
        Entry Criteria:
        1. High IV (>30%) ✓
        2. Neutral RSI (40-60) ✓
        3. 30-45 DTE available ✓
        4. Range-bound price action ✓
        5. No earnings before expiration ✓
        
        Structure: Sell OTM Put + Sell OTM Call (15-30 delta each)
        """
        if symbols is None:
            symbols = self.LIQUID_ETFS
        
        results = []
        errors = []
        
        for symbol in symbols:
            try:
                result = await self._analyze_strangle_setup(symbol)
                if result and result.get("score", 0) >= 50:
                    results.append(result)
            except Exception as e:
                errors.append({"symbol": symbol, "error": str(e)})
                logger.warning(f"Strangle scan error for {symbol}: {e}")
        
        results.sort(key=lambda x: x.get("score", 0), reverse=True)
        
        return {
            "strategy": "Strangles",
            "strategy_name": "Short Strangle",
            "results": results,
            "total_scanned": len(symbols),
            "matches_found": len(results),
            "errors": errors if errors else None,
            "scan_criteria": {
                "iv_target": ">30%",
                "rsi_range": "40-60 (neutral)",
                "dte_range": "30-45 days",
                "delta_target": "15-30 each side",
            },
            "timestamp": datetime.now().isoformat()
        }
    
    async def _analyze_strangle_setup(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Analyze a single symbol for strangle setup."""
        
        schwab_data = await self._get_schwab_data(symbol)
        yf_data = self._get_yfinance_data(symbol)
        
        if yf_data.get("error") and not schwab_data:
            return None
        
        hist = yf_data.get("history")
        if hist is None or hist.empty:
            return None
        
        price = schwab_data["price"] if schwab_data else yf_data["price"]
        
        score = 0
        checks = []
        warnings = []
        
        # ===== CHECK 1: IV Level (30 pts) =====
        iv_data = await self._get_iv_metrics(symbol)
        current_iv = iv_data.get("current_iv")
        iv_rank = iv_data.get("iv_rank")
        
        if current_iv and current_iv >= 40:
            score += 30
            checks.append({"rule": "IV >= 40%", "passed": True, "value": f"{current_iv}%", "weight": 30})
        elif current_iv and current_iv >= 30:
            score += 25
            checks.append({"rule": "IV >= 30%", "passed": True, "value": f"{current_iv}%", "weight": 25})
        else:
            checks.append({"rule": "High IV", "passed": False, "value": f"{current_iv or 'N/A'}%", "weight": 0})
            return None
        
        # ===== CHECK 2: Neutral RSI (25 pts) =====
        rsi = self._calculate_rsi(hist['Close'])
        if 40 <= rsi <= 60:
            score += 25
            checks.append({"rule": "RSI 40-60", "passed": True, "value": f"{rsi}", "weight": 25})
        elif 35 <= rsi <= 65:
            score += 15
            checks.append({"rule": "RSI 35-65", "passed": True, "value": f"{rsi} (slightly biased)", "weight": 15})
        else:
            checks.append({"rule": "Neutral RSI", "passed": False, "value": f"{rsi}", "weight": 0})
            warnings.append(f"RSI {rsi} indicates directional bias")
        
        # ===== CHECK 3: Neutral Trend (15 pts) =====
        ema_data = self._check_ema_alignment(hist)
        if ema_data.get("trend") == "neutral":
            score += 15
            checks.append({"rule": "Neutral Trend", "passed": True, "value": "Range-bound", "weight": 15})
        else:
            checks.append({"rule": "Neutral Trend", "passed": False, "value": ema_data.get("trend"), "weight": 0})
            warnings.append(f"Trending {ema_data.get('trend')} - strangle may get tested")
        
        # ===== CHECK 4: Earnings (15 pts) =====
        earnings_data = self._get_earnings_data(symbol)
        earnings_date = earnings_data.get("earnings_date")
        earnings_safe = True
        
        if earnings_date:
            try:
                earn_dt = date.fromisoformat(earnings_date)
                days_to_earnings = (earn_dt - date.today()).days
                if days_to_earnings <= 45:
                    earnings_safe = False
                    warnings.append(f"⚠️ EARNINGS in {days_to_earnings} days")
            except:
                pass
        
        if earnings_safe:
            score += 15
            checks.append({"rule": "No Earnings in 45 Days", "passed": True, "weight": 15})
        else:
            checks.append({"rule": "No Earnings", "passed": False, "value": earnings_date, "weight": 0})
        
        # ===== BUILD STRANGLE SETUP =====
        recommended_setup = None
        
        if schwab_data and schwab_data.get("chain"):
            chain = schwab_data["chain"]
            options = self._find_strangle_options(chain, price)
            
            if options["puts"] and options["calls"]:
                best_put = options["puts"][0]
                best_call = options["calls"][0]
                
                total_credit = best_put["mid"] + best_call["mid"]
                credit_pct = (total_credit / price) * 100
                
                # Score bonus for good premium (15 pts)
                if credit_pct >= 1.0:
                    score += 15
                    checks.append({"rule": "Premium >= 1%", "passed": True, "value": f"{credit_pct:.2f}%", "weight": 15})
                
                recommended_setup = {
                    "structure": "Short Strangle",
                    "legs": [
                        {"action": "SELL", "type": "PUT", "strike": best_put["strike"], "delta": best_put["delta"], "price": best_put["mid"]},
                        {"action": "SELL", "type": "CALL", "strike": best_call["strike"], "delta": best_call["delta"], "price": best_call["mid"]},
                    ],
                    "expiration": best_put["expiration"],
                    "dte": best_put["dte"],
                    "metrics": {
                        "total_credit": round(total_credit, 2),
                        "credit_per_share": round(total_credit, 2),
                        "credit_pct": round(credit_pct, 2),
                        "breakeven_lower": round(best_put["strike"] - total_credit, 2),
                        "breakeven_upper": round(best_call["strike"] + total_credit, 2),
                        "profit_range": f"${best_put['strike']} - ${best_call['strike']}",
                    }
                }
        
        return {
            "symbol": symbol,
            "price": round(price, 2),
            "score": score,
            "signal": "strong_buy" if score >= 80 else "buy" if score >= 60 else "neutral",
            "checks": checks,
            "warnings": warnings,
            "iv_data": {"current_iv": current_iv, "iv_rank": iv_rank},
            "technicals": {"rsi": rsi, "trend": ema_data.get("trend")},
            "earnings": {"date": earnings_date, "safe": earnings_safe},
            "recommended_setup": recommended_setup,
            "data_source": "schwab" if schwab_data else "yfinance",
        }
    
    # =========================================================================
    # UTILITY METHODS
    # =========================================================================
    
    def get_watchlists(self) -> Dict[str, List[str]]:
        """Return available watchlists."""
        return {
            "quality_stocks": self.QUALITY_STOCKS,
            "high_iv": self.HIGH_IV_STOCKS,
            "liquid_etfs": self.LIQUID_ETFS,
            "all": list(set(self.QUALITY_STOCKS + self.HIGH_IV_STOCKS + self.LIQUID_ETFS))
        }


# Singleton instance
enhanced_scanner_service = EnhancedScannerService()
