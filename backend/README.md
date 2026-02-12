# IPMCC Commander - Backend

FastAPI backend for the Income PMCC Trading Journal.

## Quick Start

```bash
# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # macOS/Linux
venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements.txt

# Run server
uvicorn app.main:app --reload --port 8000
```

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application entry point
│   ├── config.py            # Settings and configuration
│   ├── database.py          # Database connection and session
│   │
│   ├── models/              # SQLAlchemy ORM models
│   │   ├── position.py      # Position (LEAP) model
│   │   ├── cycle.py         # Short call cycle model
│   │   ├── snapshot.py      # Price snapshot model
│   │   └── settings.py      # User settings model
│   │
│   ├── schemas/             # Pydantic request/response schemas
│   │   ├── position.py      # Position schemas
│   │   ├── cycle.py         # Cycle schemas
│   │   └── analysis.py      # Analysis/validation schemas
│   │
│   ├── routers/             # API route handlers
│   │   ├── positions.py     # Position CRUD
│   │   ├── cycles.py        # Cycle CRUD + roll
│   │   ├── analyze.py       # Trade validation
│   │   ├── market.py        # Market data (yfinance)
│   │   └── dashboard.py     # Dashboard aggregations
│   │
│   └── services/            # Business logic
│       ├── market_data.py   # Yahoo Finance integration
│       ├── greeks_engine.py # Black-Scholes calculations
│       └── validation.py    # IPMCC rule validation
│
├── data/
│   └── ipmcc.db             # SQLite database (auto-created)
│
├── tests/
│   └── ...
│
└── requirements.txt
```

## Key Endpoints

### Positions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/positions` | List positions |
| POST | `/api/v1/positions` | Create position |
| GET | `/api/v1/positions/{id}` | Get position |
| PATCH | `/api/v1/positions/{id}` | Update position |
| POST | `/api/v1/positions/{id}/close` | Close position |
| DELETE | `/api/v1/positions/{id}` | Delete position |

### Cycles

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/cycles/position/{id}` | List cycles for position |
| POST | `/api/v1/cycles` | Create cycle |
| POST | `/api/v1/cycles/{id}/close` | Close cycle |
| POST | `/api/v1/cycles/{id}/roll` | Roll cycle |

### Analysis

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/analyze/validate` | Validate IPMCC setup |
| POST | `/api/v1/analyze/greeks` | Calculate option Greeks |
| POST | `/api/v1/analyze/ipmcc-greeks` | Calculate position Greeks |
| GET | `/api/v1/analyze/scenario/{ticker}` | Get P&L scenarios |

### Market Data

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/market/quote/{ticker}` | Stock quote |
| GET | `/api/v1/market/chain/{ticker}` | Options chain |
| GET | `/api/v1/market/expirations/{ticker}` | Available expirations |
| GET | `/api/v1/market/technicals/{ticker}` | Technical indicators |
| GET | `/api/v1/market/leaps/{ticker}` | LEAP options |
| GET | `/api/v1/market/weekly/{ticker}` | Weekly options |

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/dashboard/summary` | Full dashboard summary |
| GET | `/api/v1/dashboard/greeks` | Portfolio Greeks |
| GET | `/api/v1/dashboard/alerts` | Action items |
| GET | `/api/v1/dashboard/velocity` | Income velocity |

## Database

The app uses SQLite by default. The database file (`ipmcc.db`) is created automatically in the `data/` directory on first run.

### Tables

- **positions**: LEAP position records
- **short_call_cycles**: Weekly short call records
- **price_snapshots**: Historical value snapshots
- **user_settings**: User preferences

### Upgrading to PostgreSQL

1. Install psycopg2: `pip install psycopg2-binary asyncpg`
2. Update `DATABASE_URL` in `.env`:
   ```
   DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/dbname
   ```
3. Run migrations (if using Alembic) or let SQLAlchemy create tables

## Services

### Market Data Service (`market_data.py`)

Uses yfinance for free market data (15-20 minute delay).

```python
from app.services.market_data import market_data

# Get quote
quote = market_data.get_quote("SPY")

# Get options chain
chain = market_data.get_options_chain("SPY", "2025-01-17")

# Get technicals
technicals = market_data.get_technical_indicators("SPY")
```

### Greeks Engine (`greeks_engine.py`)

Uses mibian for Black-Scholes calculations.

```python
from app.services.greeks_engine import greeks_engine

# Calculate call Greeks
greeks = greeks_engine.calculate_call_greeks(
    stock_price=600,
    strike=550,
    days_to_expiry=180,
    volatility=25  # IV as percentage
)

# Calculate full IPMCC position
position = greeks_engine.calculate_ipmcc_position(
    stock_price=600,
    long_strike=500,
    long_dte=180,
    long_iv=25,
    short_strike=600,
    short_dte=7,
    short_iv=20,
    quantity=1
)
```

### Validation Engine (`validation_engine.py`)

Validates trades against IPMCC strategy rules.

```python
from app.services.validation_engine import validation_engine

result = validation_engine.validate_setup(
    ticker="SPY",
    long_strike=500,
    long_expiration="2026-01-17",
    short_strike=600,
    short_expiration="2025-09-12",
    quantity=1
)

print(f"Score: {result['score']}/100")
print(f"Valid: {result['valid']}")
```

## Environment Variables

Create a `.env` file in the backend directory:

```env
# Database
DATABASE_URL=sqlite+aiosqlite:///./data/ipmcc.db

# CORS (comma-separated origins)
CORS_ORIGINS=["http://localhost:3000","http://127.0.0.1:3000"]

# Risk-free rate for Greeks (percentage)
RISK_FREE_RATE=5.0
```

## Testing

```bash
# Install test dependencies
pip install pytest pytest-asyncio

# Run tests
pytest
```

## Development

```bash
# Format code
black app/

# Lint
ruff check app/

# Type check
mypy app/
```
