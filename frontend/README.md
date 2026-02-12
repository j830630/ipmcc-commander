# IPMCC Commander - Frontend

Next.js 14 frontend for the Income PMCC Trading Journal.

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open http://localhost:3000

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **TanStack Query** - Data fetching and caching
- **Zustand** - State management
- **Recharts** - Charts and visualizations
- **Lucide Icons** - Icon set

## Project Structure

```
frontend/
├── app/                     # Next.js App Router pages
│   ├── layout.tsx           # Root layout with sidebar
│   ├── page.tsx             # Dashboard (home)
│   ├── positions/           # Journal pages
│   │   ├── page.tsx         # Position list
│   │   ├── new/page.tsx     # Create position
│   │   └── [id]/page.tsx    # Position detail
│   ├── trade-lab/           # Trade analysis
│   │   └── page.tsx
│   ├── guide/               # Strategy guide
│   │   └── page.tsx
│   └── settings/            # User settings
│       └── page.tsx
│
├── components/              # React components
│   ├── dashboard/           # Dashboard-specific
│   │   ├── greeks-cards.tsx
│   │   ├── income-velocity-card.tsx
│   │   ├── pnl-summary.tsx
│   │   ├── action-items.tsx
│   │   └── positions-table.tsx
│   ├── positions/           # Position-specific
│   ├── trade-lab/           # Trade Lab-specific
│   ├── sidebar.tsx          # Navigation sidebar
│   └── providers.tsx        # Context providers
│
├── lib/                     # Utilities and configuration
│   ├── api.ts               # API client functions
│   ├── store.ts             # Zustand stores
│   ├── types.ts             # TypeScript types
│   └── utils.ts             # Helper functions
│
├── public/                  # Static assets
│
├── tailwind.config.ts       # Tailwind configuration
├── tsconfig.json            # TypeScript configuration
└── package.json
```

## Pages

### Dashboard (`/`)
- Portfolio Greeks overview
- Income velocity tracker
- P&L summary cards
- Action items list
- Active positions table

### Positions (`/positions`)
- List all positions
- Filter by status (active/closed)
- Quick stats summary

### Position Detail (`/positions/[id]`)
- Full position information
- Cycle history table
- P&L chart
- Roll workflow
- Management actions

### New Position (`/positions/new`)
- Create new IPMCC position
- LEAP configuration
- Optional first cycle

### Trade Lab (`/trade-lab`)
- Configure potential trades
- Validation scoring
- Greeks calculation
- Scenario analysis chart

### Guide (`/guide`)
- Strategy documentation
- Entry criteria
- Management rules
- Real-world examples
- Quick reference

### Settings (`/settings`)
- Default parameters
- Alert thresholds
- Display preferences

## API Integration

The frontend proxies API requests to the backend via Next.js rewrites:

```javascript
// next.config.js
async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: 'http://localhost:8000/api/:path*',
    },
  ]
}
```

### API Client (`lib/api.ts`)

```typescript
import { positionsAPI, cyclesAPI, marketAPI, analyzeAPI, dashboardAPI } from '@/lib/api';

// Fetch positions
const positions = await positionsAPI.list('active');

// Create position
const position = await positionsAPI.create({
  ticker: 'SPY',
  long_strike: 500,
  long_expiration: '2026-01-17',
  entry_date: '2025-09-04',
  entry_price: 143.50,
  quantity: 1
});

// Get market quote
const quote = await marketAPI.getQuote('SPY');

// Validate trade setup
const validation = await analyzeAPI.validate({
  ticker: 'SPY',
  long_strike: 500,
  long_expiration: '2026-01-17',
  short_strike: 600,
  short_expiration: '2025-09-12',
  quantity: 1
});
```

## State Management

### Zustand Stores (`lib/store.ts`)

```typescript
import { usePositionStore, useSettingsStore } from '@/lib/store';

// Position store
const { positions, activePosition, setActivePosition } = usePositionStore();

// Settings store
const { settings, updateSettings } = useSettingsStore();
```

## Styling

Uses Tailwind CSS with a custom theme for financial data display.

### Key Classes

```css
/* Profit/Loss colors */
.text-profit { color: #3fb950; }
.text-loss { color: #f85149; }

/* Monospace numbers */
.tabular-nums { font-variant-numeric: tabular-nums; }

/* Cards */
.card { @apply bg-card rounded-lg border p-4; }
```

### Color Palette

```css
--profit: #3fb950;
--loss: #f85149;
--warning: #d29922;
--info: #58a6ff;
```

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Run production server
npm start

# Lint
npm run lint
```

## Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Type Safety

All API responses are typed in `lib/types.ts`:

```typescript
interface Position {
  id: string;
  ticker: string;
  long_strike: number;
  long_expiration: string;
  // ...
}

interface ShortCallCycle {
  id: string;
  position_id: string;
  cycle_number: number;
  // ...
}
```

## Data Fetching

Uses TanStack Query for data fetching with automatic caching and refetching:

```typescript
const { data, isLoading, error, refetch } = useQuery({
  queryKey: ['positions', 'active'],
  queryFn: () => positionsAPI.list('active'),
  refetchInterval: 60000, // Refetch every minute
});
```

## Building for Production

```bash
npm run build
npm start
```

For deployment to Vercel, just push to your repository and connect it in the Vercel dashboard.
