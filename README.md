# IPMCC Commander

**Income Poor Man's Covered Call Trading Journal & Analysis**

A specialized trading journal for the Income PMCC options strategy, featuring position tracking, cycle management, Greeks calculation, trade validation, **market sentiment dashboard**, **strategy scanner**, **economic calendar**, **Schwab API integration**, and **real-time risk monitoring**.

![IPMCC Commander](https://img.shields.io/badge/version-2.1.0-blue) ![License](https://img.shields.io/badge/license-MIT-green)

---

## 🎯 What is Income PMCC?

The Income Poor Man's Covered Call is a cash-flow-first options strategy that prioritizes weekly extrinsic value collection over capital appreciation. Unlike standard PMCCs that sell OTM calls, Income PMCC sells **ATM/ITM calls** to maximize weekly premium.

**The Mantra:** *"Extrinsic Value, Over Time"*

---

## ✨ Features

### 🔐 Schwab API Integration (NEW in v2.1!)
- **Real-time Market Data**: Live quotes and option chains with Greeks
- **Account Sync**: Pull positions directly from your Schwab account
- **Trade Execution**: Place, modify, cancel orders from the app
- **OAuth2 Authentication**: Secure, token-based connection

### ⚠️ Risk Monitor (NEW in v2.1!)
- **Assignment Risk Alerts**: Warning when short calls approach ITM
- **Roll Trigger Alerts**: Notifications when DTE < 7 or Delta > 0.70
- **Portfolio Beta-Delta**: See your SPY-equivalent market exposure
- **Profit/Stop Alerts**: Target and stop loss notifications
- **Expiration Warnings**: Never miss an expiring position

### ✅ Input Validation (NEW in v2.1!)
- **IPMCC Structure Rules**: Enforces Long Strike < Short Strike
- **DTE Validation**: Ensures LEAP >= 180 days, Short 3-21 days
- **Delta Constraints**: Validates 70-90 delta for LEAPs
- **Error Messages**: Clear explanations of validation failures

### 💾 Intelligent Caching (NEW in v2.1!)
- **API Rate Protection**: 60s cache for option chains, 30s for quotes
- **Cache Statistics**: Monitor hit rate and performance
- **Manual Flush**: Clear specific namespaces or all cached data

### 📊 Dashboard
- **Strategy Command Center**: Quick-access cards for IPMCC, 112 Trades, Strangles, Credit Spreads
- **Market Sentiment**: Fear/Greed Index, VIX, AUD/JPY, DXY - all live indicators
- **TradingView Charts**: Embedded interactive charts with ticker selection
- **Market Indices**: SPY, QQQ, DIA, IWM with real-time changes
- **Portfolio Greeks**: Net delta, total theta, total vega at a glance

### 🔍 Strategy Scanner
- **IPMCC Scanner**: Find stocks suitable for Income PMCC strategy
- **112 Trade Scanner**: Identify 1:1:2 put ratio spread setups
- **Strangle Scanner**: Locate neutral high-IV opportunities
- **Custom Watchlists**: Large cap, high IV, ETFs, or custom symbols
- **Score-based Results**: See validation scores and detailed checks

### 📅 Economic Calendar
- **ForexFactory-style Interface**: Daily economic events with impact ratings
- **High-Impact Filter**: Focus on market-moving events (NFP, FOMC, CPI)
- **Country Filter**: US, EU, UK, Japan, Australia, Canada
- **TradingView Widget**: Alternative calendar view option

### 🧪 Trade Lab
- **Setup Validation**: Score trades 0-100 based on strategy rules
- **Manual Price Input**: Enter actual market prices for accurate metrics
- **Greeks Calculator**: Black-Scholes pricing and Greeks
- **Scenario Analysis**: P&L chart at different stock prices
- **Entry Criteria Check**: Weekly trend, RSI, support levels

### 📝 Trade Journal
- **Position Tracking**: LEAP details with current value and Greeks
- **Cycle Management**: Track 1-to-many short call cycles per position
- **True P&L**: Shows (LEAP P&L) + (Cumulative Short Call P&L)
- **Roll Workflow**: Streamlined close-and-open for weekly rolls

### 📖 Changelog
- Track all application updates
- View upcoming features
- Version history with detailed changes

---

## 🛠️ Tech Stack

### Backend
- **FastAPI** (Python 3.11+) — REST API
- **SQLite** — Local database (upgradeable to PostgreSQL)
- **SQLAlchemy 2.0** — Async ORM
- **Schwab API** — Real-time data and trading
- **yfinance** — Free market data fallback
- **httpx** — Async HTTP client

### Frontend
- **Next.js 14** — React framework with App Router
- **Tailwind CSS** — Utility-first styling
- **shadcn/ui** — Component primitives
- **TanStack Query** — Data fetching and caching
- **Recharts** — Financial charts

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- npm or yarn

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/ipmcc-commander.git
cd ipmcc-commander
```

### 2. Start the Backend
```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate it
source venv/bin/activate  # macOS/Linux
# OR
venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`
- Swagger docs: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### 3. Start the Frontend
```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

The app will be available at `http://localhost:3000`

---

## 📁 Project Structure

```
ipmcc-commander/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry point
│   │   ├── config.py            # Settings
│   │   ├── database.py          # SQLite connection
│   │   ├── models/              # SQLAlchemy models
│   │   ├── schemas/             # Pydantic schemas
│   │   ├── routers/             # API endpoints
│   │   └── services/            # Business logic
│   │       ├── market_data.py   # yfinance integration
│   │       ├── greeks_engine.py # Black-Scholes
│   │       └── validation.py    # Strategy rules
│   ├── data/
│   │   └── ipmcc.db             # SQLite database
│   └── requirements.txt
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx             # Dashboard
│   │   ├── positions/           # Journal pages
│   │   ├── trade-lab/           # Analysis tool
│   │   ├── guide/               # Documentation
│   │   └── settings/            # Preferences
│   ├── components/              # React components
│   ├── lib/
│   │   ├── api.ts               # API client
│   │   ├── store.ts             # Zustand store
│   │   ├── types.ts             # TypeScript types
│   │   └── utils.ts             # Helpers
│   └── package.json
│
└── README.md
```

---

## 🔧 Configuration

### Environment Variables

Create `.env` files in backend and frontend directories:

**backend/.env**
```env
DATABASE_URL=sqlite+aiosqlite:///./data/ipmcc.db
CORS_ORIGINS=["http://localhost:3000"]
```

**frontend/.env.local**
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Default Settings
- Default long delta: 80
- Default short DTE: 7 days
- Roll alert threshold: 20% extrinsic remaining
- Emergency exit threshold: 30% loss
- Profit target: 50% gain

---

## 📊 API Endpoints

### Positions
- `GET /api/v1/positions` — List all positions
- `POST /api/v1/positions` — Create position
- `GET /api/v1/positions/{id}` — Get position details
- `PATCH /api/v1/positions/{id}` — Update position
- `POST /api/v1/positions/{id}/close` — Close position

### Cycles
- `GET /api/v1/cycles/position/{id}` — List cycles for position
- `POST /api/v1/cycles` — Create cycle
- `POST /api/v1/cycles/{id}/close` — Close cycle
- `POST /api/v1/cycles/{id}/roll` — Roll to new cycle

### Analysis
- `POST /api/v1/analyze/validate` — Validate IPMCC setup
- `POST /api/v1/analyze/greeks` — Calculate Greeks
- `GET /api/v1/analyze/112-trade/{ticker}` — Calculate 112 Trade setup

### Market Data
- `GET /api/v1/market/quote/{ticker}` — Get stock quote
- `GET /api/v1/market/chain/{ticker}` — Get options chain
- `GET /api/v1/market/technicals/{ticker}` — Get technical indicators

### Sentiment (NEW in v2.0!)
- `GET /api/v1/sentiment/fear-greed` — CNN Fear & Greed Index
- `GET /api/v1/sentiment/vix` — VIX data and interpretation
- `GET /api/v1/sentiment/forex/{pair}` — Forex pairs (AUDJPY, AUDUSD, DXY)
- `GET /api/v1/sentiment/indices` — Market indices (SPY, QQQ, DIA, IWM)
- `GET /api/v1/sentiment/all` — All sentiment indicators combined

### Economic Calendar (NEW in v2.0!)
- `GET /api/v1/calendar/events` — Economic calendar events
- `GET /api/v1/calendar/today` — Today's events
- `GET /api/v1/calendar/high-impact` — High-impact events only

### Scanner (NEW in v2.0!)
- `GET /api/v1/scanner/ipmcc` — Scan for IPMCC setups
- `GET /api/v1/scanner/112-trade` — Scan for 112 Trade setups
- `GET /api/v1/scanner/strangles` — Scan for strangle setups
- `GET /api/v1/scanner/watchlists` — Get available watchlists

### Info
- `GET /api/v1/changelog` — Application changelog
- `GET /api/v1/dashboard/summary` — Dashboard data

---

## 🎨 Screenshots

*Coming soon*

---

## 🗺️ Roadmap

### v1.0 ✅
- ✅ Position and cycle tracking
- ✅ True P&L calculation
- ✅ Trade validation engine
- ✅ Greeks calculation
- ✅ Dashboard with action items

### v2.0 (Current) ✅
- ✅ Market Sentiment Dashboard (Fear/Greed, VIX, Forex)
- ✅ Economic Calendar (ForexFactory-style)
- ✅ Strategy Scanner (IPMCC, 112 Trade, Strangles)
- ✅ TradingView chart integration
- ✅ Strategy Command Center
- ✅ Changelog page
- ✅ Free data API integrations (Yahoo Finance, Finnhub, CNN)

### v2.1 (Planned)
- [ ] TICK/TRIN integration (requires IBKR)
- [ ] Earnings calendar integration
- [ ] Position alerts via email/webhook
- [ ] CSV export for tax reporting
- [ ] P&L charts over time

### v3.0 (Future)
- [ ] Brokerage integration (Alpaca, TD Ameritrade)
- [ ] Real-time options data
- [ ] Automated roll suggestions
- [ ] Multi-user with authentication
- [ ] Mobile-responsive design

---

## 📝 Strategy Rules (Built-in)

### Entry Criteria
- Weekly chart uptrend (21 EMA > 50 EMA)
- Daily RSI < 50 or reversing from oversold
- Price at support level
- Long: 70-90 delta, 180+ DTE
- Short: ATM, 7 DTE

### Management
- Roll when extrinsic < 20% remaining
- Emergency exit if loss > 30%
- Close at 50%+ profit
- Exit when LEAP < 60 DTE

---

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

---

## 📄 License

MIT License — see LICENSE file for details.

---

## 🙏 Acknowledgments

Strategy concepts derived from public educational content about Income PMCC options strategies.

---

**Built with ❤️ for options traders who prioritize income over speculation.**
