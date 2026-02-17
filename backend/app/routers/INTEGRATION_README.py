# =============================================================================
# 0-DTE ROUTER INTEGRATION
# =============================================================================
# 
# Add the following to your backend/app/main.py to enable the 0-DTE endpoints
#
# =============================================================================

# STEP 1: Add this import at the top of main.py (with your other router imports)
# -----------------------------------------------------------------------------

from app.routers import zero_dte

# If you have other routers, it might look like:
# from app.routers import analyze, market, positions, trades, zero_dte


# STEP 2: Add this line where you include your other routers
# -----------------------------------------------------------------------------

app.include_router(zero_dte.router)

# Your router section might look something like:
# app.include_router(analyze.router)
# app.include_router(market.router)
# app.include_router(positions.router)
# app.include_router(trades.router)
# app.include_router(zero_dte.router)  # <-- ADD THIS LINE


# =============================================================================
# COMPLETE EXAMPLE main.py (for reference)
# =============================================================================
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import routers
from app.routers import analyze, market, positions, trades, zero_dte

app = FastAPI(
    title="IPMCC Commander API",
    description="Options trading analysis and management",
    version="2.7.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(analyze.router)
app.include_router(market.router)
app.include_router(positions.router)
app.include_router(trades.router)
app.include_router(zero_dte.router)  # 0-DTE endpoints

@app.get("/")
async def root():
    return {"message": "IPMCC Commander API v2.7.0"}

@app.get("/health")
async def health():
    return {"status": "healthy"}
"""


# =============================================================================
# VERIFY INSTALLATION
# =============================================================================
#
# After adding the router, restart your backend and test:
#
# curl http://localhost:8000/api/v1/zero-dte/vix
#
# You should see VIX data returned. If you get a 404, the router isn't registered.
#
# =============================================================================


# =============================================================================
# DEPENDENCIES
# =============================================================================
#
# The zero_dte.py router requires these packages (should already be installed):
#
# - fastapi
# - pydantic  
# - yfinance (fallback for VIX data)
# - pytz (for timezone handling)
#
# If using Schwab API (recommended), ensure your schwab_service.py is configured.
#
# =============================================================================
