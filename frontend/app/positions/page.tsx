'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Briefcase, History, Filter, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, DollarSign, Calendar, Target, AlertTriangle,
  CheckCircle, XCircle, RefreshCw, Plus, Edit, Trash2, Eye, Clock,
  Award, BarChart3, PieChart
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

type ViewMode = 'positions' | 'history' | 'analytics';
type PositionStatus = 'open' | 'closed' | 'rolled';
type Strategy = 'ipmcc' | '112' | 'strangle' | '0dte_vertical' | '0dte_butterfly' | '0dte_condor' | 'other';

interface Position {
  id: string;
  ticker: string;
  strategy: Strategy;
  strategyCategory: 'swing' | '0dte';
  status: PositionStatus;
  // Entry details
  entryDate: string;
  entryPrice: number;
  quantity: number;
  optionType: 'CALL' | 'PUT' | 'SPREAD' | 'COMBO';
  strike: number;
  expiration: string;
  // Current state
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
  delta: number | null;
  theta: number | null;
  // Exit details (if closed)
  exitDate: string | null;
  exitPrice: number | null;
  realizedPnL: number | null;
  // Metadata
  notes: string;
  followedRules: boolean | null;
  confidenceAtEntry: number | null;
}

interface Trade {
  id: string;
  date: string;
  ticker: string;
  strategy: Strategy;
  tradeType: 'open' | 'close' | 'roll' | 'adjust';
  optionType: string;
  strike: number;
  expiration: string;
  quantity: number;
  price: number;
  totalValue: number;
  fees: number;
  pnl: number | null;
  notes: string;
}

// ============================================================================
// MOCK DATA (Replace with API calls)
// ============================================================================

const MOCK_POSITIONS: Position[] = [
  {
    id: '1', ticker: 'AAPL', strategy: 'ipmcc', strategyCategory: 'swing', status: 'open',
    entryDate: '2026-02-10', entryPrice: 2.45, quantity: 2, optionType: 'CALL',
    strike: 245, expiration: '2026-03-21',
    currentPrice: 1.85, unrealizedPnL: -120, unrealizedPnLPct: -24.5,
    delta: 0.28, theta: -0.05,
    exitDate: null, exitPrice: null, realizedPnL: null,
    notes: 'Covered call on 200 shares', followedRules: true, confidenceAtEntry: 72
  },
  {
    id: '2', ticker: 'NVDA', strategy: '112', strategyCategory: 'swing', status: 'open',
    entryDate: '2026-02-12', entryPrice: 1.20, quantity: 1, optionType: 'SPREAD',
    strike: 880, expiration: '2026-03-14',
    currentPrice: 2.15, unrealizedPnL: 95, unrealizedPnLPct: 79.2,
    delta: 0.15, theta: -0.08,
    exitDate: null, exitPrice: null, realizedPnL: null,
    notes: 'Bullish 112 structure', followedRules: true, confidenceAtEntry: 68
  },
  {
    id: '3', ticker: 'SPY', strategy: 'strangle', strategyCategory: 'swing', status: 'open',
    entryDate: '2026-02-08', entryPrice: 4.80, quantity: 1, optionType: 'COMBO',
    strike: 580, expiration: '2026-03-07',
    currentPrice: 3.20, unrealizedPnL: 160, unrealizedPnLPct: 33.3,
    delta: 0.02, theta: -0.12,
    exitDate: null, exitPrice: null, realizedPnL: null,
    notes: 'Short strangle 530P/620C', followedRules: true, confidenceAtEntry: 75
  }
];

const MOCK_TRADES: Trade[] = [
  { id: '1', date: '2026-02-14', ticker: 'SPY', strategy: '0dte_vertical', tradeType: 'close', optionType: 'PUT SPREAD', strike: 585, expiration: '2026-02-14', quantity: 2, price: 0.35, totalValue: 70, fees: 1.30, pnl: 185, notes: 'Target hit' },
  { id: '2', date: '2026-02-13', ticker: 'QQQ', strategy: '0dte_butterfly', tradeType: 'close', optionType: 'CALL BFLY', strike: 520, expiration: '2026-02-13', quantity: 1, price: 2.80, totalValue: 280, fees: 2.60, pnl: -45, notes: 'Stopped out' },
  { id: '3', date: '2026-02-12', ticker: 'NVDA', strategy: '112', tradeType: 'open', optionType: 'CALL 112', strike: 880, expiration: '2026-03-14', quantity: 1, price: 1.20, totalValue: 120, fees: 1.95, pnl: null, notes: 'Bullish setup' },
  { id: '4', date: '2026-02-10', ticker: 'AAPL', strategy: 'ipmcc', tradeType: 'open', optionType: 'CALL', strike: 245, expiration: '2026-03-21', quantity: 2, price: 2.45, totalValue: 490, fees: 1.30, pnl: null, notes: 'Covered call' },
  { id: '5', date: '2026-02-08', ticker: 'SPY', strategy: 'strangle', tradeType: 'open', optionType: 'STRANGLE', strike: 580, expiration: '2026-03-07', quantity: 1, price: 4.80, totalValue: 480, fees: 2.60, pnl: null, notes: 'Short strangle' },
];

// ============================================================================
// COMPONENTS
// ============================================================================

function PositionCard({ position }: { position: Position }) {
  const strategyLabels: Record<Strategy, string> = {
    ipmcc: 'IPMCC', '112': '112 Trade', strangle: 'Strangle',
    '0dte_vertical': '0-DTE Vertical', '0dte_butterfly': '0-DTE Butterfly',
    '0dte_condor': '0-DTE Condor', other: 'Other'
  };
  
  const isProfitable = position.unrealizedPnL >= 0;
  const daysToExp = Math.ceil((new Date(position.expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  
  return (
    <div className="card p-4 hover:border-[var(--border-hover)] transition-colors">
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">{position.ticker}</span>
            <span className={`text-xs px-2 py-0.5 rounded ${
              position.strategyCategory === '0dte' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
            }`}>
              {strategyLabels[position.strategy]}
            </span>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            {position.optionType} {position.strike} • Exp {position.expiration}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-xl font-bold ${isProfitable ? 'text-emerald-500' : 'text-red-500'}`}>
            {isProfitable ? '+' : ''}{position.unrealizedPnL >= 0 ? '+' : ''}${position.unrealizedPnL.toFixed(0)}
          </p>
          <p className={`text-sm ${isProfitable ? 'text-emerald-400' : 'text-red-400'}`}>
            {position.unrealizedPnLPct >= 0 ? '+' : ''}{position.unrealizedPnLPct.toFixed(1)}%
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-4 gap-2 text-sm mb-3">
        <div>
          <p className="text-xs text-[var(--text-secondary)]">Entry</p>
          <p className="font-medium">${position.entryPrice.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-secondary)]">Current</p>
          <p className="font-medium">${position.currentPrice.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-secondary)]">Qty</p>
          <p className="font-medium">{position.quantity}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-secondary)]">DTE</p>
          <p className={`font-medium ${daysToExp <= 7 ? 'text-yellow-500' : ''}`}>{daysToExp}d</p>
        </div>
      </div>
      
      {/* Greeks */}
      {(position.delta || position.theta) && (
        <div className="flex gap-4 text-xs text-[var(--text-secondary)] mb-3">
          {position.delta && <span>Δ {position.delta.toFixed(2)}</span>}
          {position.theta && <span>Θ {position.theta.toFixed(2)}</span>}
        </div>
      )}
      
      {/* Footer */}
      <div className="flex justify-between items-center pt-3 border-t border-[var(--border)]">
        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <Calendar className="w-3 h-3" />
          Opened {position.entryDate}
        </div>
        <div className="flex gap-2">
          <button className="p-1.5 hover:bg-[var(--surface)] rounded"><Eye className="w-4 h-4" /></button>
          <button className="p-1.5 hover:bg-[var(--surface)] rounded"><Edit className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
}

function TradeRow({ trade }: { trade: Trade }) {
  const strategyLabels: Record<Strategy, string> = {
    ipmcc: 'IPMCC', '112': '112', strangle: 'Strangle',
    '0dte_vertical': '0DTE Vert', '0dte_butterfly': '0DTE Bfly',
    '0dte_condor': '0DTE IC', other: 'Other'
  };
  
  return (
    <tr className="border-b border-[var(--border)] hover:bg-[var(--surface)]">
      <td className="py-3 px-4 text-sm">{trade.date}</td>
      <td className="py-3 px-4 font-medium">{trade.ticker}</td>
      <td className="py-3 px-4">
        <span className={`text-xs px-2 py-0.5 rounded ${
          trade.strategy.startsWith('0dte') ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
        }`}>
          {strategyLabels[trade.strategy]}
        </span>
      </td>
      <td className="py-3 px-4 text-sm capitalize">{trade.tradeType}</td>
      <td className="py-3 px-4 text-sm">{trade.optionType}</td>
      <td className="py-3 px-4 text-sm">{trade.strike}</td>
      <td className="py-3 px-4 text-sm">{trade.quantity}</td>
      <td className="py-3 px-4 text-sm">${trade.price.toFixed(2)}</td>
      <td className="py-3 px-4">
        {trade.pnl !== null ? (
          <span className={`font-bold ${trade.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(0)}
          </span>
        ) : (
          <span className="text-[var(--text-secondary)]">-</span>
        )}
      </td>
    </tr>
  );
}

function AnalyticsView({ positions, trades }: { positions: Position[]; trades: Trade[] }) {
  const closedTrades = trades.filter(t => t.pnl !== null);
  const winners = closedTrades.filter(t => t.pnl! > 0);
  const losers = closedTrades.filter(t => t.pnl! < 0);
  
  const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const unrealizedPnL = positions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
  const avgWin = winners.length > 0 ? winners.reduce((sum, t) => sum + t.pnl!, 0) / winners.length : 0;
  const avgLoss = losers.length > 0 ? losers.reduce((sum, t) => sum + Math.abs(t.pnl!), 0) / losers.length : 0;
  
  const byStrategy: Record<string, { count: number; pnl: number }> = {};
  closedTrades.forEach(t => {
    if (!byStrategy[t.strategy]) byStrategy[t.strategy] = { count: 0, pnl: 0 };
    byStrategy[t.strategy].count++;
    byStrategy[t.strategy].pnl += t.pnl || 0;
  });
  
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-sm text-[var(--text-secondary)]">Realized P&L</p>
          <p className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(0)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-[var(--text-secondary)]">Unrealized P&L</p>
          <p className={`text-2xl font-bold ${unrealizedPnL >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {unrealizedPnL >= 0 ? '+' : ''}${unrealizedPnL.toFixed(0)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-[var(--text-secondary)]">Win Rate</p>
          <p className="text-2xl font-bold">
            {closedTrades.length > 0 ? Math.round(winners.length / closedTrades.length * 100) : 0}%
          </p>
          <p className="text-xs text-[var(--text-secondary)]">{winners.length}W / {losers.length}L</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-[var(--text-secondary)]">Profit Factor</p>
          <p className="text-2xl font-bold">
            {avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : 'N/A'}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">Avg ${avgWin.toFixed(0)} / -${avgLoss.toFixed(0)}</p>
        </div>
      </div>
      
      {/* By Strategy */}
      <div className="card p-4">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <PieChart className="w-4 h-4" />Performance by Strategy
        </h3>
        <div className="space-y-3">
          {Object.entries(byStrategy).map(([strategy, data]) => (
            <div key={strategy} className="flex items-center justify-between p-3 bg-[var(--surface)] rounded">
              <div>
                <p className="font-medium">{strategy.toUpperCase()}</p>
                <p className="text-xs text-[var(--text-secondary)]">{data.count} trades</p>
              </div>
              <p className={`font-bold ${data.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {data.pnl >= 0 ? '+' : ''}${data.pnl.toFixed(0)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function PositionsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('positions');
  const [positions, setPositions] = useState<Position[]>(MOCK_POSITIONS);
  const [trades, setTrades] = useState<Trade[]>(MOCK_TRADES);
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'swing' | '0dte'>('all');
  const [strategyFilter, setStrategyFilter] = useState<'all' | Strategy>('all');
  
  // Fetch positions
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch positions
      const posRes = await fetch('/api/v1/positions?status=open');
      if (posRes.ok) {
        const data = await posRes.json();
        if (data.positions) setPositions(data.positions);
      }
      
      // Fetch trades
      const tradesRes = await fetch('/api/v1/trades?limit=50');
      if (tradesRes.ok) {
        const data = await tradesRes.json();
        if (data.trades) setTrades(data.trades);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Filtered data
  const filteredPositions = positions.filter(p => {
    if (categoryFilter !== 'all' && p.strategyCategory !== categoryFilter) return false;
    if (strategyFilter !== 'all' && p.strategy !== strategyFilter) return false;
    return true;
  });
  
  const filteredTrades = trades.filter(t => {
    if (categoryFilter !== 'all') {
      const is0dte = t.strategy.startsWith('0dte');
      if (categoryFilter === '0dte' && !is0dte) return false;
      if (categoryFilter === 'swing' && is0dte) return false;
    }
    if (strategyFilter !== 'all' && t.strategy !== strategyFilter) return false;
    return true;
  });
  
  // Stats
  const openPositionsCount = positions.filter(p => p.status === 'open').length;
  const totalUnrealized = positions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
  
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <Link href="/" className="text-sm text-[var(--text-secondary)] hover:text-primary flex items-center gap-1 mb-2">
            <ArrowLeft className="w-4 h-4" />Dashboard
          </Link>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-primary" />
            Positions & Journal
          </h1>
        </div>
        <button onClick={fetchData} disabled={loading} className="btn flex items-center gap-2">
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh
        </button>
      </div>
      
      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-sm text-[var(--text-secondary)]">Open Positions</p>
          <p className="text-2xl font-bold">{openPositionsCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-[var(--text-secondary)]">Unrealized P&L</p>
          <p className={`text-2xl font-bold ${totalUnrealized >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {totalUnrealized >= 0 ? '+' : ''}${totalUnrealized.toFixed(0)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-[var(--text-secondary)]">Trades Today</p>
          <p className="text-2xl font-bold">{trades.filter(t => t.date === new Date().toISOString().split('T')[0]).length}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-[var(--text-secondary)]">Total Trades</p>
          <p className="text-2xl font-bold">{trades.length}</p>
        </div>
      </div>
      
      {/* View Mode Tabs */}
      <div className="flex gap-4 items-center">
        <div className="flex rounded-lg overflow-hidden border border-[var(--border)]">
          <button
            onClick={() => setViewMode('positions')}
            className={`px-4 py-2 flex items-center gap-2 ${viewMode === 'positions' ? 'bg-primary text-white' : ''}`}
          >
            <Briefcase className="w-4 h-4" />Open Positions
          </button>
          <button
            onClick={() => setViewMode('history')}
            className={`px-4 py-2 flex items-center gap-2 ${viewMode === 'history' ? 'bg-primary text-white' : ''}`}
          >
            <History className="w-4 h-4" />Trade History
          </button>
          <button
            onClick={() => setViewMode('analytics')}
            className={`px-4 py-2 flex items-center gap-2 ${viewMode === 'analytics' ? 'bg-primary text-white' : ''}`}
          >
            <BarChart3 className="w-4 h-4" />Analytics
          </button>
        </div>
        
        {/* Filters */}
        <div className="flex gap-2 ml-auto">
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value as any)} className="input text-sm">
            <option value="all">All Categories</option>
            <option value="swing">Swing (IPMCC/112/Strangle)</option>
            <option value="0dte">0-DTE</option>
          </select>
        </div>
      </div>
      
      {/* Content */}
      {viewMode === 'positions' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPositions.length > 0 ? (
            filteredPositions.map(p => <PositionCard key={p.id} position={p} />)
          ) : (
            <div className="col-span-full card p-8 text-center">
              <Briefcase className="w-12 h-12 mx-auto mb-4 text-[var(--text-secondary)] opacity-30" />
              <p className="text-[var(--text-secondary)]">No open positions</p>
            </div>
          )}
        </div>
      )}
      
      {viewMode === 'history' && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-[var(--surface)]">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium">Date</th>
                <th className="text-left py-3 px-4 text-sm font-medium">Ticker</th>
                <th className="text-left py-3 px-4 text-sm font-medium">Strategy</th>
                <th className="text-left py-3 px-4 text-sm font-medium">Type</th>
                <th className="text-left py-3 px-4 text-sm font-medium">Option</th>
                <th className="text-left py-3 px-4 text-sm font-medium">Strike</th>
                <th className="text-left py-3 px-4 text-sm font-medium">Qty</th>
                <th className="text-left py-3 px-4 text-sm font-medium">Price</th>
                <th className="text-left py-3 px-4 text-sm font-medium">P&L</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.map(t => <TradeRow key={t.id} trade={t} />)}
            </tbody>
          </table>
        </div>
      )}
      
      {viewMode === 'analytics' && (
        <AnalyticsView positions={positions} trades={trades} />
      )}
    </div>
  );
}
