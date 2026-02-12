'use client';

import { cn, formatPercent, formatCurrency, getVelocityStatus } from '@/lib/utils';
import type { IncomeVelocity } from '@/lib/types';
import { Zap } from 'lucide-react';

interface IncomeVelocityCardProps {
  velocity?: IncomeVelocity;
  isLoading?: boolean;
}

export function IncomeVelocityCard({ velocity, isLoading }: IncomeVelocityCardProps) {
  if (isLoading || !velocity) {
    return (
      <div className="metric-card animate-pulse">
        <div className="h-4 w-28 bg-[var(--bg-elevated)] rounded" />
        <div className="mt-4 h-10 w-24 bg-[var(--bg-elevated)] rounded" />
        <div className="mt-3 h-2 w-full bg-[var(--bg-elevated)] rounded" />
        <div className="mt-2 h-3 w-36 bg-[var(--bg-elevated)] rounded" />
      </div>
    );
  }

  const status = getVelocityStatus(velocity.current_weekly);
  const targetMin = 1.5;
  const targetMax = 2.5;

  const statusColors = {
    low: 'text-[var(--warning)]',
    target: 'text-[var(--profit)]',
    high: 'text-[var(--info)]',
  };

  const statusLabels = {
    low: 'Below target',
    target: 'On target',
    high: 'Exceeding target',
  };

  // Calculate position on the bar (0-100)
  const barPosition = Math.min(100, Math.max(0, (velocity.current_weekly / 4) * 100));
  const targetStartPos = (targetMin / 4) * 100;
  const targetEndPos = (targetMax / 4) * 100;

  return (
    <div className="metric-card">
      <div className="flex items-center justify-between">
        <span className="metric-label">Income Velocity™</span>
        <Zap className="w-4 h-4 text-[var(--warning)]" />
      </div>

      <div className="mt-3">
        <div className={cn('number-lg', statusColors[status])}>
          {velocity.current_weekly.toFixed(1)}%
          <span className="text-sm font-normal text-[var(--text-muted)] ml-1">/week</span>
        </div>
      </div>

      {/* Velocity Bar */}
      <div className="mt-4 relative">
        {/* Background bar */}
        <div className="h-2 bg-[var(--bg-base)] rounded-full overflow-hidden">
          {/* Target zone highlight */}
          <div
            className="absolute h-full bg-[var(--profit)]/20 rounded-full"
            style={{
              left: `${targetStartPos}%`,
              width: `${targetEndPos - targetStartPos}%`,
            }}
          />
          {/* Current value indicator */}
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              status === 'low' && 'bg-[var(--warning)]',
              status === 'target' && 'bg-[var(--profit)]',
              status === 'high' && 'bg-[var(--info)]'
            )}
            style={{ width: `${barPosition}%` }}
          />
        </div>

        {/* Scale markers */}
        <div className="flex justify-between mt-1 text-[10px] text-[var(--text-muted)]">
          <span>0%</span>
          <span>1.5%</span>
          <span>2.5%</span>
          <span>4%</span>
        </div>
      </div>

      {/* Status */}
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className={cn('font-medium', statusColors[status])}>
          {statusLabels[status]}
        </span>
        <span className="text-[var(--text-muted)]">
          Target: {targetMin}% - {targetMax}%
        </span>
      </div>

      {/* Additional metrics */}
      <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] grid grid-cols-2 gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            4-Week Avg
          </div>
          <div className="number-sm mt-0.5">
            {velocity.rolling_4_week.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            Weekly Target
          </div>
          <div className="number-sm mt-0.5">
            {formatCurrency(velocity.weekly_extrinsic_target)}
          </div>
        </div>
      </div>
    </div>
  );
}
