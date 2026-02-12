'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { marketAPI, analyzeAPI } from '@/lib/api';
import { 
  Search, 
  Loader2, 
  AlertCircle,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Calculator,
  Save,
  RefreshCw,
  Info
} from 'lucide-react';
import { formatCurrency, formatPercent, cn } from '@/lib/utils';

interface AnalysisConfig {
  ticker: string;
  long_strike: number;
  long_expiration: string;
  short_strike: number;
  short_expiration: string;
  quantity: number;
}

// Validation score display
function ValidationScore({ score, checks, warnings }: {
  score: number;
  checks: Array<{ name: string; passed: boolean; message: string }>;
  warnings: string[];
}) {
  const getScoreColor = () => {
    if (score >= 80) return 'text-[var(--profit)]';
    if (score >= 60) return 'text-[var(--warning)]';
    return 'text-[var(--loss)]';
  };

  const getScoreBg = () => {
    if (score >= 80) return 'bg-[var(--profit)]/20';
    if (score >= 60) return 'bg-[var(--warning)]/20';
    return 'bg-[var(--loss)]/20';
  };

  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Validation Score</h3>
      
      {/* Score display */}
      <div className={cn("text-center p-6 rounded-xl mb-6", getScoreBg())}>
        <div className={cn("text-5xl font-bold", getScoreColor())}>
          {score}
        </div>
        <div className="text-sm text-[var(--text-secondary)] mt-1">out of 100</div>
        <div className="mt-2">
          {score >= 80 ? (
            <span className="inline-flex items-center gap-1 text-[var(--profit)]">
              <CheckCircle className="w-4 h-4" /> Strong Setup
            </span>
          ) : score >= 60 ? (
            <span className="inline-flex items-center gap-1 text-[var(--warning)]">
              <AlertTriangle className="w-4 h-4" /> Acceptable
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[var(--loss)]">
              <XCircle className="w-4 h-4" /> Needs Review
            </span>
          )}
        </div>
      </div>

      {/* Checks list */}
      <div className="space-y-2 mb-4">
        {checks.map((check, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            {check.passed ? (
              <CheckCircle className="w-4 h-4 text-[var(--profit)] flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-4 h-4 text-[var(--loss)] flex-shrink-0 mt-0.5" />
            )}
            <span className={check.passed ? "text-[var(--text-primary)]" : "text-[var(--loss)]"}>
              {check.message}
            </span>
          </div>
        ))}
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="pt-4 border-t border-[var(--border)]">
          <h4 className="text-sm font-medium text-[var(--warning)] mb-2">Warnings</h4>
          <ul className="space-y-1">
            {warnings.map((warning, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                <AlertTriangle className="w-4 h-4 text-[var(--warning)] flex-shrink-0 mt-0.5" />
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Metrics display
function MetricsDisplay({ metrics }: { metrics: any }) {
  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Calculated Metrics</h3>
      
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-[var(--surface)] rounded-lg">
            <p className="text-xs text-[var(--text-secondary)] uppercase">Capital Required</p>
            <p className="text-lg font-mono font-semibold text-[var(--text-primary)]">
              {formatCurrency(metrics.capital_required)}
            </p>
          </div>
          <div className="p-3 bg-[var(--surface)] rounded-lg">
            <p className="text-xs text-[var(--text-secondary)] uppercase">Weekly Extrinsic</p>
            <p className="text-lg font-mono font-semibold text-[var(--profit)]">
              {formatCurrency(metrics.weekly_extrinsic)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-[var(--surface)] rounded-lg">
            <p className="text-xs text-[var(--text-secondary)] uppercase">Weeks to Payback</p>
            <p className="text-lg font-mono font-semibold">
              {metrics.weeks_to_breakeven?.toFixed(1) || '—'}
            </p>
          </div>
          <div className="p-3 bg-[var(--surface)] rounded-lg">
            <p className="text-xs text-[var(--text-secondary)] uppercase">Theoretical Annual ROI</p>
            <p className="text-lg font-mono font-semibold text-[var(--profit)]">
              {metrics.theoretical_annual_roi?.toFixed(0)}%
            </p>
          </div>
        </div>

        <hr className="border-[var(--border)]" />

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-secondary)]">Breakeven Price</span>
            <span className="font-mono">${metrics.breakeven_price?.toFixed(2) || '—'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-secondary)]">Max Weekly Profit</span>
            <span className="font-mono text-[var(--profit)]">{formatCurrency(metrics.weekly_extrinsic)} (capped)</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-secondary)]">Downside vs Stock</span>
            <span className="font-mono text-[var(--info)]">{metrics.downside_vs_stock_percent?.toFixed(0)}% less capital</span>
          </div>
        </div>

        <hr className="border-[var(--border)]" />

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-secondary)]">Net Theta</span>
            <span className="font-mono text-[var(--profit)]">+${metrics.net_theta?.toFixed(2) || '0'}/day</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-secondary)]">Net Delta</span>
            <span className="font-mono">+{metrics.net_delta?.toFixed(0) || '—'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-secondary)]">Extrinsic Yield</span>
            <span className="font-mono">{metrics.extrinsic_yield_percent?.toFixed(2)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TradeLabPageContent() {
  const searchParams = useSearchParams();
  const [ticker, setTicker] = useState('');
  const [tickerConfirmed, setTickerConfirmed] = useState(false);
  const [config, setConfig] = useState<Partial<AnalysisConfig>>({
    quantity: 1,
  });

  // Read ticker from URL parameter on mount
  useEffect(() => {
    const urlTicker = searchParams.get('ticker');
    if (urlTicker && urlTicker.trim()) {
      setTicker(urlTicker.trim().toUpperCase());
    }
  }, [searchParams]);

  // Fetch quote
  const { data: quote, isLoading: quoteLoading, error: quoteError } = useQuery({
    queryKey: ['quote', ticker],
    queryFn: () => marketAPI.getQuote(ticker),
    enabled: ticker.length >= 1,
  });

  // Auto-confirm ticker when loaded from URL and quote is available
  useEffect(() => {
    const urlTicker = searchParams.get('ticker');
    if (urlTicker && quote && !quoteError && !tickerConfirmed) {
      setTickerConfirmed(true);
      if (quote.price) {
        setConfig(prev => ({ 
          ...prev, 
          short_strike: Math.round(quote.price!) 
        }));
      }
    }
  }, [quote, quoteError, searchParams, tickerConfirmed]);

  // Fetch LEAP expirations
  const { data: leapData } = useQuery({
    queryKey: ['leaps', ticker],
    queryFn: () => marketAPI.getLeapOptions(ticker),
    enabled: tickerConfirmed,
  });

  // Fetch weekly expirations
  const { data: weeklyData } = useQuery({
    queryKey: ['weekly', ticker],
    queryFn: () => marketAPI.getWeeklyOptions(ticker),
    enabled: tickerConfirmed,
  });

  // Validation mutation
  const { data: validation, mutate: validate, isPending: validating } = useMutation({
    mutationFn: () => analyzeAPI.validate({
      ticker,
      long_strike: config.long_strike!,
      long_expiration: config.long_expiration!,
      short_strike: config.short_strike!,
      short_expiration: config.short_expiration!,
      quantity: config.quantity || 1,
    }),
  });

  const handleSearch = () => {
    if (ticker.trim()) {
      setTicker(ticker.trim().toUpperCase());
    }
  };

  const confirmTicker = () => {
    if (quote && !quoteError) {
      setTickerConfirmed(true);
      // Pre-set ATM short strike
      if (quote.price) {
        setConfig(prev => ({ 
          ...prev, 
          short_strike: Math.round(quote.price!) 
        }));
      }
    }
  };

  const canValidate = useMemo(() => {
    return config.long_strike && 
           config.long_expiration && 
           config.short_strike && 
           config.short_expiration;
  }, [config]);

  const handleValidate = () => {
    if (canValidate) {
      validate();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Trade Lab</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Analyze and validate IPMCC setups before entering trades
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ticker selection */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Underlying</h2>
            
            {!tickerConfirmed ? (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                    <input
                      type="text"
                      placeholder="Enter ticker symbol..."
                      value={ticker}
                      onChange={(e) => setTicker(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      className="input pl-10 w-full"
                    />
                  </div>
                  <button
                    onClick={handleSearch}
                    className="btn-secondary"
                    disabled={!ticker.trim() || quoteLoading}
                  >
                    {quoteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Fetch'}
                  </button>
                </div>

                {quoteError && (
                  <div className="flex items-center gap-2 text-sm text-[var(--loss)]">
                    <AlertCircle className="w-4 h-4" />
                    Ticker not found
                  </div>
                )}

                {quote && !quoteError && (
                  <div className="p-4 bg-[var(--surface)] rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-[var(--text-primary)]">{quote.ticker}</h3>
                        <p className="text-sm text-[var(--text-secondary)]">{quote.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-mono font-semibold">${quote.price?.toFixed(2)}</p>
                      </div>
                    </div>
                    <button onClick={confirmTicker} className="btn-primary w-full">
                      <Calculator className="w-4 h-4 mr-2" />
                      Analyze {quote.ticker}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 bg-[var(--surface)] rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[var(--info)]/20 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-[var(--info)]" />
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--text-primary)]">{ticker}</p>
                    <p className="text-sm text-[var(--text-secondary)]">${quote?.price?.toFixed(2)}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setTickerConfirmed(false);
                    setTicker('');
                    setConfig({ quantity: 1 });
                  }}
                  className="text-sm text-[var(--info)] hover:underline"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          {/* LEAP configuration */}
          {tickerConfirmed && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Long LEAP Call</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    Expiration
                  </label>
                  <select
                    value={config.long_expiration || ''}
                    onChange={(e) => setConfig(prev => ({ ...prev, long_expiration: e.target.value }))}
                    className="input w-full"
                  >
                    <option value="">Select expiration...</option>
                    {leapData?.leap_expirations?.map(exp => {
                      const dte = Math.ceil((new Date(exp).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                      return (
                        <option key={exp} value={exp}>
                          {exp} ({dte} DTE)
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    Strike Price
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={config.long_strike || ''}
                    onChange={(e) => setConfig(prev => ({ ...prev, long_strike: Number(e.target.value) }))}
                    className="input w-full"
                    placeholder={`Deep ITM (e.g., ${Math.round((quote?.price || 500) * 0.8)})`}
                  />
                  <p className="text-xs text-[var(--text-secondary)] mt-1">Target: 70-90 delta</p>
                </div>
              </div>
            </div>
          )}

          {/* Short call configuration */}
          {tickerConfirmed && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Short Call</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    Expiration
                  </label>
                  <select
                    value={config.short_expiration || ''}
                    onChange={(e) => setConfig(prev => ({ ...prev, short_expiration: e.target.value }))}
                    className="input w-full"
                  >
                    <option value="">Select expiration...</option>
                    {weeklyData?.weekly_expirations?.map(exp => {
                      const dte = Math.ceil((new Date(exp).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                      return (
                        <option key={exp} value={exp}>
                          {exp} ({dte} DTE)
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-[var(--text-secondary)]">
                      Strike Price
                    </label>
                    <div className="flex gap-1">
                      {['OTM', 'ATM', 'ITM'].map(type => (
                        <button
                          key={type}
                          onClick={() => {
                            if (!quote?.price) return;
                            let strike = quote.price;
                            if (type === 'OTM') strike = Math.ceil(quote.price * 1.02);
                            if (type === 'ITM') strike = Math.floor(quote.price * 0.98);
                            setConfig(prev => ({ ...prev, short_strike: Math.round(strike) }));
                          }}
                          className={cn(
                            "px-2 py-0.5 text-xs rounded transition-colors",
                            type === 'ATM' && Math.abs((config.short_strike || 0) - (quote?.price || 0)) < 2
                              ? "bg-[var(--info)] text-white"
                              : "bg-[var(--surface)] hover:bg-[var(--border)] text-[var(--text-secondary)]"
                          )}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="number"
                    step="1"
                    value={config.short_strike || ''}
                    onChange={(e) => setConfig(prev => ({ ...prev, short_strike: Number(e.target.value) }))}
                    className="input w-full"
                    placeholder={`ATM: ~${quote?.price?.toFixed(0)}`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={config.quantity || 1}
                    onChange={(e) => setConfig(prev => ({ ...prev, quantity: Math.max(1, Number(e.target.value)) }))}
                    className="input w-full"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Validate button */}
          {tickerConfirmed && (
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleValidate}
                disabled={!canValidate || validating}
                className="btn-primary px-8"
              >
                {validating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Calculator className="w-4 h-4 mr-2" />
                    Validate Setup
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Right column: Results */}
        <div className="space-y-6">
          {validation ? (
            <>
              <ValidationScore 
                score={validation.score}
                checks={validation.checks}
                warnings={validation.warnings}
              />
              <MetricsDisplay metrics={validation.metrics} />
              
              {/* Actions */}
              <div className="flex gap-2">
                <button className="btn-primary flex-1">
                  <Save className="w-4 h-4 mr-2" />
                  Add to Journal
                </button>
              </div>
            </>
          ) : (
            <div className="card p-6">
              <div className="text-center py-8">
                <Calculator className="w-12 h-12 mx-auto text-[var(--text-secondary)] mb-3" />
                <h3 className="text-lg font-medium text-[var(--text-primary)]">Ready to Analyze</h3>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  Configure your IPMCC setup and click "Validate Setup" to see analysis results
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TradeLabPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-[var(--text-secondary)]" />
      </div>
    }>
      <TradeLabPageContent />
    </Suspense>
  );
}
