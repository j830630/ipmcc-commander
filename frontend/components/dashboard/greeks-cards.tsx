'use client';

import { cn, formatNumber, formatCurrency } from '@/lib/utils';
import type { PortfolioGreeks } from '@/lib/types';
import { TrendingUp, Clock, Activity } from 'lucide-react';

interface GreeksCardsProps {
  greeks?: PortfolioGreeks;
  isLoading?: boolean;
}

export function GreeksCards({ greeks, isLoading }: GreeksCardsProps) {
  if (isLoading || !greeks) {
    return (
      <>
        <GreeksCardSkeleton />
        <GreeksCardSkeleton />
        <GreeksCardSkeleton />
      </>
    );
  }

  // Determine health status
  const deltaAbs = Math.abs(greeks.net_delta);
  const deltaStatus = deltaAbs < 300 ? 'healthy' : deltaAbs < 600 ? 'warning' : 'danger';
  const thetaStatus = greeks.total_theta > 0 ? 'healthy' : 'warning';
  const vegaRatioStatus = greeks.vega_theta_ratio < 0.5 ? 'healthy' : 'warning';

  return (
    <>
      {/* Net Delta */}
      <div className="metric-card">
        <div className="flex items-center justify-between">
          <span className="metric-label">Net Delta</span>
          <TrendingUp className="w-4 h-4 text-[var(--text-muted)]" />
        </div>
        <div className="mt-3 flex items-end gap-3">
          <DeltaGauge value={greeks.net_delta} />
          <div>
            <div className={cn(
              'number-lg',
              greeks.net_delta > 0 ? 'text-[var(--profit)]' : 'text-[var(--loss)]'
            )}>
              {greeks.net_delta > 0 ? '+' : ''}{formatNumber(greeks.net_delta, 0)}
            </div>
            <div className="text-xs text-[var(--text-muted)]">
              {greeks.net_delta > 0 ? 'Bullish' : 'Bearish'} bias
            </div>
          </div>
        </div>
        <StatusIndicator status={deltaStatus} />
      </div>

      {/* Total Theta */}
      <div className="metric-card">
        <div className="flex items-center justify-between">
          <span className="metric-label">Daily Theta</span>
          <Clock className="w-4 h-4 text-[var(--text-muted)]" />
        </div>
        <div className="mt-3">
          <div className={cn(
            'number-lg',
            greeks.total_theta > 0 ? 'text-[var(--profit)]' : 'text-[var(--loss)]'
          )}>
            {greeks.total_theta > 0 ? '+' : ''}{formatCurrency(greeks.total_theta)}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            {greeks.total_theta > 0 ? 'Collecting' : 'Paying'} per day
          </div>
        </div>
        <StatusIndicator status={thetaStatus} />
      </div>

      {/* Vega/Theta Ratio */}
      <div className="metric-card">
        <div className="flex items-center justify-between">
          <span className="metric-label">Vega/Theta</span>
          <Activity className="w-4 h-4 text-[var(--text-muted)]" />
        </div>
        <div className="mt-3">
          <div className={cn(
            'number-lg',
            vegaRatioStatus === 'healthy' ? 'text-[var(--profit)]' : 'text-[var(--warning)]'
          )}>
            {formatNumber(greeks.vega_theta_ratio, 2)}x
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            {vegaRatioStatus === 'healthy' ? 'Low volatility risk' : 'Elevated vol exposure'}
          </div>
        </div>
        <div className="mt-3 text-xs text-[var(--text-muted)]">
          Net Vega: {formatNumber(greeks.total_vega, 0)}
        </div>
        <StatusIndicator status={vegaRatioStatus} />
      </div>
    </>
  );
}

function DeltaGauge({ value }: { value: number }) {
  // Map -1000 to 1000 onto 0 to 100
  const normalized = ((value + 1000) / 2000) * 100;
  const clampedValue = Math.max(0, Math.min(100, normalized));
  
  return (
    <div className="relative w-16 h-16">
      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
        {/* Background arc */}
        <circle
          cx="18"
          cy="18"
          r="14"
          fill="none"
          stroke="var(--bg-base)"
          strokeWidth="3"
          strokeDasharray="88"
          strokeDashoffset="0"
          strokeLinecap="round"
        />
        {/* Value arc */}
        <circle
          cx="18"
          cy="18"
          r="14"
          fill="none"
          stroke={value > 0 ? 'var(--profit)' : 'var(--loss)'}
          strokeWidth="3"
          strokeDasharray="88"
          strokeDashoffset={88 - (clampedValue * 0.88)}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
        {/* Center marker at 50 */}
        <circle
          cx="18"
          cy="4"
          r="1.5"
          fill="var(--text-muted)"
        />
      </svg>
    </div>
  );
}

function StatusIndicator({ status }: { status: 'healthy' | 'warning' | 'danger' }) {
  const colors = {
    healthy: 'bg-[var(--profit)]',
    warning: 'bg-[var(--warning)]',
    danger: 'bg-[var(--loss)]',
  };

  const labels = {
    healthy: 'Healthy',
    warning: 'Caution',
    danger: 'At Risk',
  };

  return (
    <div className="mt-3 flex items-center gap-2">
      <div className={cn('w-2 h-2 rounded-full', colors[status])} />
      <span className="text-xs text-[var(--text-muted)]">{labels[status]}</span>
    </div>
  );
}

function GreeksCardSkeleton() {
  return (
    <div className="metric-card animate-pulse">
      <div className="h-4 w-24 bg-[var(--bg-elevated)] rounded" />
      <div className="mt-4 h-8 w-20 bg-[var(--bg-elevated)] rounded" />
      <div className="mt-2 h-3 w-32 bg-[var(--bg-elevated)] rounded" />
    </div>
  );
}
