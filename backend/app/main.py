"""
IPMCC Commander - FastAPI Backend
Main application entry point with all routes registered.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="IPMCC Commander API",
    description="Backend for IPMCC Commander - Options Trading Analysis Platform",
    version="2.9.3",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# IMPORT AND REGISTER ROUTERS
# ============================================================================

# Market data endpoints (quote, IV, sector, VIX)
try:
    from app.routers.market_router import router as market_router
    app.include_router(market_router, prefix="/api/v1/market", tags=["Market Data"])
    logger.info("✓ Market router registered at /api/v1/market")
except ImportError as e:
    logger.warning(f"Market router not available: {e}")

# Earnings endpoints
try:
    from app.routers.market_router import router as market_router
    # Earnings endpoint is part of market router but also accessible at /api/v1/earnings
    app.include_router(market_router, prefix="/api/v1", tags=["Earnings"])
    logger.info("✓ Earnings endpoints available at /api/v1/earnings")
except ImportError as e:
    logger.warning(f"Earnings router not available: {e}")

# Scanner endpoints
try:
    from app.routers.scanner_router import router as scanner_router
    app.include_router(scanner_router, prefix="/api/v1/scanner", tags=["Scanner"])
    logger.info("✓ Scanner router registered at /api/v1/scanner")
except ImportError as e:
    logger.warning(f"Scanner router not available: {e}")

# Trades/positions endpoints
try:
    from app.routers.trades_router import router as trades_router
    app.include_router(trades_router, prefix="/api/v1/trades", tags=["Trades"])
    logger.info("✓ Trades router registered at /api/v1/trades")
except ImportError as e:
    logger.warning(f"Trades router not available: {e}")

# Analytics endpoints
try:
    from app.routers.analytics_router import router as analytics_router
    app.include_router(analytics_router, prefix="/api/v1/analytics", tags=["Analytics"])
    logger.info("✓ Analytics router registered at /api/v1/analytics")
except ImportError as e:
    logger.warning(f"Analytics router not available: {e}")


# ============================================================================
# ROOT ENDPOINTS
# ============================================================================

@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {
        "name": "IPMCC Commander API",
        "version": "2.9.3",
        "status": "running",
        "docs": "/docs",
        "endpoints": {
            "market": "/api/v1/market",
            "scanner": "/api/v1/scanner",
            "trades": "/api/v1/trades",
            "analytics": "/api/v1/analytics"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "version": "2.9.3"}


@app.get("/api/v1")
async def api_root():
    """API v1 root with available endpoints."""
    return {
        "version": "v1",
        "endpoints": {
            "market_quote": "GET /api/v1/market/quote/{ticker}",
            "market_iv": "GET /api/v1/market/iv/{ticker}",
            "market_sector": "GET /api/v1/market/sector/{ticker}",
            "market_vix": "GET /api/v1/market/vix",
            "earnings": "GET /api/v1/earnings/{ticker}",
            "scanner_desk": "POST /api/v1/scanner/desk",
            "scanner_strategy": "POST /api/v1/scanner/strategy"
        }
    }


# ============================================================================
# STARTUP / SHUTDOWN
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Run on application startup."""
    logger.info("=" * 50)
    logger.info("IPMCC Commander API Starting...")
    logger.info("=" * 50)


@app.on_event("shutdown")
async def shutdown_event():
    """Run on application shutdown."""
    logger.info("IPMCC Commander API Shutting down...")


# ============================================================================
# RUN WITH UVICORN
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
