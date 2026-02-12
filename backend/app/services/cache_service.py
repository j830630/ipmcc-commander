"""
IPMCC Commander - Caching Service
In-memory cache with TTL for API data to avoid hammering external APIs
"""

import asyncio
import time
from datetime import datetime
from typing import Dict, Any, Optional, Callable, Awaitable
from functools import wraps
import logging
import hashlib
import json

logger = logging.getLogger(__name__)


class CacheEntry:
    """Single cache entry with expiration."""
    
    def __init__(self, value: Any, ttl_seconds: int):
        self.value = value
        self.created_at = time.time()
        self.expires_at = self.created_at + ttl_seconds
        self.hits = 0
    
    def is_expired(self) -> bool:
        return time.time() > self.expires_at
    
    def get(self) -> Any:
        self.hits += 1
        return self.value
    
    def remaining_ttl(self) -> float:
        return max(0, self.expires_at - time.time())


class CacheService:
    """
    In-memory cache service with TTL support.
    
    Features:
    - TTL-based expiration
    - Automatic cleanup of expired entries
    - Cache statistics
    - Namespace support for different data types
    
    Default TTLs:
    - Option chains: 60 seconds (Greeks change frequently)
    - Stock quotes: 30 seconds
    - Account data: 120 seconds
    - Sentiment data: 300 seconds (5 min)
    - Scanner results: 300 seconds
    """
    
    # Default TTLs in seconds
    DEFAULT_TTLS = {
        "option_chain": 60,
        "quote": 30,
        "quotes": 30,
        "account": 120,
        "positions": 120,
        "sentiment": 300,
        "scanner": 300,
        "calendar": 1800,  # 30 min
        "price_history": 300,
        "default": 60
    }
    
    def __init__(self, max_entries: int = 1000):
        """
        Initialize cache service.
        
        Args:
            max_entries: Maximum number of entries before eviction
        """
        self._cache: Dict[str, CacheEntry] = {}
        self._max_entries = max_entries
        self._stats = {
            "hits": 0,
            "misses": 0,
            "evictions": 0,
            "expirations": 0
        }
        self._lock = asyncio.Lock()
    
    def _make_key(self, namespace: str, key: str) -> str:
        """Create a cache key with namespace."""
        return f"{namespace}:{key}"
    
    def _hash_params(self, params: Dict[str, Any]) -> str:
        """Create a hash from parameters for cache key."""
        sorted_str = json.dumps(params, sort_keys=True)
        return hashlib.md5(sorted_str.encode()).hexdigest()[:12]
    
    async def get(self, namespace: str, key: str) -> Optional[Any]:
        """
        Get a value from cache.
        
        Args:
            namespace: Cache namespace (e.g., "option_chain", "quote")
            key: Cache key within namespace
            
        Returns:
            Cached value or None if not found/expired
        """
        cache_key = self._make_key(namespace, key)
        
        async with self._lock:
            entry = self._cache.get(cache_key)
            
            if entry is None:
                self._stats["misses"] += 1
                return None
            
            if entry.is_expired():
                del self._cache[cache_key]
                self._stats["expirations"] += 1
                self._stats["misses"] += 1
                return None
            
            self._stats["hits"] += 1
            return entry.get()
    
    async def set(
        self, 
        namespace: str, 
        key: str, 
        value: Any, 
        ttl: Optional[int] = None
    ) -> None:
        """
        Set a value in cache.
        
        Args:
            namespace: Cache namespace
            key: Cache key
            value: Value to cache
            ttl: TTL in seconds (uses default for namespace if not specified)
        """
        cache_key = self._make_key(namespace, key)
        
        if ttl is None:
            ttl = self.DEFAULT_TTLS.get(namespace, self.DEFAULT_TTLS["default"])
        
        async with self._lock:
            # Evict if at capacity
            if len(self._cache) >= self._max_entries:
                await self._evict_oldest()
            
            self._cache[cache_key] = CacheEntry(value, ttl)
    
    async def delete(self, namespace: str, key: str) -> bool:
        """Delete a cache entry."""
        cache_key = self._make_key(namespace, key)
        
        async with self._lock:
            if cache_key in self._cache:
                del self._cache[cache_key]
                return True
            return False
    
    async def clear_namespace(self, namespace: str) -> int:
        """Clear all entries in a namespace."""
        prefix = f"{namespace}:"
        count = 0
        
        async with self._lock:
            keys_to_delete = [k for k in self._cache.keys() if k.startswith(prefix)]
            for key in keys_to_delete:
                del self._cache[key]
                count += 1
        
        return count
    
    async def clear_all(self) -> int:
        """Clear entire cache."""
        async with self._lock:
            count = len(self._cache)
            self._cache.clear()
            return count
    
    async def _evict_oldest(self) -> None:
        """Evict oldest entries when at capacity."""
        if not self._cache:
            return
        
        # Find and remove oldest entry
        oldest_key = min(self._cache.keys(), key=lambda k: self._cache[k].created_at)
        del self._cache[oldest_key]
        self._stats["evictions"] += 1
    
    async def cleanup_expired(self) -> int:
        """Remove all expired entries."""
        count = 0
        
        async with self._lock:
            expired_keys = [
                k for k, v in self._cache.items() if v.is_expired()
            ]
            for key in expired_keys:
                del self._cache[key]
                count += 1
        
        self._stats["expirations"] += count
        return count
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        total_requests = self._stats["hits"] + self._stats["misses"]
        hit_rate = (self._stats["hits"] / total_requests * 100) if total_requests > 0 else 0
        
        return {
            "entries": len(self._cache),
            "max_entries": self._max_entries,
            "hits": self._stats["hits"],
            "misses": self._stats["misses"],
            "hit_rate": round(hit_rate, 2),
            "evictions": self._stats["evictions"],
            "expirations": self._stats["expirations"]
        }
    
    def get_namespace_stats(self, namespace: str) -> Dict[str, Any]:
        """Get stats for a specific namespace."""
        prefix = f"{namespace}:"
        entries = [
            (k, v) for k, v in self._cache.items() if k.startswith(prefix)
        ]
        
        return {
            "namespace": namespace,
            "entries": len(entries),
            "default_ttl": self.DEFAULT_TTLS.get(namespace, self.DEFAULT_TTLS["default"]),
            "oldest_entry_age": max((time.time() - v.created_at for _, v in entries), default=0),
            "total_hits": sum(v.hits for _, v in entries)
        }


# Singleton instance
cache_service = CacheService()


def cached(namespace: str, key_func: Optional[Callable[..., str]] = None, ttl: Optional[int] = None):
    """
    Decorator for caching async function results.
    
    Usage:
        @cached("option_chain", key_func=lambda symbol: symbol)
        async def get_option_chain(symbol: str):
            ...
    """
    def decorator(func: Callable[..., Awaitable[Any]]):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            if key_func:
                key = key_func(*args, **kwargs)
            else:
                # Default: hash all args
                key = cache_service._hash_params({"args": args, "kwargs": kwargs})
            
            # Check cache
            cached_value = await cache_service.get(namespace, key)
            if cached_value is not None:
                logger.debug(f"Cache hit: {namespace}:{key}")
                return cached_value
            
            # Call function and cache result
            result = await func(*args, **kwargs)
            await cache_service.set(namespace, key, result, ttl)
            logger.debug(f"Cache miss, stored: {namespace}:{key}")
            
            return result
        
        return wrapper
    return decorator


# Background task to periodically cleanup expired entries
async def cache_cleanup_task(interval_seconds: int = 60):
    """Background task to clean up expired cache entries."""
    while True:
        await asyncio.sleep(interval_seconds)
        count = await cache_service.cleanup_expired()
        if count > 0:
            logger.info(f"Cache cleanup: removed {count} expired entries")
