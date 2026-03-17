"""
IPMCC Commander - Schwab API Router
Authentication, market data, account, and trading endpoints
"""

from fastapi import APIRouter, HTTPException, Query, Body
from typing import Optional, List
from datetime import date
import logging

from app.services.schwab_service import schwab_service, SchwabAuthError, SchwabAPIError
from app.services.cache_service import cache_service, cached

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/schwab", tags=["Schwab API"])


# ============ AUTHENTICATION ENDPOINTS ============

@router.get("/auth/status")
async def get_auth_status():
    """Check Schwab authentication status."""
    is_auth = schwab_service.is_authenticated()
    token_expiry = schwab_service.get_token_expiry()
    
    return {
        "authenticated": is_auth,
        "token_expires_at": token_expiry.isoformat() if token_expiry else None,
        "has_app_key": bool(schwab_service.app_key),
        "has_app_secret": bool(schwab_service.app_secret),
        "callback_url": schwab_service.callback_url
    }


@router.get("/auth/url")
async def get_authorization_url():
    """
    Get the OAuth2 authorization URL.
    User must visit this URL to authorize the app.
    """
    try:
        url = schwab_service.get_authorization_url()
        return {
            "authorization_url": url,
            "instructions": [
                "1. Visit the authorization URL in a browser",
                "2. Log in with your Schwab credentials",
                "3. Authorize the app to access your account",
                "4. Copy the full redirect URL (including the code parameter)",
                "5. POST the code to /api/v1/schwab/auth/callback"
            ]
        }
    except SchwabAuthError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/auth/callback")
async def handle_oauth_callback(
    code: str = Body(..., embed=True, description="Authorization code from callback URL")
):
    """
    Exchange authorization code for tokens.
    
    After authorizing, the redirect URL will contain a 'code' parameter.
    Extract this code and POST it here.
    """
    try:
        # Clean the code if it's a full URL
        if "code=" in code:
            # Extract code from URL
            import urllib.parse
            parsed = urllib.parse.urlparse(code)
            params = urllib.parse.parse_qs(parsed.query)
            code = params.get("code", [code])[0]
        
        token_data = await schwab_service.exchange_code_for_tokens(code)
        
        return {
            "success": True,
            "message": "Successfully authenticated with Schwab",
            "expires_in": token_data.get("expires_in"),
            "token_type": token_data.get("token_type")
        }
    except SchwabAuthError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/auth/refresh")
async def refresh_token():
    """Manually refresh the access token."""
    try:
        token_data = await schwab_service.refresh_access_token()
        return {
            "success": True,
            "message": "Token refreshed successfully",
            "expires_in": token_data.get("expires_in")
        }
    except SchwabAuthError as e:
        raise HTTPException(status_code=401, detail=str(e))


# ============ MARKET DATA ENDPOINTS ============

@router.get("/quotes")
async def get_quotes(
    symbols: str = Query(..., description="Comma-separated list of symbols")
):
    """
    Get real-time quotes for multiple symbols.
    
    Example: /api/v1/schwab/quotes?symbols=AAPL,MSFT,GOOGL
    """
    try:
        symbol_list = [s.strip().upper() for s in symbols.split(",")]
        
        # Check cache first
        cache_key = ",".join(sorted(symbol_list))
        cached_data = await cache_service.get("quotes", cache_key)
        if cached_data:
            return {"source": "cache", "data": cached_data}
        
        # Fetch from Schwab
        data = await schwab_service.get_quotes(symbol_list)
        
        # Cache the result
        await cache_service.set("quotes", cache_key, data)
        
        return {"source": "schwab", "data": data}
    except SchwabAuthError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except SchwabAPIError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/option-chain/{symbol}")
async def get_option_chain(
    symbol: str,
    contract_type: str = Query("ALL", description="CALL, PUT, or ALL"),
    strike_count: Optional[int] = Query(None, description="Number of strikes above/below ATM"),
    from_date: Optional[str] = Query(None, description="Filter expirations from date (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(None, description="Filter expirations to date (YYYY-MM-DD)"),
    exp_month: Optional[str] = Query(None, description="Filter by month (JAN, FEB, etc.)")
):
    """
    Get option chain with Greeks for a symbol.
    
    Returns delta, gamma, theta, vega, rho, IV for each contract.
    This is the key advantage over free APIs - real Greeks from Schwab.
    """
    try:
        symbol = symbol.upper()
        
        # Build cache key
        cache_key = f"{symbol}:{contract_type}:{strike_count}:{from_date}:{to_date}:{exp_month}"
        
        # Check cache (60 second TTL for option chains)
        cached_data = await cache_service.get("option_chain", cache_key)
        if cached_data:
            return {"source": "cache", "data": cached_data}
        
        # Fetch from Schwab
        data = await schwab_service.get_option_chain(
            symbol=symbol,
            contract_type=contract_type,
            strike_count=strike_count,
            from_date=from_date,
            to_date=to_date,
            exp_month=exp_month
        )
        
        # Cache the result
        await cache_service.set("option_chain", cache_key, data)
        
        return {"source": "schwab", "data": data}
    except SchwabAuthError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except SchwabAPIError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/price-history/{symbol}")
async def get_price_history(
    symbol: str,
    period_type: str = Query("month", description="day, month, year, ytd"),
    period: int = Query(1, description="Number of periods"),
    frequency_type: str = Query("daily", description="minute, daily, weekly, monthly"),
    frequency: int = Query(1, description="Frequency interval")
):
    """Get historical price data for a symbol."""
    try:
        symbol = symbol.upper()
        
        cache_key = f"{symbol}:{period_type}:{period}:{frequency_type}:{frequency}"
        cached_data = await cache_service.get("price_history", cache_key)
        if cached_data:
            return {"source": "cache", "data": cached_data}
        
        data = await schwab_service.get_price_history(
            symbol=symbol,
            period_type=period_type,
            period=period,
            frequency_type=frequency_type,
            frequency=frequency
        )
        
        await cache_service.set("price_history", cache_key, data)
        
        return {"source": "schwab", "data": data}
    except SchwabAuthError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except SchwabAPIError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/movers/{index}")
async def get_movers(
    index: str = "$SPX",
    direction: str = Query("up", description="up or down"),
    change_type: str = Query("percent", description="percent or value")
):
    """Get top movers for an index ($SPX, $COMPX, $DJI)."""
    try:
        data = await schwab_service.get_movers(index, direction, change_type)
        return {"data": data}
    except SchwabAuthError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except SchwabAPIError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============ ACCOUNT ENDPOINTS ============

@router.get("/accounts")
async def get_accounts():
    """Get all linked Schwab accounts with positions and balances."""
    try:
        cache_key = "all_accounts"
        cached_data = await cache_service.get("account", cache_key)
        if cached_data:
            return {"source": "cache", "data": cached_data}
        
        data = await schwab_service.get_accounts()
        await cache_service.set("account", cache_key, data)
        
        return {"source": "schwab", "data": data}
    except SchwabAuthError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except SchwabAPIError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/positions")
async def get_positions(
    account_hash: Optional[str] = Query(None, description="Account hash (uses first account if not specified)")
):
    """Get positions for an account."""
    try:
        cache_key = f"positions:{account_hash or 'default'}"
        cached_data = await cache_service.get("positions", cache_key)
        if cached_data:
            return {"source": "cache", "data": cached_data}
        
        data = await schwab_service.get_positions(account_hash)
        await cache_service.set("positions", cache_key, data)
        
        return {"source": "schwab", "data": data}
    except SchwabAuthError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except SchwabAPIError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============ ORDER ENDPOINTS ============

@router.post("/orders/{account_hash}")
async def place_order(
    account_hash: str,
    order: dict = Body(..., description="Order object - see Schwab API docs")
):
    """
    Place an order.
    
    WARNING: This will execute a real trade. Use with caution.
    
    Example order for single option:
    {
        "orderType": "LIMIT",
        "session": "NORMAL",
        "duration": "DAY",
        "orderStrategyType": "SINGLE",
        "price": 1.50,
        "orderLegCollection": [{
            "instruction": "SELL_TO_OPEN",
            "quantity": 1,
            "instrument": {
                "symbol": "AAPL_021425C200",
                "assetType": "OPTION"
            }
        }]
    }
    """
    try:
        # Clear account cache since positions will change
        await cache_service.clear_namespace("account")
        await cache_service.clear_namespace("positions")
        
        data = await schwab_service.place_order(account_hash, order)
        return {"success": True, "data": data}
    except SchwabAuthError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except SchwabAPIError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/orders/{account_hash}/{order_id}")
async def cancel_order(account_hash: str, order_id: str):
    """Cancel an open order."""
    try:
        data = await schwab_service.cancel_order(account_hash, order_id)
        return {"success": True, "data": data}
    except SchwabAuthError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except SchwabAPIError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============ CACHE MANAGEMENT ============

@router.get("/cache/stats")
async def get_cache_stats():
    """Get cache statistics."""
    return cache_service.get_stats()


@router.delete("/cache/clear")
async def clear_cache(namespace: Optional[str] = Query(None, description="Namespace to clear, or all if not specified")):
    """Clear cache (optionally by namespace)."""
    if namespace:
        count = await cache_service.clear_namespace(namespace)
        return {"cleared": count, "namespace": namespace}
    else:
        count = await cache_service.clear_all()
        return {"cleared": count, "namespace": "all"}
