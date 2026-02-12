'use client';

import { cn, formatCurrency, formatPnL, getPnLClass } from '@/lib/utils';
import type { DashboardSummary } from '@/lib/types';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

interface PnLSummaryProps {
  summary?: DashboardSummary;
  isLoading?: boolean;
}

export function PnLSummary({ summary, isLoading }: PnLSummaryProps) {
  if (isLoading || !summary) {
    return (
      <div className="card p-5 animate-pulse">
        <div className="h-5 w-32 bg-[var(--bg-elevated)] rounded mb-4" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex justify-between">
              <div className="h-4 w-20 bg-[var(--bg-elevated)] rounded" />
              <div className="h-4 w-24 bg-[var(--bg-elevated)] rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const pnlItems = [
    { label: 'Today', value: summary.pnl_today },
    { label: 'This Week', value: summary.pnl_week },
    { label: 'MTD', value: summary.pnl_mtd },
    { label: 'YTD', value: summary.pnl_ytd },
  ];

  const todayTrend = summary.pnl_today >= 0;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-[var(--text-muted)]" />
          P&L Summary
        </h3>
        <div className={cn(
          'flex items-center gap-1 text-sm font-medium',
          todayTrend ? 'text-[var(--profit)]' : 'text-[var(--loss)]'
        )}>
          {todayTrend ? (
            <TrendingUp className="w-4 h-4" />
          ) : (
            <TrendingDown className="w-4 h-4" />
          )}
          <span>{todayTrend ? 'Up' : 'Down'} today</span>
        </div>
      </div>

      <div className="space-y-3">
        {pnlItems.map((item, index) => (
          <div
            key={item.label}
            className={cn(
              'flex items-center justify-between py-2',
              index < pnlItems.length - 1 && 'border-b border-[var(--border-subtle)]'
            )}
          >
            <span className="text-sm text-[var(--text-secondary)]">{item.label}</span>
            <div className="flex items-center gap-3">
              <span className={cn('number-md', getPnLClass(item.value))}>
                {formatPnL(item.value)}
              </span>
              {index === 0 && (
                <PnLSparkline value={item.value} />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Cumulative Extrinsic */}
      <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
              Cumulative Extrinsic
            </div>
            <div className="text-xs text-[var(--text-secondary)] mt-0.5">
              Total premium collected
            </div>
          </div>
          <div className="text-right">
            <div className="number-lg text-[var(--profit)]">
              {formatCurrency(summary.cumulative_extrinsic)}
            </div>
            <div className="text-xs text-[var(--text-muted)]">
              {summary.active_positions} active positions
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PnLSparkline({ value }: { value: number }) {
  // Simple visual indicator
  const isPositive = value >= 0;
  const bars = [0.3, 0.5, 0.7, 0.4, 0.6, 0.8, 1.0];
  
  return (
    <div className="flex items-end gap-0.5 h-4">
      {bars.map((height, i) => (
        <div
          key={i}
          className={cn(
            'w-1 rounded-sm transition-all duration-300',
            isPositive ? 'bg-[var(--profit)]' : 'bg-[var(--loss)]'
          )}
          style={{
            height: `${height * 100}%`,
            opacity: 0.3 + (i / bars.length) * 0.7,
          }}
        />
      ))}
    </div>
  );
}
