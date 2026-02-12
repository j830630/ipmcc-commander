'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardAPI, positionsAPI } from '@/lib/api';
import { GreeksCards } from '@/components/dashboard/greeks-cards';
import { IncomeVelocityCard } from '@/components/dashboard/income-velocity-card';
import { PnLSummary } from '@/components/dashboard/pnl-summary';
import { ActionItems } from '@/components/dashboard/action-items';
import { PositionsTable } from '@/components/dashboard/positions-table';
import { RefreshCw, AlertCircle } from 'lucide-react';

export default function DashboardPage() {
  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => dashboardAPI.getSummary(),
    refetchInterval: 60000, // Refetch every minute
  });

  const {
    data: positions,
    isLoading: positionsLoading,
    error: positionsError,
  } = useQuery({
    queryKey: ['positions', 'active'],
    queryFn: () => positionsAPI.list('active'),
  });

  const isLoading = summaryLoading || positionsLoading;
  const hasError = summaryError || positionsError;

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="w-12 h-12 text-[var(--loss)]" />
        <h2 className="text-lg font-medium">Failed to load dashboard</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Make sure the backend server is running on localhost:8000
        </p>
        <button
          onClick={() => refetchSummary()}
          className="btn-secondary flex items-center gap-2"
        >
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
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            Dashboard
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Portfolio overview and action items
          </p>
        </div>
        <button
          onClick={() => refetchSummary()}
          className="btn-ghost flex items-center gap-2"
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="text-sm">Refresh</span>
        </button>
      </div>

      {/* Greeks Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <GreeksCards greeks={summary?.greeks} isLoading={isLoading} />
        <IncomeVelocityCard velocity={summary?.income_velocity} isLoading={isLoading} />
      </div>

      {/* P&L and Actions Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PnLSummary summary={summary} isLoading={isLoading} />
        <ActionItems items={summary?.action_items} isLoading={isLoading} />
      </div>

      {/* Positions Table */}
      <PositionsTable positions={positions || []} isLoading={positionsLoading} />
    </div>
  );
}
