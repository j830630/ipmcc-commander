# Changelog data - ORDERED BY VERSION (LATEST FIRST)
CHANGELOG = [
    {
        "version": "2.9.2",
        "date": "2026-02-16",
        "changes": [
            "🌍 NEW: Multi-Horizon Macro Validation integrated into Trade Scanner",
            "📅 Event Horizon: FOMC dates hard-coded, blackout dates configurable",
            "🎯 Decision Hierarchy: Binary Events > Macro Trends > Technical/GEX",
            "📊 Sector Rotation: XL-series ETF relative strength calculation",
            "🏢 Mag 8 Monitoring: NVDA, AAPL, MSFT, AMZN, META, GOOGL, TSLA, AVGO earnings impact on index",
            "⚡ Auto-detection: Index vs Single Stock with appropriate analysis scope",
            "🔴 Binary Event Override: Events within 5 days block ALL technical signals",
            "📉 Confidence Adjustment: Macro headwinds reduce confidence by up to 25 pts",
            "🏷️ Asset Scoping: Index focuses on macro, single stocks add sector + liquidity checks",
            "📋 Macro Panel: VIX regime, bond yields, sector RS, event calendar"
        ]
    },
    {
        "version": "2.9.1",
        "date": "2026-02-14",
        "changes": [
            "🛡️ NEW: The Desk Command Center - Complete strategy management suite",
            "📋 Self-Audit Tab - Review all 25+ rules The Desk methodology follows",
            "🔬 Regime Simulator - Test any market scenario with preset templates",
            "📓 Trade Journal - Log trades with Desk compliance tracking",
            "📊 Performance Analytics - Win rate by regime, followed vs ignored signals",
            "🎯 Decision Tree Viewer - See exactly how The Desk made each decision",
            "⚡ Quick Scenarios: Trend Day Up/Down, Mean Reversion, Gamma Squeeze, Bull Trap",
            "🔄 Trade Scanner now auto-populates from Schwab API",
            "⚡ Ticker change auto-refreshes all market data"
        ]
    },
    {
        "version": "2.9.0",
        "date": "2026-02-13",
        "changes": [
            "🛡️ NEW: 'The Desk' Institutional Trade Scanner - Capital Preservation First",
            "📊 5 Market Regimes: Trend Day, Mean Reversion, Vol Breakout, Gamma Squeeze, Choppy Fakeout",
            "🚫 NO SCALPING: Rejects trades requiring <15 min hold time",
            "🚫 NO LOTTOS: Only ITM/ATM spreads and butterflies",
            "🔍 Fakeout Detection: Volume Delta + Dark Pool + Institutional flow validation",
            "📈 Trade Structures: Bull/Bear Verticals, Butterflies, Iron Condors",
            "⚠️ Divergence Warnings: Bull traps, bear traps, breadth lag",
            "🎯 Structural Invalidation: Price-based stops tied to GEX levels",
            "✅ 3-Part Output: Thesis → Execution → Flow Check"
        ]
    },
    {
        "version": "2.8.0",
        "date": "2026-02-13",
        "changes": [
            "🚨 Economic Events Warning Banner on 0-DTE Dashboard",
            "📅 Auto-detection of CPI, FOMC, NFP, Fed Speakers and other market-moving events",
            "📈 Expanded Trade Builder with 5 strategy types: Long Call, Long Put, Call Spread, Put Spread, Iron Condor",
            "🎯 Simplified single-leg option buying for directional 0-DTE trades",
            "⚙️ Added Settings page to navigation",
            "📊 Event-specific trading guidance and recommendations",
            "🔔 High-impact event warnings with detailed market implications"
        ]
    },
    {
        "version": "2.7.0",
        "date": "2026-02-13",
        "changes": [
            "⚡ NEW: Complete 0-DTE Trading Section (separate from IPMCC strategies)",
            "🏛️ 0-DTE Dashboard with live GEX analysis via Schwab API",
            "🎯 Iron Condor Trade Builder with GEX-aligned strike selection",
            "🛡️ Kill Switch Monitor for real-time risk management",
            "📖 Comprehensive 0-DTE Guide on institutional market mechanics",
            "📊 Live VIX and VIX1D data with term structure analysis",
            "⏰ Trading window indicators (optimal entry, danger zones)",
            "🧭 Updated navigation with sectioned menu"
        ]
    },
    {
        "version": "2.6.0",
        "date": "2026-02-12",
        "changes": [
            "🎯 Scanner now auto-runs on load with dynamic results",
            "📊 Added score filtering (70-100) to show only quality trades",
            "🔬 Trade Lab now includes comprehensive Trade Outcomes analysis",
            "📖 Fixed Guide page formatting (text alignment, removed extra bullets)",
            "📋 Reorganized Changelog with latest versions on top",
            "🔄 Moved Changelog beneath Guide in navigation menu"
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
    """Get application changelog - sorted by version (latest first)."""
    return {"changelog": CHANGELOG}
