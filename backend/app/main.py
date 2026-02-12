"""
IPMCC Commander - FastAPI Application
Main entry point for the backend API
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.config import settings
from app.database import init_db, close_db
from app.routers import positions, cycles, analyze, market, dashboard
from app.routers.market_router import router as sentiment_router
from app.routers.schwab_router import router as schwab_router
from app.routers.risk_router import router as risk_router
from app.routers.analytics_router import router as analytics_router
from app.routers.trades_router import router as trades_router
from app.services.cache_service import cache_cleanup_task
import asyncio

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan handler.
    
    Startup: Initialize database, start background tasks
    Shutdown: Close database connections
    """
    # Startup
    logger.info("🚀 Starting IPMCC Commander API...")
    await init_db()
    logger.info("✅ Database initialized")
    
    # Start cache cleanup background task
    cleanup_task = asyncio.create_task(cache_cleanup_task(interval_seconds=60))
    logger.info("✅ Cache cleanup task started")
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down IPMCC Commander API...")
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass
    await close_db()
    logger.info("✅ Database connections closed")


# Create FastAPI application
app = FastAPI(
    title=settings.api_title,
    description=settings.api_description,
    version=settings.api_version,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(
    positions.router, 
    prefix="/api/v1/positions", 
    tags=["Positions"]
)
app.include_router(
    cycles.router, 
    prefix="/api/v1/cycles", 
    tags=["Cycles"]
)
app.include_router(
    analyze.router, 
    prefix="/api/v1/analyze", 
    tags=["Analysis"]
)
app.include_router(
    market.router, 
    prefix="/api/v1/market", 
    tags=["Market Data"]
)
app.include_router(
    dashboard.router, 
    prefix="/api/v1/dashboard", 
    tags=["Dashboard"]
)

# Include sentiment and scanner router (no prefix - already has /api/v1)
app.include_router(sentiment_router)

# Include Schwab API router
app.include_router(
    schwab_router,
    prefix="/api/v1",
    tags=["Schwab API"]
)

# Include Risk monitoring router
app.include_router(
    risk_router,
    prefix="/api/v1",
    tags=["Risk Monitoring"]
)

# Include Analytics router
app.include_router(
    analytics_router,
    prefix="/api/v1/analytics",
    tags=["Analytics"]
)

# Include Trades router
app.include_router(
    trades_router,
    prefix="/api/v1",
    tags=["Trade Recording"]
)


@app.get("/", tags=["Health"])
async def root():
    """Root endpoint with API info."""
    return {
        "name": settings.api_title,
        "version": settings.api_version,
        "description": settings.api_description,
        "docs": "/docs",
        "status": "running"
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": settings.api_version
    }


@app.get("/api/v1", tags=["Health"])
async def api_info():
    """API version info."""
    return {
        "version": "v1",
        "endpoints": {
            "positions": "/api/v1/positions",
            "cycles": "/api/v1/cycles",
            "analyze": "/api/v1/analyze",
            "market": "/api/v1/market",
            "dashboard": "/api/v1/dashboard",
            "sentiment": "/api/v1/sentiment",
            "calendar": "/api/v1/calendar",
            "scanner": "/api/v1/scanner",
            "schwab": "/api/v1/schwab",
            "risk": "/api/v1/risk",
            "changelog": "/api/v1/changelog"
        }
    }


# Changelog data
CHANGELOG = [
    {
        "version": "2.1.0",
        "date": "2026-02-10",
        "changes": [
            "🔐 Added Charles Schwab API integration (real-time data, trading)",
            "⚠️ Added Risk Alert Service (assignment risk, roll triggers)",
            "📊 Added Portfolio Beta-Weighted Delta analysis",
            "✅ Added Pydantic input validation for IPMCC, 112, Strangles",
            "💾 Added intelligent caching layer (60s option chains, 30s quotes)",
            "🎯 Added profit target and stop loss alerts",
            "🔒 Hardened trade entry validation (structural rules enforced)"
        ]
    },
    {
        "version": "2.1.1",
        "date": "2026-02-11",
        "changes": [
            "🐛 Fixed dashboard syntax error (extra closing brace)",
            "🐛 Fixed Trade Lab warnings rendering (objects as React children)",
            "🐛 Fixed Economic Calendar default to TradingView widget",
            "📝 Improved Schwab OAuth instructions (connection refused is expected)",
            "🔧 Updated config.py to support all new environment variables",
            "🔧 Fixed Schwab service ORDERS_URL template error"
        ]
    },
    {
        "version": "2.2.0",
        "date": "2026-02-11",
        "changes": [
            "🧮 Added Portfolio Calculator engine with projections and tax analysis",
            "📚 Expanded Strategy Guide with tabs for all strategies (IPMCC, 112, Strangles, Credit Spreads)",
            "🔧 Fixed Trade Lab strike/expiration alignment",
            "🔍 Fixed Scanner to properly handle multiple comma-separated tickers",
            "📊 Added compounding growth charts to Calculator",
            "💰 Added withdrawal impact analysis to Calculator",
            "📈 Added risk-adjusted return metrics per strategy and risk profile"
        ]
    },
    {
        "version": "2.2.1",
        "date": "2026-02-11",
        "changes": [
            "✅ Added 'Ignore taxes' checkbox to Portfolio Calculator",
            "🔗 Fixed Scanner → Trade Lab ticker pass-through (now auto-populates)",
            "📊 Fixed compounding chart bar heights not updating properly",
            "🎨 Added visual indicators for ignored taxes (strikethrough, opacity)"
        ]
    },
    {
        "version": "2.3.0",
        "date": "2026-02-11",
        "changes": [
            "📊 NEW: Analytics Page with portfolio P&L charts and metrics",
            "🔄 NEW: Roll Suggestions Engine - auto-detects when to roll positions",
            "📅 NEW: Earnings Calendar Integration - flags positions with upcoming earnings",
            "💾 NEW: Trade History tracking database for comprehensive analytics",
            "📈 Added P&L over time chart (area chart with cumulative returns)",
            "📊 Added monthly premium income chart (bar chart)",
            "🥧 Added performance by ticker breakdown chart",
            "🎯 Added win/loss ratio pie chart",
            "📉 Added detailed trade statistics (avg win/loss, profit factor, etc.)",
            "⚠️ Added real-time roll suggestions with urgency levels",
            "📅 Added earnings risk detection for active positions",
            "🗄️ Added PortfolioSnapshot model for daily tracking",
            "🗄️ Added TradeHistory model for trade recording",
            "🗄️ Added EarningsEvent model for earnings calendar",
            "🗄️ Added RollSuggestion model for automated suggestions"
        ]
    },
    {
        "version": "2.4.0",
        "date": "2026-02-11",
        "changes": [
            "📝 NEW: Trade Journal page for recording and tracking all trades",
            "📊 NEW: Dashboard action items widget showing roll suggestions and earnings risks",
            "⚡ NEW: Quick actions widget on dashboard (Log Trade, New Setup, Scan, Analytics)",
            "🔔 NEW: Position detail alerts - roll suggestions and earnings warnings inline",
            "💾 Trade recording API with full trade history support",
            "📈 Trade summary with credits, debits, fees, and net cash flow",
            "🎯 Integrated roll suggestions into position detail view",
            "📅 Earnings risk detection shown directly on position pages"
        ]
    },
    {
        "version": "2.5.0",
        "date": "2026-02-11",
        "changes": [
            "📊 Analytics now displays real data from Trade Journal",
            "📈 P&L charts populate from actual recorded trades",
            "💰 Monthly income chart shows premium from trade history",
            "🎯 Performance by ticker calculated from real trades",
            "🔄 Execute Roll button pre-fills trade form with suggested values",
            "📱 PWA Support - App now installable on mobile devices",
            "⚡ Service Worker for offline page caching",
            "🏠 App shortcuts for Dashboard, Log Trade, Scanner",
            "➕ Quick Trade button added to Scanner results",
            "🔗 Scanner to Trade Journal flow - log trades from setups found",
            "📊 Empty state handling in Analytics with helpful prompts",
            "🎨 Custom app icon (SVG) for PWA"
        ]
    },
    {
        "version": "2.0.0",
        "date": "2026-02-08",
        "changes": [
            "Added Market Sentiment Dashboard (Fear/Greed, VIX, Forex pairs)",
            "Added Economic Calendar with ForexFactory-style data",
            "Added Strategy Scanner for IPMCC, 112 Trade, Strangles",
            "Added TradingView chart integration with ticker selection",
            "Added Strategy Command Center on dashboard",
            "Integrated free data APIs (Yahoo Finance, Finnhub, CNN)"
        ]
    },
    {
        "version": "1.1.0",
        "date": "2026-02-07",
        "changes": [
            "Fixed validation engine null reference errors",
            "Added manual price input to Trade Lab",
            "Fixed Next.js font compatibility issues",
            "Improved Greeks calculation with pure Python Black-Scholes"
        ]
    },
    {
        "version": "1.0.0",
        "date": "2026-02-06",
        "changes": [
            "Initial release of IPMCC Commander",
            "Trade Lab for validating IPMCC setups",
            "Position tracking and journal",
            "Greeks engine with Black-Scholes calculations",
            "Market data integration via yfinance"
        ]
    }
]


@app.get("/api/v1/changelog", tags=["Info"])
async def get_changelog():
    """Get application changelog."""
    return {"changelog": CHANGELOG}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
