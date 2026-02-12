'use client';

import { useQuery } from '@tanstack/react-query';
import { positionsAPI } from '@/lib/api';
import { useState } from 'react';
import Link from 'next/link';
import { 
  Plus, 
  Search, 
  Filter,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  RefreshCw,
  LayoutGrid,
  List
} from 'lucide-react';
import { formatCurrency, formatPercent, formatDate, cn } from '@/lib/utils';
import { PositionSummary } from '@/lib/types';

// Tab button component
function TabButton({ 
  active, 
  onClick, 
  children, 
  count 
}: { 
  active: boolean; 
  onClick: () => void; 
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
        active 
          ? "border-[var(--info)] text-[var(--info)]" 
          : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      )}
    >
      {children}
      {count !== undefined && (
        <span className={cn(
          "ml-2 px-1.5 py-0.5 text-xs rounded-full",
          active ? "bg-[var(--info)]/20" : "bg-[var(--surface)]"
        )}>
          {count}
        </span>
      )}
    </button>
  );
}

// Position card for grid view
function PositionCard({ position }: { position: PositionSummary }) {
  const totalPnL = (position.leap_pnl || 0) + (position.cumulative_short_pnl || 0);
  const isProfit = totalPnL >= 0;
  
  return (
    <Link 
      href={`/positions/${position.id}`}
      className="card hover:border-[var(--info)]/50 transition-colors group"
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)] group-hover:text-[var(--info)]">
              {position.ticker}
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              ${position.long_strike} Call · {formatDate(position.long_expiration, 'MMM yyyy')}
            </p>
          </div>
          <span className={cn(
            "px-2 py-0.5 text-xs font-medium rounded-full",
            position.status === 'active' 
              ? "bg-[var(--profit)]/20 text-[var(--profit)]"
              : "bg-[var(--text-secondary)]/20 text-[var(--text-secondary)]"
          )}>
            {position.status}
          </span>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <p className="text-xs text-[var(--text-secondary)]">Net P&L</p>
            <p className={cn(
              "text-sm font-mono font-medium",
              isProfit ? "text-[var(--profit)]" : "text-[var(--loss)]"
            )}>
              {isProfit ? '+' : ''}{formatCurrency(totalPnL)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-secondary)]">Cycles</p>
            <p className="text-sm font-medium text-[var(--text-primary)]">
              {position.total_cycles}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-secondary)]">Cum. Premium</p>
            <p className="text-sm font-mono text-[var(--text-primary)]">
              {formatCurrency(position.cumulative_premium)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-secondary)]">DTE</p>
            <p className={cn(
              "text-sm font-medium",
              (position.dte_remaining || 0) < 60 
                ? "text-[var(--loss)]" 
                : "text-[var(--text-primary)]"
            )}>
              {position.dte_remaining} days
            </p>
          </div>
        </div>

        {/* Current short call */}
        {position.active_short_strike && (
          <div className="pt-3 border-t border-[var(--border)]">
            <p className="text-xs text-[var(--text-secondary)] mb-1">Active Short</p>
            <p className="text-sm text-[var(--text-primary)]">
              ${position.active_short_strike}c · {formatDate(position.active_short_expiration!, 'M/d')}
            </p>
          </div>
        )}
      </div>
    </Link>
  );
}

// Position row for list view
function PositionRow({ position }: { position: PositionSummary }) {
  const totalPnL = (position.leap_pnl || 0) + (position.cumulative_short_pnl || 0);
  const isProfit = totalPnL >= 0;
  
  return (
    <Link 
      href={`/positions/${position.id}`}
      className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--surface)]/50 transition-colors border-b border-[var(--border)] last:border-b-0"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[var(--text-primary)]">{position.ticker}</span>
          <span className={cn(
            "px-1.5 py-0.5 text-xs rounded",
            position.status === 'active' 
              ? "bg-[var(--profit)]/20 text-[var(--profit)]"
              : "bg-[var(--text-secondary)]/20 text-[var(--text-secondary)]"
          )}>
            {position.status}
          </span>
        </div>
        <p className="text-xs text-[var(--text-secondary)] truncate">
          ${position.long_strike}c {formatDate(position.long_expiration, 'MMM yy')} · {position.dte_remaining} DTE
        </p>
      </div>
      
      <div className="text-right">
        <p className={cn(
          "text-sm font-mono font-medium",
          isProfit ? "text-[var(--profit)]" : "text-[var(--loss)]"
        )}>
          {isProfit ? '+' : ''}{formatCurrency(totalPnL)}
        </p>
        <p className="text-xs text-[var(--text-secondary)]">
          {position.total_cycles} cycles
        </p>
      </div>
    </Link>
  );
}

export default function PositionsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const { data: positions, isLoading, error, refetch } = useQuery({
    queryKey: ['positions', statusFilter],
    queryFn: () => positionsAPI.list(statusFilter === 'all' ? undefined : statusFilter),
  });

  // Filter positions by search query
  const filteredPositions = positions?.filter(p => 
    p.ticker.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  // Calculate totals
  const totals = filteredPositions.reduce((acc, p) => ({
    totalPnL: acc.totalPnL + (p.leap_pnl || 0) + (p.cumulative_short_pnl || 0),
    totalPremium: acc.totalPremium + (p.cumulative_premium || 0),
    totalCycles: acc.totalCycles + (p.total_cycles || 0),
  }), { totalPnL: 0, totalPremium: 0, totalCycles: 0 });

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="w-12 h-12 text-[var(--loss)]" />
        <h2 className="text-lg font-medium">Failed to load positions</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Make sure the backend server is running
        </p>
        <button onClick={() => refetch()} className="btn-secondary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Positions</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Manage your IPMCC positions and cycles
          </p>
        </div>
        <Link href="/positions/new" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Position
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider">Total P&L</p>
          <p className={cn(
            "text-2xl font-mono font-semibold mt-1",
            totals.totalPnL >= 0 ? "text-[var(--profit)]" : "text-[var(--loss)]"
          )}>
            {totals.totalPnL >= 0 ? '+' : ''}{formatCurrency(totals.totalPnL)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider">Cumulative Premium</p>
          <p className="text-2xl font-mono font-semibold text-[var(--text-primary)] mt-1">
            {formatCurrency(totals.totalPremium)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider">Total Cycles</p>
          <p className="text-2xl font-semibold text-[var(--text-primary)] mt-1">
            {totals.totalCycles}
          </p>
        </div>
      </div>

      {/* Filters bar */}
      <div className="card">
        <div className="flex items-center justify-between border-b border-[var(--border)]">
          <div className="flex">
            <TabButton 
              active={statusFilter === 'active'} 
              onClick={() => setStatusFilter('active')}
              count={positions?.filter(p => p.status === 'active').length}
            >
              Active
            </TabButton>
            <TabButton 
              active={statusFilter === 'closed'} 
              onClick={() => setStatusFilter('closed')}
              count={positions?.filter(p => p.status === 'closed').length}
            >
              Closed
            </TabButton>
            <TabButton 
              active={statusFilter === 'all'} 
              onClick={() => setStatusFilter('all')}
              count={positions?.length}
            >
              All
            </TabButton>
          </div>
          
          <div className="flex items-center gap-2 px-4">
            <button 
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-2 rounded",
                viewMode === 'grid' 
                  ? "bg-[var(--surface)] text-[var(--text-primary)]" 
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={cn(
                "p-2 rounded",
                viewMode === 'list' 
                  ? "bg-[var(--surface)] text-[var(--text-primary)]" 
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input
              type="text"
              placeholder="Search by ticker..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10 w-full max-w-xs"
            />
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[var(--text-secondary)]" />
            <p className="text-sm text-[var(--text-secondary)] mt-2">Loading positions...</p>
          </div>
        ) : filteredPositions.length === 0 ? (
          <div className="p-8 text-center">
            <TrendingUp className="w-12 h-12 mx-auto text-[var(--text-secondary)] mb-3" />
            <p className="text-[var(--text-primary)] font-medium">No positions found</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {searchQuery ? 'Try a different search term' : 'Add your first IPMCC position to get started'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPositions.map(position => (
              <PositionCard key={position.id} position={position} />
            ))}
          </div>
        ) : (
          <div>
            {filteredPositions.map(position => (
              <PositionRow key={position.id} position={position} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
