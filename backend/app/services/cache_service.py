"""
IPMCC Commander - Cache Service
Simple in-memory cache with TTL support
"""

import time
import logging
import functools
from typing import Any, Optional, Dict, Callable
from threading import Lock

logger = logging.getLogger(__name__)


class CacheService:
    """
    Simple in-memory cache with TTL (time-to-live) support.
    Thread-safe implementation.
    """
    
    def __init__(self):
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._lock = Lock()
    
    def get(self, key: str) -> Optional[Any]:
        """
        Get a value from cache.
        Returns None if key doesn't exist or has expired.
        """
        with self._lock:
            if key not in self._cache:
                return None
            
            entry = self._cache[key]
            
            # Check if expired
            if entry.get("expires_at") and time.time() > entry["expires_at"]:
                del self._cache[key]
                return None
            
            return entry.get("value")
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """
        Set a value in cache.
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: Time-to-live in seconds (None = no expiration)
        """
        with self._lock:
            expires_at = None
            if ttl:
                expires_at = time.time() + ttl
            
            self._cache[key] = {
                "value": value,
                "created_at": time.time(),
                "expires_at": expires_at
            }
    
    def delete(self, key: str) -> bool:
        """
        Delete a key from cache.
        Returns True if key existed, False otherwise.
        """
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
            return False
    
    def clear(self) -> None:
        """Clear all entries from cache."""
        with self._lock:
            self._cache.clear()
    
    def cleanup_expired(self) -> int:
        """
        Remove all expired entries.
        Returns count of removed entries.
        """
        removed = 0
        current_time = time.time()
        
        with self._lock:
            keys_to_remove = []
            for key, entry in self._cache.items():
                if entry.get("expires_at") and current_time > entry["expires_at"]:
                    keys_to_remove.append(key)
            
            for key in keys_to_remove:
                del self._cache[key]
                removed += 1
        
        if removed:
            logger.debug(f"Cache cleanup: removed {removed} expired entries")
        
        return removed
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        with self._lock:
            total = len(self._cache)
            expired = 0
            current_time = time.time()
            
            for entry in self._cache.values():
                if entry.get("expires_at") and current_time > entry["expires_at"]:
                    expired += 1
            
            return {
                "total_entries": total,
                "expired_entries": expired,
                "active_entries": total - expired
            }
    
    def has(self, key: str) -> bool:
        """Check if a key exists and is not expired."""
        return self.get(key) is not None


# Singleton instance for backward compatibility
cache_service = CacheService()


async def cache_cleanup_task(interval_seconds: int = 300):
    """
    Background task to periodically clean up expired cache entries.
    Run this with asyncio.create_task() in your app startup.
    
    Args:
        interval_seconds: How often to run cleanup (default: 5 minutes)
    
    Usage in main.py:
        @app.on_event("startup")
        async def startup():
            asyncio.create_task(cache_cleanup_task())
    """
    import asyncio
    
    while True:
        try:
            await asyncio.sleep(interval_seconds)
            removed = cache_service.cleanup_expired()
            if removed > 0:
                logger.info(f"Cache cleanup: removed {removed} expired entries")
        except asyncio.CancelledError:
            logger.info("Cache cleanup task cancelled")
            break
        except Exception as e:
            logger.error(f"Error in cache cleanup task: {e}")


def cached(ttl: int = 300, key_prefix: str = ""):
    """
    Decorator to cache function results.
    
    Args:
        ttl: Time-to-live in seconds (default: 5 minutes)
        key_prefix: Prefix for cache key
    
    Usage:
        @cached(ttl=600, key_prefix="quotes")
        def get_quote(symbol: str):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            # Build cache key from function name and arguments
            key_parts = [key_prefix or func.__name__]
            key_parts.extend(str(arg) for arg in args)
            key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
            cache_key = ":".join(key_parts)
            
            # Check cache
            cached_value = cache_service.get(cache_key)
            if cached_value is not None:
                logger.debug(f"Cache hit: {cache_key}")
                return cached_value
            
            # Call function and cache result
            result = func(*args, **kwargs)
            cache_service.set(cache_key, result, ttl=ttl)
            logger.debug(f"Cache set: {cache_key}")
            return result
        
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            # Build cache key from function name and arguments
            key_parts = [key_prefix or func.__name__]
            key_parts.extend(str(arg) for arg in args)
            key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
            cache_key = ":".join(key_parts)
            
            # Check cache
            cached_value = cache_service.get(cache_key)
            if cached_value is not None:
                logger.debug(f"Cache hit: {cache_key}")
                return cached_value
            
            # Call function and cache result
            result = await func(*args, **kwargs)
            cache_service.set(cache_key, result, ttl=ttl)
            logger.debug(f"Cache set: {cache_key}")
            return result
        
        # Return appropriate wrapper based on function type
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    
    return decorator
