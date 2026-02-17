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
    version="2.10.0",
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

# Market data endpoints (quote, IV, sector, VIX, earnings)
try:
    from app.routers.market_router import router as market_router
    app.include_router(market_router, prefix="/api/v1/market", tags=["Market Data"])
    # Also register at /api/v1 for earnings endpoint
    app.include_router(market_router, prefix="/api/v1", tags=["Earnings"])
    logger.info("✓ Market router registered at /api/v1/market")
except ImportError as e:
    logger.warning(f"Market router not available: {e}")

# Legacy market endpoints (yfinance-based)
try:
    from app.routers.market import router as market_legacy_router
    app.include_router(market_legacy_router, prefix="/api/v1/market-legacy", tags=["Market (Legacy)"])
    logger.info("✓ Legacy market router registered at /api/v1/market-legacy")
except ImportError as e:
    logger.warning(f"Legacy market router not available: {e}")

# Scanner endpoints
try:
    from app.routers.scanner_router import router as scanner_router
    app.include_router(scanner_router, prefix="/api/v1/scanner", tags=["Scanner"])
    logger.info("✓ Scanner router registered at /api/v1/scanner")
except ImportError as e:
    logger.warning(f"Scanner router not available: {e}")

# Enhanced Scanner endpoints (comprehensive guide-compliant scanning)
try:
    from app.routers.enhanced_scanner_router import router as enhanced_scanner_router
    app.include_router(enhanced_scanner_router, prefix="/api/v1", tags=["Enhanced Scanner"])
    logger.info("✓ Enhanced scanner router registered at /api/v1/scanner/enhanced")
except ImportError as e:
    logger.warning(f"Enhanced scanner router not available: {e}")

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

# 0-DTE Trading endpoints (GEX, VIX, market structure)
try:
    from app.routers.zero_dte import router as zero_dte_router
    # Note: zero_dte router already has prefix="/api/v1/zero-dte" defined internally
    app.include_router(zero_dte_router, tags=["0-DTE Trading"])
    logger.info("✓ 0-DTE router registered at /api/v1/zero-dte")
except ImportError as e:
    logger.warning(f"0-DTE router not available: {e}")

# Macro Analysis endpoints
try:
    from app.routers.macro_analysis import router as macro_router
    app.include_router(macro_router, prefix="/api/v1", tags=["Macro Analysis"])
    logger.info("✓ Macro analysis router registered at /api/v1/macro-analysis")
except ImportError as e:
    logger.warning(f"Macro analysis router not available: {e}")

# Schwab API endpoints (authentication, quotes, options)
try:
    from app.routers.schwab_router import router as schwab_router
    app.include_router(schwab_router, prefix="/api/v1/schwab", tags=["Schwab API"])
    logger.info("✓ Schwab router registered at /api/v1/schwab")
except ImportError as e:
    logger.warning(f"Schwab router not available: {e}")

# Risk monitoring endpoints
try:
    from app.routers.risk_router import router as risk_router
    app.include_router(risk_router, prefix="/api/v1/risk", tags=["Risk Monitoring"])
    logger.info("✓ Risk router registered at /api/v1/risk")
except ImportError as e:
    logger.warning(f"Risk router not available: {e}")

# Positions endpoints (LEAP positions CRUD)
try:
    from app.routers.positions import router as positions_router
    app.include_router(positions_router, prefix="/api/v1/positions", tags=["Positions"])
    logger.info("✓ Positions router registered at /api/v1/positions")
except ImportError as e:
    logger.warning(f"Positions router not available: {e}")

# Cycles endpoints (short call cycles)
try:
    from app.routers.cycles import router as cycles_router
    app.include_router(cycles_router, prefix="/api/v1/cycles", tags=["Cycles"])
    logger.info("✓ Cycles router registered at /api/v1/cycles")
except ImportError as e:
    logger.warning(f"Cycles router not available: {e}")

# Analyze endpoints (trade validation, Greeks)
try:
    from app.routers.analyze import router as analyze_router
    app.include_router(analyze_router, prefix="/api/v1/analyze", tags=["Analysis"])
    logger.info("✓ Analyze router registered at /api/v1/analyze")
except ImportError as e:
    logger.warning(f"Analyze router not available: {e}")

# Dashboard endpoints (portfolio summary, alerts)
try:
    from app.routers.dashboard import router as dashboard_router
    app.include_router(dashboard_router, prefix="/api/v1/dashboard", tags=["Dashboard"])
    logger.info("✓ Dashboard router registered at /api/v1/dashboard")
except ImportError as e:
    logger.warning(f"Dashboard router not available: {e}")

# Economic calendar endpoints
try:
    from app.routers.economic import router as economic_router
    app.include_router(economic_router, prefix="/api/v1/economic", tags=["Economic Calendar"])
    logger.info("✓ Economic router registered at /api/v1/economic")
except ImportError as e:
    logger.warning(f"Economic router not available: {e}")


# ============================================================================
# ROOT ENDPOINTS
# ============================================================================

@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {
        "name": "IPMCC Commander API",
        "version": "2.10.0",
        "status": "running",
        "docs": "/docs",
        "endpoints": {
            "market": "/api/v1/market",
            "scanner": "/api/v1/scanner",
            "scanner_enhanced": "/api/v1/scanner/enhanced",
            "trades": "/api/v1/trades",
            "analytics": "/api/v1/analytics",
            "zero_dte": "/api/v1/zero-dte",
            "macro": "/api/v1/macro-analysis",
            "schwab": "/api/v1/schwab",
            "risk": "/api/v1/risk",
            "positions": "/api/v1/positions",
            "cycles": "/api/v1/cycles",
            "analyze": "/api/v1/analyze",
            "dashboard": "/api/v1/dashboard",
            "economic": "/api/v1/economic"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "version": "2.10.0"}


@app.get("/api/v1")
async def api_root():
    """API v1 root with available endpoints."""
    return {
        "version": "v1",
        "endpoints": {
            # Market Data
            "market_quote": "GET /api/v1/market/quote/{ticker}",
            "market_iv": "GET /api/v1/market/iv/{ticker}",
            "market_sector": "GET /api/v1/market/sector/{ticker}",
            "market_vix": "GET /api/v1/market/vix",
            "earnings": "GET /api/v1/earnings/{ticker}",
            # Enhanced Scanner (NEW - Guide Compliant)
            "scanner_enhanced_ipmcc": "GET /api/v1/scanner/enhanced/ipmcc",
            "scanner_enhanced_112": "GET /api/v1/scanner/enhanced/112",
            "scanner_enhanced_strangles": "GET /api/v1/scanner/enhanced/strangles",
            "scanner_enhanced_single": "GET /api/v1/scanner/enhanced/single/{strategy}/{symbol}",
            "scanner_enhanced_rules": "GET /api/v1/scanner/enhanced/rules",
            # Legacy Scanner
            "scanner_desk": "POST /api/v1/scanner/desk",
            "scanner_strategy": "POST /api/v1/scanner/strategy",
            # 0-DTE
            "zero_dte_market": "GET /api/v1/zero-dte/market-data/{underlying}",
            "zero_dte_gex": "GET /api/v1/zero-dte/gex/{symbol}",
            "zero_dte_vix": "GET /api/v1/zero-dte/vix",
            "zero_dte_windows": "GET /api/v1/zero-dte/trading-windows",
            "zero_dte_killswitch": "GET /api/v1/zero-dte/kill-switch-status",
            # Macro
            "macro_analysis": "POST /api/v1/macro-analysis",
            # Schwab
            "schwab_quotes": "GET /api/v1/schwab/quotes",
            "schwab_chain": "GET /api/v1/schwab/option-chain/{symbol}",
            # Positions & Cycles
            "positions": "GET /api/v1/positions",
            "cycles": "GET /api/v1/cycles/position/{id}",
            # Analysis
            "analyze_validate": "POST /api/v1/analyze/validate",
            "analyze_greeks": "POST /api/v1/analyze/greeks",
            # Dashboard
            "dashboard_summary": "GET /api/v1/dashboard/summary",
            # Risk
            "risk_analyze": "POST /api/v1/risk/analyze/position",
            # Economic
            "economic_events": "GET /api/v1/economic/events"
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
