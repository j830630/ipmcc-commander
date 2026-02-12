'use client';

import Link from 'next/link';
import { cn, getPriorityBadgeClass } from '@/lib/utils';
import type { ActionItem } from '@/lib/types';
import {
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  Clock,
  Target,
  ChevronRight,
} from 'lucide-react';

interface ActionItemsProps {
  items?: ActionItem[];
  isLoading?: boolean;
}

export function ActionItems({ items, isLoading }: ActionItemsProps) {
  if (isLoading) {
    return (
      <div className="card p-5 animate-pulse">
        <div className="h-5 w-40 bg-[var(--bg-elevated)] rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-[var(--bg-elevated)] rounded" />
          ))}
        </div>
      </div>
    );
  }

  const hasItems = items && items.length > 0;
  const criticalCount = items?.filter((i) => i.priority === 'critical').length || 0;
  const highCount = items?.filter((i) => i.priority === 'high').length || 0;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-[var(--warning)]" />
          Action Items
          {hasItems && (
            <span className="badge-warning">
              {items.length}
            </span>
          )}
        </h3>
        {criticalCount > 0 && (
          <span className="priority-critical">
            {criticalCount} critical
          </span>
        )}
      </div>

      {!hasItems ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--profit-dim)] flex items-center justify-center mb-3">
            <Target className="w-6 h-6 text-[var(--profit)]" />
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            All positions are healthy
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            No action required
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[320px] overflow-y-auto">
          {items.map((item, index) => (
            <ActionItemCard key={`${item.position_id}-${item.type}-${index}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActionItemCard({ item }: { item: ActionItem }) {
  const Icon = getIconForType(item.type);

  return (
    <Link
      href={`/positions/${item.position_id}`}
      className={cn(
        'block p-3 rounded-lg border transition-all duration-150',
        'hover:bg-[var(--bg-elevated)]',
        item.priority === 'critical' && 'border-[var(--loss)]/50 bg-[var(--loss-dim)]',
        item.priority === 'high' && 'border-[var(--warning)]/50 bg-[var(--warning-dim)]',
        item.priority === 'medium' && 'border-[var(--info)]/50 bg-[var(--info-dim)]',
        item.priority === 'low' && 'border-[var(--border-subtle)]'
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          'mt-0.5 p-1.5 rounded-md',
          item.priority === 'critical' && 'bg-[var(--loss)]/20',
          item.priority === 'high' && 'bg-[var(--warning)]/20',
          item.priority === 'medium' && 'bg-[var(--info)]/20',
          item.priority === 'low' && 'bg-[var(--bg-elevated)]'
        )}>
          <Icon className={cn(
            'w-4 h-4',
            item.priority === 'critical' && 'text-[var(--loss)]',
            item.priority === 'high' && 'text-[var(--warning)]',
            item.priority === 'medium' && 'text-[var(--info)]',
            item.priority === 'low' && 'text-[var(--text-muted)]'
          )} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium text-[var(--text-primary)]">
              {item.ticker}
            </span>
            <span className={cn('text-xs', getPriorityBadgeClass(item.priority))}>
              {item.priority}
            </span>
          </div>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5 truncate">
            {item.message}
          </p>
          {item.detail && (
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {item.detail}
            </p>
          )}
        </div>

        <ChevronRight className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
      </div>
    </Link>
  );
}

function getIconForType(type: string) {
  switch (type) {
    case 'roll_due':
      return RefreshCw;
    case 'emergency_exit':
      return AlertTriangle;
    case 'assignment_risk':
      return AlertTriangle;
    case 'profit_target':
      return TrendingUp;
    case 'leap_expiring':
      return Clock;
    default:
      return AlertTriangle;
  }
}
