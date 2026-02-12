"""
IPMCC Commander - Charles Schwab API Service
OAuth2 authentication and API client for real-time market data and trading
"""

import os
import json
import time
import base64
import httpx
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from pathlib import Path
import logging

from app.config import settings as app_settings

logger = logging.getLogger(__name__)


class SchwabAuthError(Exception):
    """Schwab authentication error"""
    pass


class SchwabAPIError(Exception):
    """Schwab API error"""
    pass


class SchwabService:
    """
    Charles Schwab API Client
    
    Handles OAuth2 authentication and provides access to:
    - Market Data (quotes, option chains with Greeks)
    - Account Data (positions, balances, orders)
    - Trading (place, modify, cancel orders)
    
    Rate Limits: 120 requests/minute
    """
    
    # API Endpoints
    AUTH_URL = "https://api.schwabapi.com/v1/oauth/authorize"
    TOKEN_URL = "https://api.schwabapi.com/v1/oauth/token"
    BASE_URL = "https://api.schwabapi.com"
    
    # Market Data endpoints
    QUOTES_URL = f"{BASE_URL}/marketdata/v1/quotes"
    CHAINS_URL = f"{BASE_URL}/marketdata/v1/chains"
    PRICE_HISTORY_URL = f"{BASE_URL}/marketdata/v1/pricehistory"
    MOVERS_URL = f"{BASE_URL}/marketdata/v1/movers"
    
    # Account endpoints  
    ACCOUNTS_URL = f"{BASE_URL}/trader/v1/accounts"
    ORDERS_URL_TEMPLATE = "/trader/v1/accounts/{account_hash}/orders"
    
    def __init__(
        self,
        app_key: Optional[str] = None,
        app_secret: Optional[str] = None,
        callback_url: str = "https://127.0.0.1",
        token_path: str = "./data/schwab_token.json"
    ):
        self.app_key = app_key or app_settings.schwab_app_key
        self.app_secret = app_secret or app_settings.schwab_app_secret
        self.callback_url = callback_url or app_settings.schwab_callback_url or "https://127.0.0.1"
        self.token_path = Path(token_path)
        
        self.access_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self.token_expires_at: Optional[datetime] = None
        self.account_hashes: Dict[str, str] = {}
        
        self._request_times: List[float] = []
        self._rate_limit = 120
        
        self._load_tokens()
    
    def _load_tokens(self):
        """Load tokens from file if they exist."""
        if self.token_path.exists():
            try:
                with open(self.token_path, 'r') as f:
                    data = json.load(f)
                    self.access_token = data.get('access_token')
                    self.refresh_token = data.get('refresh_token')
                    expires_at = data.get('expires_at')
                    if expires_at:
                        self.token_expires_at = datetime.fromisoformat(expires_at)
                    logger.info("Loaded Schwab tokens from file")
            except Exception as e:
                logger.warning(f"Could not load tokens: {e}")
    
    def _save_tokens(self):
        """Save tokens to file."""
        self.token_path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            'access_token': self.access_token,
            'refresh_token': self.refresh_token,
            'expires_at': self.token_expires_at.isoformat() if self.token_expires_at else None,
            'saved_at': datetime.now().isoformat()
        }
        with open(self.token_path, 'w') as f:
            json.dump(data, f, indent=2)
        logger.info("Saved Schwab tokens to file")
    
    def get_authorization_url(self) -> str:
        """Generate the authorization URL for OAuth2 login."""
        if not self.app_key:
            raise SchwabAuthError("SCHWAB_APP_KEY not configured")
        
        params = {
            "client_id": self.app_key,
            "redirect_uri": self.callback_url,
            "response_type": "code",
            "scope": "api"
        }
        
        query = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{self.AUTH_URL}?{query}"
    
    async def exchange_code_for_tokens(self, authorization_code: str) -> Dict[str, Any]:
        """Exchange authorization code for access/refresh tokens."""
        if not self.app_key or not self.app_secret:
            raise SchwabAuthError("SCHWAB_APP_KEY and SCHWAB_APP_SECRET required")
        
        credentials = f"{self.app_key}:{self.app_secret}"
        auth_header = base64.b64encode(credentials.encode()).decode()
        
        headers = {
            "Authorization": f"Basic {auth_header}",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        data = {
            "grant_type": "authorization_code",
            "code": authorization_code,
            "redirect_uri": self.callback_url
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(self.TOKEN_URL, headers=headers, data=data)
            
            if response.status_code != 200:
                raise SchwabAuthError(f"Token exchange failed: {response.text}")
            
            token_data = response.json()
            
            self.access_token = token_data.get('access_token')
            self.refresh_token = token_data.get('refresh_token')
            expires_in = token_data.get('expires_in', 1800)
            self.token_expires_at = datetime.now() + timedelta(seconds=expires_in)
            
            self._save_tokens()
            return token_data
    
    async def refresh_access_token(self) -> Dict[str, Any]:
        """Refresh the access token using the refresh token."""
        if not self.refresh_token:
            raise SchwabAuthError("No refresh token available. Please re-authorize.")
        
        credentials = f"{self.app_key}:{self.app_secret}"
        auth_header = base64.b64encode(credentials.encode()).decode()
        
        headers = {
            "Authorization": f"Basic {auth_header}",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        data = {
            "grant_type": "refresh_token",
            "refresh_token": self.refresh_token
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(self.TOKEN_URL, headers=headers, data=data)
            
            if response.status_code != 200:
                raise SchwabAuthError(f"Token refresh failed: {response.text}")
            
            token_data = response.json()
            
            self.access_token = token_data.get('access_token')
            if 'refresh_token' in token_data:
                self.refresh_token = token_data['refresh_token']
            expires_in = token_data.get('expires_in', 1800)
            self.token_expires_at = datetime.now() + timedelta(seconds=expires_in)
            
            self._save_tokens()
            return token_data
    
    async def _ensure_valid_token(self):
        """Ensure we have a valid access token, refreshing if needed."""
        if not self.access_token:
            raise SchwabAuthError("Not authenticated. Please authorize first.")
        
        if self.token_expires_at and datetime.now() >= self.token_expires_at - timedelta(seconds=60):
            logger.info("Access token expired or expiring soon, refreshing...")
            await self.refresh_access_token()
    
    async def _rate_limit_wait(self):
        """Implement rate limiting (120 requests/minute)."""
        now = time.time()
        minute_ago = now - 60
        
        self._request_times = [t for t in self._request_times if t > minute_ago]
        
        if len(self._request_times) >= self._rate_limit:
            sleep_time = self._request_times[0] - minute_ago + 0.1
            logger.warning(f"Rate limit reached, waiting {sleep_time:.1f}s")
            await asyncio.sleep(sleep_time)
        
        self._request_times.append(now)
    
    async def _request(
        self, 
        method: str, 
        url: str, 
        params: Optional[Dict] = None,
        json_data: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Make an authenticated API request."""
        await self._ensure_valid_token()
        await self._rate_limit_wait()
        
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/json"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.request(
                method=method,
                url=url,
                headers=headers,
                params=params,
                json=json_data,
                timeout=30.0
            )
            
            if response.status_code == 401:
                await self.refresh_access_token()
                headers["Authorization"] = f"Bearer {self.access_token}"
                response = await client.request(
                    method=method,
                    url=url,
                    headers=headers,
                    params=params,
                    json=json_data,
                    timeout=30.0
                )
            
            if response.status_code not in (200, 201):
                raise SchwabAPIError(f"API request failed ({response.status_code}): {response.text}")
            
            return response.json()
    
    # ============ MARKET DATA METHODS ============
    
    async def get_quotes(self, symbols: List[str]) -> Dict[str, Any]:
        """Get real-time quotes for multiple symbols."""
        params = {
            "symbols": ",".join(symbols),
            "fields": "quote,fundamental,extended,reference,regular"
        }
        return await self._request("GET", self.QUOTES_URL, params=params)
    
    async def get_option_chain(
        self,
        symbol: str,
        contract_type: str = "ALL",
        strike_count: Optional[int] = None,
        include_underlying_quote: bool = True,
        strategy: str = "SINGLE",
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        exp_month: Optional[str] = None,
        option_type: str = "ALL"
    ) -> Dict[str, Any]:
        """
        Get option chain with Greeks for a symbol.
        Returns delta, gamma, theta, vega, rho, IV for each contract.
        """
        params = {
            "symbol": symbol.upper(),
            "contractType": contract_type,
            "includeUnderlyingQuote": str(include_underlying_quote).lower(),
            "strategy": strategy,
            "optionType": option_type
        }
        
        if strike_count:
            params["strikeCount"] = strike_count
        if from_date:
            params["fromDate"] = from_date
        if to_date:
            params["toDate"] = to_date
        if exp_month:
            params["expMonth"] = exp_month
        
        return await self._request("GET", self.CHAINS_URL, params=params)
    
    async def get_price_history(
        self,
        symbol: str,
        period_type: str = "month",
        period: int = 1,
        frequency_type: str = "daily",
        frequency: int = 1
    ) -> Dict[str, Any]:
        """Get historical price data."""
        params = {
            "symbol": symbol.upper(),
            "periodType": period_type,
            "period": period,
            "frequencyType": frequency_type,
            "frequency": frequency
        }
        return await self._request("GET", self.PRICE_HISTORY_URL, params=params)
    
    async def get_movers(
        self,
        index: str = "$SPX",
        direction: str = "up",
        change_type: str = "percent"
    ) -> Dict[str, Any]:
        """Get top movers for an index."""
        params = {"direction": direction, "change": change_type}
        url = f"{self.MOVERS_URL}/{index}"
        return await self._request("GET", url, params=params)
    
    # ============ ACCOUNT METHODS ============
    
    async def get_accounts(self) -> Dict[str, Any]:
        """Get all linked accounts with positions and balances."""
        params = {"fields": "positions"}
        data = await self._request("GET", self.ACCOUNTS_URL, params=params)
        
        for account in data:
            if 'securitiesAccount' in account:
                acc = account['securitiesAccount']
                acc_num = acc.get('accountNumber')
                acc_hash = account.get('hashValue')
                if acc_num and acc_hash:
                    self.account_hashes[acc_num] = acc_hash
        
        return data
    
    async def get_positions(self, account_hash: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get positions for an account."""
        if not account_hash and not self.account_hashes:
            await self.get_accounts()
        
        if not account_hash:
            account_hash = list(self.account_hashes.values())[0] if self.account_hashes else None
        
        if not account_hash:
            raise SchwabAPIError("No account hash available")
        
        url = f"{self.ACCOUNTS_URL}/{account_hash}"
        params = {"fields": "positions"}
        account = await self._request("GET", url, params=params)
        return account.get('securitiesAccount', {}).get('positions', [])
    
    # ============ ORDER METHODS ============
    
    async def place_order(self, account_hash: str, order: Dict[str, Any]) -> Dict[str, Any]:
        """Place an order."""
        url = f"{self.ACCOUNTS_URL}/{account_hash}/orders"
        return await self._request("POST", url, json_data=order)
    
    async def cancel_order(self, account_hash: str, order_id: str) -> Dict[str, Any]:
        """Cancel an order."""
        url = f"{self.ACCOUNTS_URL}/{account_hash}/orders/{order_id}"
        return await self._request("DELETE", url)
    
    # ============ HELPER METHODS ============
    
    def is_authenticated(self) -> bool:
        """Check if we have valid authentication."""
        if not self.access_token:
            return False
        if self.token_expires_at and datetime.now() >= self.token_expires_at:
            return False
        return True
    
    def get_token_expiry(self) -> Optional[datetime]:
        """Get token expiration time."""
        return self.token_expires_at


# Singleton instance
schwab_service = SchwabService()
