'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { positionsAPI, marketAPI, cyclesAPI } from '@/lib/api';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Search, 
  Loader2, 
  AlertCircle,
  CheckCircle,
  Calendar,
  DollarSign,
  TrendingUp,
  Info
} from 'lucide-react';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

interface FormData {
  ticker: string;
  long_strike: number | '';
  long_expiration: string;
  entry_date: string;
  entry_price: number | '';
  entry_delta: number | '';
  quantity: number;
  notes: string;
  // Optional first cycle
  include_first_cycle: boolean;
  short_strike: number | '';
  short_expiration: string;
  short_premium: number | '';
  short_extrinsic: number | '';
}

export default function NewPositionPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState<FormData>({
    ticker: '',
    long_strike: '',
    long_expiration: '',
    entry_date: new Date().toISOString().split('T')[0],
    entry_price: '',
    entry_delta: 80,
    quantity: 1,
    notes: '',
    include_first_cycle: false,
    short_strike: '',
    short_expiration: '',
    short_premium: '',
    short_extrinsic: '',
  });
  
  const [tickerSearch, setTickerSearch] = useState('');
  const [tickerConfirmed, setTickerConfirmed] = useState(false);

  // Fetch quote when ticker is searched
  const { data: quote, isLoading: quoteLoading, error: quoteError } = useQuery({
    queryKey: ['quote', tickerSearch],
    queryFn: () => marketAPI.getQuote(tickerSearch),
    enabled: tickerSearch.length >= 1,
    retry: false,
  });

  // Fetch LEAP expirations when ticker confirmed
  const { data: leapData } = useQuery({
    queryKey: ['leaps', formData.ticker],
    queryFn: () => marketAPI.getLeapOptions(formData.ticker),
    enabled: tickerConfirmed && formData.ticker.length >= 1,
  });

  // Fetch weekly expirations for short calls
  const { data: weeklyData } = useQuery({
    queryKey: ['weekly', formData.ticker],
    queryFn: () => marketAPI.getWeeklyOptions(formData.ticker),
    enabled: tickerConfirmed && formData.include_first_cycle,
  });

  // Create position mutation
  const createPositionMutation = useMutation({
    mutationFn: async () => {
      // Create position
      const position = await positionsAPI.create({
        ticker: formData.ticker.toUpperCase(),
        long_strike: Number(formData.long_strike),
        long_expiration: formData.long_expiration,
        entry_date: formData.entry_date,
        entry_price: Number(formData.entry_price),
        entry_delta: formData.entry_delta ? Number(formData.entry_delta) : undefined,
        quantity: formData.quantity,
        notes: formData.notes || undefined,
      });

      // Create first cycle if included
      if (formData.include_first_cycle && formData.short_strike && formData.short_expiration && formData.short_premium) {
        await cyclesAPI.create({
          position_id: position.id,
          short_strike: Number(formData.short_strike),
          short_expiration: formData.short_expiration,
          entry_date: formData.entry_date,
          entry_premium: Number(formData.short_premium),
          entry_extrinsic: Number(formData.short_extrinsic || formData.short_premium),
          stock_price_at_entry: quote?.price,
        });
      }

      return position;
    },
    onSuccess: (position) => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      router.push(`/positions/${position.id}`);
    },
  });

  const handleTickerSearch = () => {
    if (tickerSearch.trim()) {
      setTickerSearch(tickerSearch.trim().toUpperCase());
    }
  };

  const confirmTicker = () => {
    if (quote && !quoteError) {
      setFormData(prev => ({ ...prev, ticker: tickerSearch.toUpperCase() }));
      setTickerConfirmed(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createPositionMutation.mutate();
  };

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isFormValid = 
    formData.ticker &&
    formData.long_strike &&
    formData.long_expiration &&
    formData.entry_date &&
    formData.entry_price &&
    (!formData.include_first_cycle || (
      formData.short_strike &&
      formData.short_expiration &&
      formData.short_premium
    ));

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Back link */}
      <Link 
        href="/positions" 
        className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Positions
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">New IPMCC Position</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Add a new Income Poor Man's Covered Call position to your journal
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Ticker Selection */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            1. Select Underlying
          </h2>
          
          {!tickerConfirmed ? (
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                  <input
                    type="text"
                    placeholder="Enter ticker (e.g., SPY, TSLA, QQQ)"
                    value={tickerSearch}
                    onChange={(e) => setTickerSearch(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleTickerSearch())}
                    className="input pl-10 w-full"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleTickerSearch}
                  className="btn-secondary"
                  disabled={!tickerSearch.trim()}
                >
                  {quoteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                </button>
              </div>

              {quoteError && (
                <div className="flex items-center gap-2 text-sm text-[var(--loss)]">
                  <AlertCircle className="w-4 h-4" />
                  Unable to find ticker. Check the symbol and try again.
                </div>
              )}

              {quote && !quoteError && (
                <div className="p-4 bg-[var(--surface)] rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-[var(--text-primary)]">
                        {quote.ticker}
                      </h3>
                      <p className="text-sm text-[var(--text-secondary)]">{quote.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-mono font-semibold">${quote.price?.toFixed(2)}</p>
                      <p className={cn(
                        "text-sm font-mono",
                        (quote.change || 0) >= 0 ? "text-[var(--profit)]" : "text-[var(--loss)]"
                      )}>
                        {(quote.change || 0) >= 0 ? '+' : ''}{quote.change?.toFixed(2)} ({quote.change_percent?.toFixed(2)}%)
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={confirmTicker}
                    className="btn-primary w-full mt-4"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Use {quote.ticker}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-[var(--surface)] rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-[var(--profit)]" />
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">{formData.ticker}</p>
                  <p className="text-sm text-[var(--text-secondary)]">{quote?.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTickerConfirmed(false);
                  setTickerSearch('');
                  setFormData(prev => ({ ...prev, ticker: '' }));
                }}
                className="text-sm text-[var(--info)] hover:underline"
              >
                Change
              </button>
            </div>
          )}
        </div>

        {/* Step 2: LEAP Configuration */}
        {tickerConfirmed && (
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
              2. Long LEAP Call Configuration
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Expiration Date *
                </label>
                <select
                  value={formData.long_expiration}
                  onChange={(e) => updateField('long_expiration', e.target.value)}
                  className="input w-full"
                  required
                >
                  <option value="">Select expiration...</option>
                  {leapData?.leap_expirations?.map(exp => (
                    <option key={exp} value={exp}>
                      {formatDate(exp, 'MMMM d, yyyy')} ({Math.ceil((new Date(exp).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} DTE)
                    </option>
                  ))}
                </select>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Recommended: 180-600 DTE
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Strike Price *
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                  <input
                    type="number"
                    step="0.5"
                    value={formData.long_strike}
                    onChange={(e) => updateField('long_strike', e.target.value ? Number(e.target.value) : '')}
                    className="input pl-8 w-full"
                    placeholder="e.g., 480"
                    required
                  />
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Target: 70-90 delta (deep ITM)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Entry Price (per share) *
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                  <input
                    type="number"
                    step="0.01"
                    value={formData.entry_price}
                    onChange={(e) => updateField('entry_price', e.target.value ? Number(e.target.value) : '')}
                    className="input pl-8 w-full"
                    placeholder="e.g., 143.50"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Entry Delta
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={formData.entry_delta}
                  onChange={(e) => updateField('entry_delta', e.target.value ? Number(e.target.value) : '')}
                  className="input w-full"
                  placeholder="e.g., 80"
                />
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Recommended: 80Δ
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Entry Date *
                </label>
                <input
                  type="date"
                  value={formData.entry_date}
                  onChange={(e) => updateField('entry_date', e.target.value)}
                  className="input w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Quantity (contracts)
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => updateField('quantity', Math.max(1, Number(e.target.value)))}
                  className="input w-full"
                />
              </div>
            </div>

            {/* Capital calculation */}
            {formData.entry_price && (
              <div className="mt-4 p-3 bg-[var(--surface)] rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <Info className="w-4 h-4 text-[var(--info)]" />
                  <span className="text-[var(--text-secondary)]">Capital Required:</span>
                  <span className="font-mono font-semibold">
                    {formatCurrency(Number(formData.entry_price) * 100 * formData.quantity)}
                  </span>
                </div>
              </div>
            )}

            <div className="mt-4">
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                className="input w-full h-20 resize-none"
                placeholder="Entry reasoning, market conditions, etc."
              />
            </div>
          </div>
        )}

        {/* Step 3: Optional First Cycle */}
        {tickerConfirmed && (
          <div className="card p-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.include_first_cycle}
                onChange={(e) => updateField('include_first_cycle', e.target.checked)}
                className="w-5 h-5 rounded border-[var(--border)] bg-[var(--surface)]"
              />
              <div>
                <span className="font-semibold text-[var(--text-primary)]">
                  Add First Short Call Cycle
                </span>
                <p className="text-sm text-[var(--text-secondary)]">
                  Optionally add your first short call now
                </p>
              </div>
            </label>

            {formData.include_first_cycle && (
              <div className="mt-4 pt-4 border-t border-[var(--border)] grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    Short Call Expiration *
                  </label>
                  <select
                    value={formData.short_expiration}
                    onChange={(e) => updateField('short_expiration', e.target.value)}
                    className="input w-full"
                    required={formData.include_first_cycle}
                  >
                    <option value="">Select expiration...</option>
                    {weeklyData?.weekly_expirations?.map(exp => (
                      <option key={exp} value={exp}>
                        {formatDate(exp, 'MMM d, yyyy')} ({Math.ceil((new Date(exp).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} DTE)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    Short Strike *
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                    <input
                      type="number"
                      step="0.5"
                      value={formData.short_strike}
                      onChange={(e) => updateField('short_strike', e.target.value ? Number(e.target.value) : '')}
                      className="input pl-8 w-full"
                      placeholder={`ATM: ~${quote?.price?.toFixed(0) || '—'}`}
                      required={formData.include_first_cycle}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    Premium Received *
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                    <input
                      type="number"
                      step="0.01"
                      value={formData.short_premium}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : '';
                        updateField('short_premium', val);
                        // Auto-fill extrinsic if ATM
                        if (val && !formData.short_extrinsic) {
                          updateField('short_extrinsic', val);
                        }
                      }}
                      className="input pl-8 w-full"
                      placeholder="e.g., 4.85"
                      required={formData.include_first_cycle}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    Extrinsic Value
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                    <input
                      type="number"
                      step="0.01"
                      value={formData.short_extrinsic}
                      onChange={(e) => updateField('short_extrinsic', e.target.value ? Number(e.target.value) : '')}
                      className="input pl-8 w-full"
                      placeholder="Usually same as premium for ATM"
                    />
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    For ATM calls, extrinsic ≈ total premium
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Submit */}
        {tickerConfirmed && (
          <div className="flex items-center justify-end gap-4">
            <Link href="/positions" className="btn-ghost">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={!isFormValid || createPositionMutation.isPending}
              className="btn-primary"
            >
              {createPositionMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Create Position
                </>
              )}
            </button>
          </div>
        )}

        {createPositionMutation.error && (
          <div className="p-4 bg-[var(--loss)]/10 border border-[var(--loss)]/30 rounded-lg">
            <div className="flex items-center gap-2 text-[var(--loss)]">
              <AlertCircle className="w-5 h-5" />
              <span>Failed to create position. Please try again.</span>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
