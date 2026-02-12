'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  Plus, 
  History, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Calendar,
  X,
  Check,
  AlertCircle,
  RefreshCw,
  Filter,
  Trash2,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Trade {
  id: string;
  trade_type: string;
  ticker: string;
  trade_date: string;
  option_type: string;
  strike: number;
  expiration: string;
  quantity: number;
  price: number;
  total_value: number;
  fees: number;
  realized_pnl?: number;
  strategy: string;
  notes?: string;
  created_at: string;
}

interface TradeSummary {
  period_days: number;
  total_trades: number;
  total_credits: number;
  total_debits: number;
  net_cash_flow: number;
  total_fees: number;
}

const TRADE_TYPES = [
  { value: 'open_long', label: 'Buy to Open (Long)', isDebit: true },
  { value: 'close_long', label: 'Sell to Close (Long)', isDebit: false },
  { value: 'open_short', label: 'Sell to Open (Short)', isDebit: false },
  { value: 'close_short', label: 'Buy to Close (Short)', isDebit: true },
  { value: 'roll_short', label: 'Roll (Close + Open)', isDebit: false },
];

const STRATEGIES = [
  { value: 'ipmcc', label: 'Income PMCC' },
  { value: '112-trade', label: '112 Trade' },
  { value: 'strangle', label: 'Strangle' },
  { value: 'credit-spread', label: 'Credit Spread' },
  { value: 'wheel', label: 'Wheel' },
  { value: 'other', label: 'Other' },
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
};

// Trade form modal
interface InitialTradeValues {
  ticker?: string;
  trade_type?: string;
  strike?: string;
  expiration?: string;
  notes?: string;
}

function TradeFormModal({ 
  isOpen, 
  onClose, 
  onSubmit,
  initialValues
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSubmit: (trade: any) => Promise<void>;
  initialValues?: InitialTradeValues;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [form, setForm] = useState({
    trade_type: initialValues?.trade_type || 'open_short',
    ticker: initialValues?.ticker || '',
    trade_date: new Date().toISOString().slice(0, 10),
    option_type: 'CALL',
    strike: initialValues?.strike || '',
    expiration: initialValues?.expiration || '',
    quantity: '1',
    price: '',
    fees: '0.65',
    underlying_price: '',
    strategy: 'ipmcc',
    notes: initialValues?.notes || '',
  });

  useEffect(() => {
    if (initialValues) {
      setForm(f => ({ 
        ...f, 
        ticker: initialValues.ticker || f.ticker,
        trade_type: initialValues.trade_type || f.trade_type,
        strike: initialValues.strike || f.strike,
        expiration: initialValues.expiration || f.expiration,
        notes: initialValues.notes || f.notes,
      }));
    }
  }, [initialValues]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await onSubmit({
        ...form,
        strike: parseFloat(form.strike),
        quantity: parseInt(form.quantity),
        price: parseFloat(form.price),
        fees: parseFloat(form.fees),
        underlying_price: form.underlying_price ? parseFloat(form.underlying_price) : null,
      });
      onClose();
      // Reset form
      setForm({
        trade_type: 'open_short',
        ticker: '',
        trade_date: new Date().toISOString().slice(0, 10),
        option_type: 'CALL',
        strike: '',
        expiration: '',
        quantity: '1',
        price: '',
        fees: '0.65',
        underlying_price: '',
        strategy: 'ipmcc',
        notes: '',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to record trade');
    }

    setLoading(false);
  };

  if (!isOpen) return null;

  const selectedTradeType = TRADE_TYPES.find(t => t.value === form.trade_type);
  const isDebit = selectedTradeType?.isDebit ?? false;
  const totalValue = (parseFloat(form.price) || 0) * (parseInt(form.quantity) || 0) * 100;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-elevated)] rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Record Trade</h2>
          <button onClick={onClose} className="p-1 hover:bg-[var(--surface)] rounded">
            <X className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* Trade Type */}
          <div>
            <label className="text-sm font-medium text-[var(--text-secondary)] block mb-1">
              Trade Type
            </label>
            <select
              value={form.trade_type}
              onChange={(e) => setForm({ ...form, trade_type: e.target.value })}
              className="input w-full"
              required
            >
              {TRADE_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Ticker and Date row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)] block mb-1">
                Ticker
              </label>
              <input
                type="text"
                value={form.ticker}
                onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })}
                className="input w-full"
                placeholder="AAPL"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)] block mb-1">
                Trade Date
              </label>
              <input
                type="date"
                value={form.trade_date}
                onChange={(e) => setForm({ ...form, trade_date: e.target.value })}
                className="input w-full"
                required
              />
            </div>
          </div>

          {/* Option Type, Strike, Expiration */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)] block mb-1">
                Option Type
              </label>
              <select
                value={form.option_type}
                onChange={(e) => setForm({ ...form, option_type: e.target.value })}
                className="input w-full"
                required
              >
                <option value="CALL">Call</option>
                <option value="PUT">Put</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)] block mb-1">
                Strike Price
              </label>
              <input
                type="number"
                step="0.5"
                value={form.strike}
                onChange={(e) => setForm({ ...form, strike: e.target.value })}
                className="input w-full"
                placeholder="150.00"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)] block mb-1">
                Expiration
              </label>
              <input
                type="date"
                value={form.expiration}
                onChange={(e) => setForm({ ...form, expiration: e.target.value })}
                className="input w-full"
                required
              />
            </div>
          </div>

          {/* Quantity and Price */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)] block mb-1">
                Quantity
              </label>
              <input
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                className="input w-full"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)] block mb-1">
                Price (per share)
              </label>
              <input
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="input w-full"
                placeholder="2.50"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)] block mb-1">
                Fees
              </label>
              <input
                type="number"
                step="0.01"
                value={form.fees}
                onChange={(e) => setForm({ ...form, fees: e.target.value })}
                className="input w-full"
              />
            </div>
          </div>

          {/* Total Value Display */}
          <div className={cn(
            "p-4 rounded-lg text-center",
            isDebit ? "bg-red-500/10" : "bg-green-500/10"
          )}>
            <p className="text-sm text-[var(--text-secondary)]">
              {isDebit ? 'Total Debit' : 'Total Credit'}
            </p>
            <p className={cn(
              "text-2xl font-bold",
              isDebit ? "text-[var(--loss)]" : "text-[var(--profit)]"
            )}>
              {isDebit ? '-' : '+'}{formatCurrency(totalValue)}
            </p>
          </div>

          {/* Strategy and Underlying Price */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)] block mb-1">
                Strategy
              </label>
              <select
                value={form.strategy}
                onChange={(e) => setForm({ ...form, strategy: e.target.value })}
                className="input w-full"
              >
                {STRATEGIES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)] block mb-1">
                Underlying Price (optional)
              </label>
              <input
                type="number"
                step="0.01"
                value={form.underlying_price}
                onChange={(e) => setForm({ ...form, underlying_price: e.target.value })}
                className="input w-full"
                placeholder="155.50"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-[var(--text-secondary)] block mb-1">
              Notes (optional)
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input w-full"
              rows={2}
              placeholder="Weekly roll, rolled up from $145..."
            />
          </div>

          {/* Submit buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex items-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Record Trade
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Trade row component
function TradeRow({ trade, onDelete }: { trade: Trade; onDelete: (id: string) => void }) {
  const isDebit = trade.trade_type.includes('open_long') || trade.trade_type.includes('close_short');
  
  return (
    <div className="flex items-center justify-between p-3 bg-[var(--surface)] rounded-lg hover:bg-[var(--border)] transition-colors">
      <div className="flex items-center gap-4">
        <div className={cn(
          "p-2 rounded-lg",
          isDebit ? "bg-red-500/10" : "bg-green-500/10"
        )}>
          {isDebit ? (
            <ArrowDownRight className="w-4 h-4 text-[var(--loss)]" />
          ) : (
            <ArrowUpRight className="w-4 h-4 text-[var(--profit)]" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-[var(--text-primary)]">{trade.ticker}</span>
            <span className="text-sm text-[var(--text-secondary)]">
              ${trade.strike} {trade.option_type}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--surface)] text-[var(--text-secondary)]">
              {trade.trade_type.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-0.5">
            {trade.trade_date} • Exp: {trade.expiration} • {trade.quantity} contract(s)
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className={cn(
            "font-mono font-bold",
            isDebit ? "text-[var(--loss)]" : "text-[var(--profit)]"
          )}>
            {isDebit ? '-' : '+'}{formatCurrency(trade.total_value)}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            @ ${trade.price.toFixed(2)}/sh
          </p>
        </div>
        <button
          onClick={() => onDelete(trade.id)}
          className="p-1.5 hover:bg-red-500/10 rounded text-[var(--text-secondary)] hover:text-red-400 transition-colors"
          title="Delete trade"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function TradesPageContent() {
  const searchParams = useSearchParams();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [summary, setSummary] = useState<TradeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterTicker, setFilterTicker] = useState('');
  const [initialValues, setInitialValues] = useState<InitialTradeValues | undefined>(undefined);

  // Check for URL parameters (from roll suggestions or scanner)
  useEffect(() => {
    const action = searchParams.get('action');
    const ticker = searchParams.get('ticker');
    const strike = searchParams.get('strike');
    const expiration = searchParams.get('expiration');
    const type = searchParams.get('type');

    if (action === 'roll' && ticker) {
      setInitialValues({
        ticker: ticker.toUpperCase(),
        trade_type: type || 'roll_short',
        strike: strike || '',
        expiration: expiration || '',
        notes: `Rolled from previous position`,
      });
      setShowModal(true);
    } else if (action === 'new' && ticker) {
      // From scanner - just pre-fill ticker
      setInitialValues({
        ticker: ticker.toUpperCase(),
        trade_type: 'open_short',
      });
      setShowModal(true);
    }
  }, [searchParams]);

  const fetchTrades = async () => {
    setLoading(true);
    try {
      const [tradesRes, summaryRes] = await Promise.all([
        fetch(`/api/v1/trades?limit=100${filterTicker ? `&ticker=${filterTicker}` : ''}`),
        fetch('/api/v1/trades/summary/recent?days=30'),
      ]);
      
      const tradesData = await tradesRes.json();
      const summaryData = await summaryRes.json();
      
      setTrades(tradesData.trades || []);
      setSummary(summaryData);
    } catch (error) {
      console.error('Error fetching trades:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTrades();
  }, [filterTicker]);

  const handleSubmitTrade = async (trade: any) => {
    const response = await fetch('/api/v1/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trade),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to record trade');
    }
    
    fetchTrades();
  };

  const handleDeleteTrade = async (id: string) => {
    if (!confirm('Are you sure you want to delete this trade?')) return;
    
    try {
      await fetch(`/api/v1/trades/${id}`, { method: 'DELETE' });
      fetchTrades();
    } catch (error) {
      console.error('Error deleting trade:', error);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)] flex items-center gap-3">
            <History className="h-7 w-7 text-[var(--info)]" />
            Trade Journal
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Record and track all your option trades
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Record Trade
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="card p-4">
            <p className="text-sm text-[var(--text-secondary)]">Total Trades</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{summary.total_trades}</p>
            <p className="text-xs text-[var(--text-secondary)]">Last 30 days</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-[var(--text-secondary)]">Credits Received</p>
            <p className="text-2xl font-bold text-[var(--profit)]">{formatCurrency(summary.total_credits)}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-[var(--text-secondary)]">Debits Paid</p>
            <p className="text-2xl font-bold text-[var(--loss)]">{formatCurrency(summary.total_debits)}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-[var(--text-secondary)]">Fees</p>
            <p className="text-2xl font-bold text-[var(--text-secondary)]">{formatCurrency(summary.total_fees)}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-[var(--text-secondary)]">Net Cash Flow</p>
            <p className={cn(
              "text-2xl font-bold",
              summary.net_cash_flow >= 0 ? "text-[var(--profit)]" : "text-[var(--loss)]"
            )}>
              {formatCurrency(summary.net_cash_flow)}
            </p>
          </div>
        </div>
      )}

      {/* Filter and Trade List */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[var(--text-primary)]">Trade History</h3>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[var(--text-secondary)]" />
            <input
              type="text"
              placeholder="Filter by ticker..."
              value={filterTicker}
              onChange={(e) => setFilterTicker(e.target.value.toUpperCase())}
              className="input text-sm w-32"
            />
            <button
              onClick={fetchTrades}
              className="btn-secondary p-2"
              disabled={loading}
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[var(--text-secondary)]" />
            <p className="text-sm text-[var(--text-secondary)] mt-2">Loading trades...</p>
          </div>
        ) : trades.length === 0 ? (
          <div className="text-center py-12">
            <History className="w-12 h-12 mx-auto text-[var(--text-secondary)] opacity-50" />
            <p className="text-[var(--text-secondary)] mt-2">No trades recorded yet</p>
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary mt-4"
            >
              Record Your First Trade
            </button>
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {trades.map(trade => (
              <TradeRow key={trade.id} trade={trade} onDelete={handleDeleteTrade} />
            ))}
          </div>
        )}
      </div>

      {/* Trade Form Modal */}
      <TradeFormModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setInitialValues(undefined);
        }}
        onSubmit={handleSubmitTrade}
        initialValues={initialValues}
      />
    </div>
  );
}

export default function TradesPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-[var(--text-secondary)]" />
      </div>
    }>
      <TradesPageContent />
    </Suspense>
  );
}
