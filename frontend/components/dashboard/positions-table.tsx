'use client';

import { PositionSummary } from '@/lib/types';
import { formatCurrency, formatPercent, formatDate, getDTEStatus, cn } from '@/lib/utils';
import { 
  Plus, 
  MoreHorizontal, 
  TrendingUp, 
  TrendingDown,
  AlertCircle,
  Clock,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface PositionsTableProps {
  positions: PositionSummary[];
  isLoading?: boolean;
}

// Status badge component
function StatusBadge({ status, dteRemaining }: { status: string; dteRemaining?: number }) {
  const dteStatus = dteRemaining ? getDTEStatus(dteRemaining) : null;
  
  const getStatusColor = () => {
    if (status === 'closed') return 'bg-[var(--text-secondary)]/20 text-[var(--text-secondary)]';
    if (dteStatus === 'critical') return 'bg-[var(--loss)]/20 text-[var(--loss)]';
    if (dteStatus === 'warning') return 'bg-[var(--warning)]/20 text-[var(--warning)]';
    return 'bg-[var(--profit)]/20 text-[var(--profit)]';
  };

  const getStatusIcon = () => {
    if (status === 'closed') return null;
    if (dteStatus === 'critical') return <AlertCircle className="w-3 h-3" />;
    if (dteStatus === 'warning') return <Clock className="w-3 h-3" />;
    return null;
  };

  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
      getStatusColor()
    )}>
      {getStatusIcon()}
      {status === 'closed' ? 'Closed' : dteStatus === 'critical' ? 'ROLL' : dteStatus === 'warning' ? 'Watch' : 'Active'}
    </span>
  );
}

// P&L display component
function PnLDisplay({ value, percent }: { value: number; percent?: number }) {
  const isPositive = value >= 0;
  
  return (
    <div className="text-right">
      <div className={cn(
        "font-mono font-medium",
        isPositive ? "text-[var(--profit)]" : "text-[var(--loss)]"
      )}>
        {isPositive ? '+' : ''}{formatCurrency(value)}
      </div>
      {percent !== undefined && (
        <div className={cn(
          "text-xs font-mono",
          isPositive ? "text-[var(--profit)]/70" : "text-[var(--loss)]/70"
        )}>
          {isPositive ? '+' : ''}{formatPercent(percent)}
        </div>
      )}
    </div>
  );
}

// Skeleton row for loading state
function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3"><div className="h-5 w-16 bg-[var(--surface)] rounded" /></td>
      <td className="px-4 py-3"><div className="h-8 w-24 bg-[var(--surface)] rounded" /></td>
      <td className="px-4 py-3"><div className="h-8 w-32 bg-[var(--surface)] rounded" /></td>
      <td className="px-4 py-3"><div className="h-8 w-20 bg-[var(--surface)] rounded" /></td>
      <td className="px-4 py-3"><div className="h-8 w-24 bg-[var(--surface)] rounded" /></td>
      <td className="px-4 py-3"><div className="h-8 w-20 bg-[var(--surface)] rounded" /></td>
      <td className="px-4 py-3"><div className="h-8 w-8 bg-[var(--surface)] rounded" /></td>
    </tr>
  );
}

// Empty state component
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 bg-[var(--surface)] rounded-full flex items-center justify-center mb-4">
        <TrendingUp className="w-8 h-8 text-[var(--text-secondary)]" />
      </div>
      <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">
        No positions yet
      </h3>
      <p className="text-sm text-[var(--text-secondary)] mb-4 max-w-sm">
        Start building your IPMCC portfolio by adding your first position.
      </p>
      <Link 
        href="/positions/new"
        className="btn-primary flex items-center gap-2"
      >
        <Plus className="w-4 h-4" />
        Add First Position
      </Link>
    </div>
  );
}

// Row actions dropdown
function RowActions({ position }: { position: PositionSummary }) {
  const [open, setOpen] = useState(false);
  
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-1 rounded hover:bg-[var(--surface)] transition-colors"
      >
        <MoreHorizontal className="w-5 h-5 text-[var(--text-secondary)]" />
      </button>
      
      {open && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-20 bg-[var(--bg)] border border-[var(--border)] rounded-lg shadow-lg py-1 min-w-[160px]">
            <Link 
              href={`/positions/${position.id}`}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--surface)] transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              View Details
            </Link>
            {position.status === 'active' && position.active_short_strike && (
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--surface)] transition-colors text-left"
                onClick={() => {
                  setOpen(false);
                  // TODO: Open roll modal
                }}
              >
                <TrendingUp className="w-4 h-4" />
                Roll Cycle
              </button>
            )}
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--surface)] transition-colors text-left text-[var(--loss)]"
              onClick={() => {
                setOpen(false);
                // TODO: Open close confirmation
              }}
            >
              <TrendingDown className="w-4 h-4" />
              Close Position
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function PositionsTable({ positions, isLoading }: PositionsTableProps) {
  if (!isLoading && positions.length === 0) {
    return (
      <div className="card">
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[var(--text-secondary)]" />
          <h2 className="font-semibold text-[var(--text-primary)]">Active Positions</h2>
          {!isLoading && (
            <span className="text-sm text-[var(--text-secondary)]">
              ({positions.length})
            </span>
          )}
        </div>
        <Link href="/positions/new" className="btn-primary flex items-center gap-1.5">
          <Plus className="w-4 h-4" />
          New Position
        </Link>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                Status
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                Ticker
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                LEAP
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                Short
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                Cycles
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                Net P&L
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {isLoading ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : (
              positions.map((position) => (
                <tr 
                  key={position.id}
                  className="hover:bg-[var(--surface)]/50 transition-colors cursor-pointer group"
                >
                  <td className="px-4 py-3">
                    <StatusBadge 
                      status={position.status} 
                      dteRemaining={position.dte_remaining}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/positions/${position.id}`} className="block">
                      <div className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--info)]">
                        {position.ticker}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-[var(--text-primary)]">
                      ${position.long_strike}c {formatDate(position.long_expiration, 'MMM yy')}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      {position.dte_remaining} DTE
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {position.active_short_strike ? (
                      <>
                        <div className="text-sm text-[var(--text-primary)]">
                          ${position.active_short_strike}c
                        </div>
                        <div className="text-xs text-[var(--text-secondary)]">
                          {formatDate(position.active_short_expiration!, 'M/d')}
                        </div>
                      </>
                    ) : (
                      <span className="text-sm text-[var(--text-secondary)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-[var(--text-primary)]">
                      {position.total_cycles} cycles
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] font-mono">
                      {formatCurrency(position.cumulative_premium)} cum
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <PnLDisplay 
                      value={(position.leap_pnl || 0) + (position.cumulative_short_pnl || 0)}
                      percent={
                        position.entry_price > 0 
                          ? (((position.leap_pnl || 0) + (position.cumulative_short_pnl || 0)) / 
                             (position.entry_price * 100 * (position.quantity || 1))) * 100
                          : undefined
                      }
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <RowActions position={position} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {!isLoading && positions.length > 0 && (
        <div className="px-4 py-3 border-t border-[var(--border)] flex items-center justify-between">
          <span className="text-sm text-[var(--text-secondary)]">
            Showing {positions.length} active position{positions.length !== 1 ? 's' : ''}
          </span>
          <Link 
            href="/positions?status=closed"
            className="text-sm text-[var(--info)] hover:underline flex items-center gap-1"
          >
            View Closed Positions
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
