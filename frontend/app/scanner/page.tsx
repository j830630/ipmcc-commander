'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Search, 
  TrendingUp, 
  Target, 
  GitBranch, 
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Filter,
  ChevronDown,
  ExternalLink,
  Plus
} from 'lucide-react';

type ScanType = 'ipmcc' | '112-trade' | 'strangles';

interface ScanResult {
  symbol: string;
  price: number;
  score: number;
  rsi?: number;
  trend?: string;
  weekly_trend?: string;
  iv?: number;
  support?: number;
  resistance?: number;
  checks: Array<{ name: string; passed: boolean; value?: any }>;
  leap_expirations?: Array<{ date: string; dte: number }>;
  weekly_expirations?: Array<{ date: string; dte: number }>;
  target_expiration?: { date: string; dte: number };
}

interface ScanResults {
  strategy: string;
  results: ScanResult[];
  total_scanned: number;
  matches_found: number;
  timestamp: string;
}

const SCAN_CONFIGS = {
  ipmcc: {
    name: 'IPMCC Scanner',
    description: 'Find stocks suitable for Income Poor Man\'s Covered Call strategy',
    icon: TrendingUp,
    criteria: [
      'Weekly uptrend (21 EMA > 50 EMA)',
      'RSI between 30-70',
      'LEAP options available (>180 DTE)',
      'Reasonable IV (>20%)',
      'Price near support preferred'
    ],
    endpoint: '/api/v1/scanner/ipmcc'
  },
  '112-trade': {
    name: '112 Trade Scanner',
    description: 'Find setups for 1:1:2 Put Ratio Spread strategy',
    icon: Target,
    criteria: [
      'Elevated IV (>35% ideal)',
      '14-21 DTE options available',
      'Clear support level identified',
      'RSI > 30 (not oversold)',
      'Price > $20 for decent spreads'
    ],
    endpoint: '/api/v1/scanner/112-trade'
  },
  strangles: {
    name: 'Strangle Scanner',
    description: 'Find neutral setups for Short Strangle strategy',
    icon: GitBranch,
    criteria: [
      'High IV (>30%)',
      'Neutral RSI (40-60)',
      '30-45 DTE options available',
      'Range-bound price action',
      'Liquid options market'
    ],
    endpoint: '/api/v1/scanner/strangles'
  }
};

const WATCHLISTS = {
  large_cap: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM', 'V', 'UNH'],
  high_iv: ['TSLA', 'NVDA', 'AMD', 'COIN', 'MARA', 'RIOT', 'PLTR', 'SOFI', 'RIVN', 'NIO'],
  etfs: ['SPY', 'QQQ', 'IWM', 'DIA', 'XLF', 'XLE', 'XLK', 'GLD', 'TLT', 'HYG']
};

function ResultCard({ result, scanType }: { result: ScanResult; scanType: ScanType }) {
  const [expanded, setExpanded] = useState(false);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-orange-500';
  };

  const getTrendColor = (trend?: string) => {
    if (trend === 'bullish') return 'text-green-500';
    if (trend === 'bearish') return 'text-red-500';
    return 'text-yellow-500';
  };

  return (
    <div className="card p-4 hover:border-primary/50 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h3 className="text-lg font-mono font-bold">{result.symbol}</h3>
            <p className="text-sm text-muted-foreground">${result.price.toFixed(2)}</p>
          </div>
          
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${getScoreColor(result.score)}`}>
              {result.score}
            </span>
            <span className="text-xs text-muted-foreground">/100</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {result.iv && (
            <div className="text-center">
              <p className="text-xs text-muted-foreground">IV</p>
              <p className="font-mono">{result.iv.toFixed(1)}%</p>
            </div>
          )}
          
          {result.rsi && (
            <div className="text-center">
              <p className="text-xs text-muted-foreground">RSI</p>
              <p className="font-mono">{result.rsi.toFixed(1)}</p>
            </div>
          )}
          
          {result.trend && (
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Trend</p>
              <p className={`font-medium capitalize ${getTrendColor(result.trend)}`}>
                {result.trend}
              </p>
            </div>
          )}

          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ChevronDown className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-border">
          {/* Checks */}
          <div className="mb-4">
            <h4 className="text-sm font-medium mb-2">Validation Checks</h4>
            <div className="grid grid-cols-2 gap-2">
              {result.checks.map((check, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {check.passed ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span className={check.passed ? 'text-foreground' : 'text-muted-foreground'}>
                    {check.name}
                    {check.value !== undefined && ` (${check.value})`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Support/Resistance */}
          {(result.support || result.resistance) && (
            <div className="mb-4">
              <h4 className="text-sm font-medium mb-2">Key Levels</h4>
              <div className="flex gap-4 text-sm">
                {result.support && (
                  <span>Support: <span className="font-mono text-green-500">${result.support}</span></span>
                )}
                {result.resistance && (
                  <span>Resistance: <span className="font-mono text-red-500">${result.resistance}</span></span>
                )}
              </div>
            </div>
          )}

          {/* Expirations */}
          {result.leap_expirations && result.leap_expirations.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium mb-2">LEAP Expirations</h4>
              <div className="flex gap-2 flex-wrap">
                {result.leap_expirations.map((exp, i) => (
                  <span key={i} className="px-2 py-1 bg-muted rounded text-xs font-mono">
                    {exp.date} ({exp.dte} DTE)
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.target_expiration && (
            <div className="mb-4">
              <h4 className="text-sm font-medium mb-2">Target Expiration</h4>
              <span className="px-2 py-1 bg-primary/20 text-primary rounded text-sm font-mono">
                {result.target_expiration.date} ({result.target_expiration.dte} DTE)
              </span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            <a 
              href={`/trade-lab?ticker=${result.symbol}`}
              className="btn-primary text-sm flex items-center gap-1"
            >
              Open in Trade Lab
              <ExternalLink className="w-3 h-3" />
            </a>
            <Link
              href={`/trades?action=new&ticker=${result.symbol}`}
              className="btn-secondary text-sm flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Log Trade
            </Link>
            <a
              href={`https://www.tradingview.com/symbols/${result.symbol}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-sm flex items-center gap-1"
            >
              TradingView
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ScannerPage() {
  const [activeScan, setActiveScan] = useState<ScanType>('ipmcc');
  const [results, setResults] = useState<ScanResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [customSymbols, setCustomSymbols] = useState('');
  const [selectedWatchlist, setSelectedWatchlist] = useState<string>('');

  const config = SCAN_CONFIGS[activeScan];

  const runScan = async () => {
    setLoading(true);
    setResults(null);

    try {
      let url = config.endpoint;
      
      // Add symbols if specified - clean up spaces and empty entries
      if (customSymbols.trim()) {
        const cleanedSymbols = customSymbols
          .split(/[,\s]+/)  // Split by comma or whitespace
          .map(s => s.trim().toUpperCase())
          .filter(s => s.length > 0)
          .join(',');
        if (cleanedSymbols) {
          url += `?symbols=${cleanedSymbols}`;
        }
      } else if (selectedWatchlist && WATCHLISTS[selectedWatchlist as keyof typeof WATCHLISTS]) {
        url += `?symbols=${WATCHLISTS[selectedWatchlist as keyof typeof WATCHLISTS].join(',')}`;
      }

      const response = await fetch(url);
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Scan error:', error);
    }

    setLoading(false);
  };

  const applyWatchlist = (watchlist: string) => {
    setSelectedWatchlist(watchlist);
    if (WATCHLISTS[watchlist as keyof typeof WATCHLISTS]) {
      setCustomSymbols(WATCHLISTS[watchlist as keyof typeof WATCHLISTS].join(', '));
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Search className="w-6 h-6 text-primary" />
          Strategy Scanner
        </h1>
        <p className="text-muted-foreground mt-1">
          Scan for setups matching your strategy criteria
        </p>
      </div>

      {/* Scan Type Selector */}
      <div className="flex gap-3">
        {(Object.entries(SCAN_CONFIGS) as [ScanType, typeof SCAN_CONFIGS[ScanType]][]).map(([key, cfg]) => {
          const Icon = cfg.icon;
          return (
            <button
              key={key}
              onClick={() => setActiveScan(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                activeScan === key
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {cfg.name.replace(' Scanner', '')}
            </button>
          );
        })}
      </div>

      {/* Scanner Config */}
      <div className="card p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              {(() => { const Icon = config.icon; return <Icon className="w-5 h-5 text-primary" />; })()}
              {config.name}
            </h2>
            <p className="text-sm text-muted-foreground">{config.description}</p>
          </div>
        </div>

        {/* Criteria */}
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Scan Criteria
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {config.criteria.map((criterion, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="w-3 h-3 text-green-500" />
                {criterion}
              </div>
            ))}
          </div>
        </div>

        {/* Watchlist Selection */}
        <div className="mb-4">
          <label className="text-sm font-medium mb-2 block">Quick Watchlists</label>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => applyWatchlist('large_cap')}
              className={`px-3 py-1 text-sm rounded-full border ${
                selectedWatchlist === 'large_cap' ? 'border-primary bg-primary/10' : 'border-border'
              }`}
            >
              Large Cap (10)
            </button>
            <button
              onClick={() => applyWatchlist('high_iv')}
              className={`px-3 py-1 text-sm rounded-full border ${
                selectedWatchlist === 'high_iv' ? 'border-primary bg-primary/10' : 'border-border'
              }`}
            >
              High IV (10)
            </button>
            <button
              onClick={() => applyWatchlist('etfs')}
              className={`px-3 py-1 text-sm rounded-full border ${
                selectedWatchlist === 'etfs' ? 'border-primary bg-primary/10' : 'border-border'
              }`}
            >
              ETFs (10)
            </button>
          </div>
        </div>

        {/* Custom Symbols */}
        <div className="mb-4">
          <label className="text-sm font-medium mb-2 block">Custom Symbols (comma-separated)</label>
          <input
            type="text"
            value={customSymbols}
            onChange={(e) => {
              setCustomSymbols(e.target.value.toUpperCase());
              setSelectedWatchlist('');
            }}
            placeholder="AAPL, MSFT, GOOGL, NVDA..."
            className="input w-full"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Leave empty to use default watchlist for this strategy
          </p>
        </div>

        {/* Run Button */}
        <button
          onClick={runScan}
          disabled={loading}
          className="btn-primary flex items-center gap-2"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              Run Scanner
            </>
          )}
        </button>
      </div>

      {/* Results */}
      {results && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              Results ({results.matches_found} of {results.total_scanned} matched)
            </h2>
            <span className="text-sm text-muted-foreground">
              {new Date(results.timestamp).toLocaleTimeString()}
            </span>
          </div>

          {results.results.length === 0 ? (
            <div className="card p-8 text-center">
              <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No matches found</h3>
              <p className="text-muted-foreground mt-2">
                Try adjusting your watchlist or check back later when market conditions change.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.results.map((result, i) => (
                <ResultCard key={i} result={result} scanType={activeScan} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
