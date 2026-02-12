'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { positionsAPI, cyclesAPI } from '@/lib/api';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  RefreshCw, 
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign,
  Percent,
  Calendar,
  MoreHorizontal,
  Edit2,
  Trash2,
  Plus,
  AlertTriangle,
  ChevronRight,
  Zap
} from 'lucide-react';
import { formatCurrency, formatPercent, formatDate, cn } from '@/lib/utils';
import { Position, ShortCallCycle } from '@/lib/types';

// Alert interfaces
interface RollSuggestion {
  suggestion_type: string;
  urgency: string;
  trigger_reason: string;
  detailed_reasoning: string;
  current_strike?: number;
  current_expiration?: string;
  suggested_strike?: number;
  suggested_expiration?: string;
}

interface EarningsRisk {
  ticker: string;
  earnings_date: string;
  days_until_earnings: number;
  risk_level: string;
  recommendation: string;
}

// Tab component
function Tab({ 
  active, 
  onClick, 
  children 
}: { 
  active: boolean; 
  onClick: () => void; 
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
        active 
          ? "border-[var(--info)] text-[var(--info)]" 
          : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      )}
    >
      {children}
    </button>
  );
}

// Stat card
function StatCard({ 
  label, 
  value, 
  subValue,
  icon: Icon,
  variant = 'default'
}: { 
  label: string; 
  value: string | number; 
  subValue?: string;
  icon?: any;
  variant?: 'default' | 'profit' | 'loss' | 'warning';
}) {
  const colors = {
    default: 'text-[var(--text-primary)]',
    profit: 'text-[var(--profit)]',
    loss: 'text-[var(--loss)]',
    warning: 'text-[var(--warning)]'
  };

  return (
    <div className="bg-[var(--surface)]/50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon className="w-4 h-4 text-[var(--text-secondary)]" />}
        <span className="text-xs text-[var(--text-secondary)] uppercase tracking-wider">{label}</span>
      </div>
      <p className={cn("text-xl font-semibold font-mono", colors[variant])}>{value}</p>
      {subValue && (
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">{subValue}</p>
      )}
    </div>
  );
}

// Current cycle component
function CurrentCycleTab({ 
  position, 
  cycles,
  onRoll
}: { 
  position: Position; 
  cycles: ShortCallCycle[];
  onRoll: () => void;
}) {
  const activeCycle = cycles.find(c => !c.close_date);
  
  if (!activeCycle) {
    return (
      <div className="text-center py-12">
        <Clock className="w-12 h-12 mx-auto text-[var(--text-secondary)] mb-3" />
        <h3 className="text-lg font-medium text-[var(--text-primary)]">No Active Short Call</h3>
        <p className="text-sm text-[var(--text-secondary)] mt-1 mb-4">
          Open a new short call cycle to start collecting premium.
        </p>
        <Link href={`/positions/${position.id}/new-cycle`} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          Open New Cycle
        </Link>
      </div>
    );
  }

  const daysRemaining = Math.ceil(
    (new Date(activeCycle.short_expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  
  // Estimate extrinsic remaining (simplified - would need live data for accuracy)
  const extrinsicCaptured = activeCycle.entry_extrinsic * 0.5; // Placeholder
  const extrinsicRemaining = activeCycle.entry_extrinsic - extrinsicCaptured;
  const capturePercent = (extrinsicCaptured / activeCycle.entry_extrinsic) * 100;

  return (
    <div className="space-y-6">
      {/* Cycle header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            Cycle #{activeCycle.cycle_number}
          </h3>
          <p className="text-sm text-[var(--text-secondary)]">
            Opened {formatDate(activeCycle.entry_date, 'MMM d, yyyy')}
          </p>
        </div>
        <span className="px-3 py-1 bg-[var(--info)]/20 text-[var(--info)] text-sm font-medium rounded-full">
          Active
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Cycle details */}
        <div className="space-y-4">
          <div className="card p-4">
            <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Short Call Details</h4>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Strike</span>
                <span className="font-mono font-medium">${activeCycle.short_strike}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Expiration</span>
                <span className="font-medium">{formatDate(activeCycle.short_expiration, 'MMM d, yyyy')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">DTE</span>
                <span className={cn(
                  "font-medium",
                  daysRemaining <= 1 ? "text-[var(--loss)]" : 
                  daysRemaining <= 3 ? "text-[var(--warning)]" : ""
                )}>
                  {daysRemaining} days
                </span>
              </div>
              <hr className="border-[var(--border)]" />
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Entry Premium</span>
                <span className="font-mono text-[var(--profit)]">${activeCycle.entry_premium.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Entry Extrinsic</span>
                <span className="font-mono">${activeCycle.entry_extrinsic.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Stock at Entry</span>
                <span className="font-mono">${activeCycle.stock_price_at_entry?.toFixed(2) || '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Extrinsic capture progress */}
        <div className="space-y-4">
          <div className="card p-4">
            <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-4">Extrinsic Capture</h4>
            
            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-[var(--text-secondary)]">Captured</span>
                <span className="font-mono font-medium text-[var(--profit)]">
                  {capturePercent.toFixed(0)}%
                </span>
              </div>
              <div className="h-3 bg-[var(--surface)] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[var(--profit)] rounded-full transition-all duration-500"
                  style={{ width: `${capturePercent}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-[var(--text-secondary)] mt-1">
                <span>${extrinsicCaptured.toFixed(2)} captured</span>
                <span>${extrinsicRemaining.toFixed(2)} remaining</span>
              </div>
            </div>

            {/* Roll recommendation */}
            {capturePercent >= 80 && (
              <div className="p-3 bg-[var(--warning)]/10 border border-[var(--warning)]/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-[var(--warning)] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-[var(--warning)]">Roll Recommended</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {capturePercent.toFixed(0)}% of extrinsic captured. Consider rolling to next week.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-center pt-4">
        <button onClick={onRoll} className="btn-primary">
          Roll to Next Week
        </button>
        <button className="btn-secondary">
          Close Early
        </button>
        <button className="btn-ghost">
          Let Expire
        </button>
      </div>
    </div>
  );
}

// Cycle history component
function CycleHistoryTab({ cycles }: { cycles: ShortCallCycle[] }) {
  const closedCycles = cycles.filter(c => c.close_date).sort((a, b) => b.cycle_number - a.cycle_number);
  
  if (closedCycles.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="w-12 h-12 mx-auto text-[var(--text-secondary)] mb-3" />
        <h3 className="text-lg font-medium text-[var(--text-primary)]">No Cycle History</h3>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Completed cycles will appear here.
        </p>
      </div>
    );
  }

  const stats = closedCycles.reduce((acc, c) => ({
    totalPnL: acc.totalPnL + (c.realized_pnl || 0),
    totalPremium: acc.totalPremium + c.entry_premium,
    wins: acc.wins + ((c.realized_pnl || 0) >= 0 ? 1 : 0),
  }), { totalPnL: 0, totalPremium: 0, wins: 0 });

  const winRate = (stats.wins / closedCycles.length) * 100;

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-3 text-center">
          <p className="text-xs text-[var(--text-secondary)]">Total Cycles</p>
          <p className="text-xl font-semibold">{closedCycles.length}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xs text-[var(--text-secondary)]">Win Rate</p>
          <p className={cn(
            "text-xl font-semibold",
            winRate >= 70 ? "text-[var(--profit)]" : winRate >= 50 ? "text-[var(--warning)]" : "text-[var(--loss)]"
          )}>
            {winRate.toFixed(0)}%
          </p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xs text-[var(--text-secondary)]">Avg Premium</p>
          <p className="text-xl font-mono font-semibold">
            ${(stats.totalPremium / closedCycles.length).toFixed(2)}
          </p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xs text-[var(--text-secondary)]">Net P&L</p>
          <p className={cn(
            "text-xl font-mono font-semibold",
            stats.totalPnL >= 0 ? "text-[var(--profit)]" : "text-[var(--loss)]"
          )}>
            {stats.totalPnL >= 0 ? '+' : ''}{formatCurrency(stats.totalPnL * 100)}
          </p>
        </div>
      </div>

      {/* Cycles table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-secondary)] uppercase">Cycle</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-secondary)] uppercase">Strike</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-secondary)] uppercase">Dates</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-secondary)] uppercase">Premium</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-secondary)] uppercase">Closed@</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-[var(--text-secondary)] uppercase">P&L</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-secondary)] uppercase">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {closedCycles.map(cycle => {
              const pnl = (cycle.realized_pnl || 0) * 100;
              return (
                <tr key={cycle.id} className="hover:bg-[var(--surface)]/50">
                  <td className="px-4 py-3 font-medium">#{cycle.cycle_number}</td>
                  <td className="px-4 py-3 font-mono">${cycle.short_strike}</td>
                  <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                    {formatDate(cycle.entry_date, 'M/d')} → {formatDate(cycle.close_date!, 'M/d')}
                  </td>
                  <td className="px-4 py-3 font-mono text-[var(--profit)]">${cycle.entry_premium.toFixed(2)}</td>
                  <td className="px-4 py-3 font-mono">${(cycle.close_price || 0).toFixed(2)}</td>
                  <td className={cn(
                    "px-4 py-3 text-right font-mono font-medium",
                    pnl >= 0 ? "text-[var(--profit)]" : "text-[var(--loss)]"
                  )}>
                    {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "px-2 py-0.5 text-xs rounded",
                      cycle.close_reason === 'expired_otm' ? "bg-[var(--profit)]/20 text-[var(--profit)]" :
                      cycle.close_reason === 'rolled' ? "bg-[var(--info)]/20 text-[var(--info)]" :
                      "bg-[var(--surface)]"
                    )}>
                      {cycle.close_reason?.replace('_', ' ') || '—'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Main component
export default function PositionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const positionId = params.id as string;
  
  const [activeTab, setActiveTab] = useState<'current' | 'history' | 'pnl' | 'settings'>('current');
  const [rollSuggestions, setRollSuggestions] = useState<RollSuggestion[]>([]);
  const [earningsRisk, setEarningsRisk] = useState<EarningsRisk | null>(null);

  const { data: position, isLoading, error } = useQuery({
    queryKey: ['position', positionId],
    queryFn: () => positionsAPI.get(positionId),
  });

  const { data: cycles = [] } = useQuery({
    queryKey: ['cycles', positionId],
    queryFn: () => cyclesAPI.listForPosition(positionId),
    enabled: !!position,
  });

  // Fetch roll suggestions and earnings risk for this position
  useEffect(() => {
    const fetchAlerts = async () => {
      if (!position) return;
      
      try {
        const [rollRes, earningsRes] = await Promise.all([
          fetch(`/api/v1/analytics/roll-suggestions/${positionId}`),
          fetch(`/api/v1/analytics/earnings/${position.ticker}`),
        ]);
        
        const rollData = await rollRes.json();
        const earningsData = await earningsRes.json();
        
        setRollSuggestions(rollData.suggestions || []);
        
        // Check if earnings is a risk (before any active cycle expiration)
        if (earningsData.has_earnings && earningsData.days_until) {
          const activeCycle = cycles.find(c => c.is_open);
          if (activeCycle) {
            const expDate = new Date(activeCycle.short_expiration);
            const earnDate = new Date(earningsData.earnings_date);
            if (earnDate <= expDate) {
              setEarningsRisk({
                ticker: position.ticker,
                earnings_date: earningsData.earnings_date,
                days_until_earnings: earningsData.days_until,
                risk_level: earningsData.days_until <= 7 ? 'high' : 'medium',
                recommendation: 'Consider closing before earnings or rolling to post-earnings expiration',
              });
            }
          }
        }
      } catch (error) {
        console.error('Error fetching alerts:', error);
      }
    };
    
    fetchAlerts();
  }, [position, positionId, cycles]);

  const handleRoll = () => {
    // TODO: Open roll modal
    console.log('Roll cycle');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-[var(--text-secondary)]" />
      </div>
    );
  }

  if (error || !position) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="w-12 h-12 text-[var(--loss)]" />
        <h2 className="text-lg font-medium">Position not found</h2>
        <Link href="/positions" className="btn-secondary">
          Back to Positions
        </Link>
      </div>
    );
  }

  const totalPnL = (position.current_value ? (position.current_value - position.entry_price) * 100 : 0)
    + cycles.reduce((sum, c) => sum + ((c.realized_pnl || 0) * 100), 0);
  const cumulativePremium = cycles.reduce((sum, c) => sum + c.entry_premium * 100, 0);
  const dteRemaining = Math.ceil(
    (new Date(position.long_expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back link */}
      <Link 
        href="/positions" 
        className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Positions
      </Link>

      {/* Header card */}
      <div className="card p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-[var(--text-primary)]">{position.ticker}</h1>
              <span className={cn(
                "px-3 py-1 text-sm font-medium rounded-full",
                position.status === 'active' 
                  ? "bg-[var(--profit)]/20 text-[var(--profit)]"
                  : "bg-[var(--text-secondary)]/20 text-[var(--text-secondary)]"
              )}>
                {position.status}
              </span>
            </div>
            <p className="text-[var(--text-secondary)] mt-1">
              ${position.long_strike} Call · {formatDate(position.long_expiration, 'MMMM d, yyyy')}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <button className="btn-ghost p-2">
              <Edit2 className="w-5 h-5" />
            </button>
            <button className="btn-ghost p-2 text-[var(--loss)]">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        <hr className="my-6 border-[var(--border)]" />

        {/* LEAP details */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div>
            <p className="text-xs text-[var(--text-secondary)]">Entry Price</p>
            <p className="text-lg font-mono font-medium">${position.entry_price.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-secondary)]">Current Value</p>
            <p className="text-lg font-mono font-medium">
              ${position.current_value?.toFixed(2) || '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-secondary)]">Entry Delta</p>
            <p className="text-lg font-medium">{position.entry_delta || '—'}Δ</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-secondary)]">DTE Remaining</p>
            <p className={cn(
              "text-lg font-medium",
              dteRemaining < 60 ? "text-[var(--loss)]" : ""
            )}>
              {dteRemaining} days
            </p>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard 
            label="Total P&L" 
            value={`${totalPnL >= 0 ? '+' : ''}${formatCurrency(totalPnL)}`}
            variant={totalPnL >= 0 ? 'profit' : 'loss'}
            icon={TrendingUp}
          />
          <StatCard 
            label="Cumulative Premium" 
            value={formatCurrency(cumulativePremium)}
            subValue={`${cycles.length} cycles`}
            icon={DollarSign}
          />
          <StatCard 
            label="LEAP Value" 
            value={`$${((position.current_value || position.entry_price) * 100).toFixed(0)}`}
            subValue={position.current_value 
              ? `${((position.current_value - position.entry_price) / position.entry_price * 100).toFixed(1)}% vs entry`
              : undefined}
            icon={Percent}
          />
          <StatCard 
            label="Days Active" 
            value={Math.ceil((Date.now() - new Date(position.entry_date).getTime()) / (1000 * 60 * 60 * 24))}
            subValue={`Since ${formatDate(position.entry_date, 'MMM d')}`}
            icon={Calendar}
          />
        </div>
      </div>

      {/* Alerts Section */}
      {(rollSuggestions.length > 0 || earningsRisk) && (
        <div className="space-y-3">
          {/* Critical/High Roll Suggestions */}
          {rollSuggestions
            .filter(s => s.urgency === 'critical' || s.urgency === 'high')
            .map((suggestion, i) => (
              <div 
                key={`roll-${i}`}
                className={cn(
                  "card p-4 border-l-4",
                  suggestion.urgency === 'critical' 
                    ? "border-l-red-500 bg-red-500/5" 
                    : "border-l-orange-500 bg-orange-500/5"
                )}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className={cn(
                    "w-5 h-5 flex-shrink-0 mt-0.5",
                    suggestion.urgency === 'critical' ? "text-red-400" : "text-orange-400"
                  )} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-xs font-medium uppercase",
                        suggestion.urgency === 'critical' 
                          ? "bg-red-500/20 text-red-400" 
                          : "bg-orange-500/20 text-orange-400"
                      )}>
                        {suggestion.urgency}
                      </span>
                      <span className="font-medium text-[var(--text-primary)]">
                        {suggestion.suggestion_type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">{suggestion.trigger_reason}</p>
                    {suggestion.detailed_reasoning && (
                      <p className="text-sm text-[var(--text-secondary)] mt-2 p-3 bg-[var(--surface)] rounded">
                        {suggestion.detailed_reasoning}
                      </p>
                    )}
                    {suggestion.suggested_strike && (
                      <p className="text-sm mt-2">
                        <span className="text-[var(--text-secondary)]">Suggestion: </span>
                        <span className="font-mono font-medium">
                          Roll to ${suggestion.suggested_strike} exp {suggestion.suggested_expiration}
                        </span>
                      </p>
                    )}
                  </div>
                  <Link 
                    href={`/trades?action=roll&ticker=${position.ticker}&strike=${suggestion.suggested_strike || suggestion.current_strike}&expiration=${suggestion.suggested_expiration || ''}&type=roll_short`}
                    className="btn-primary text-sm"
                  >
                    Execute Roll
                  </Link>
                </div>
              </div>
            ))}
          
          {/* Earnings Risk */}
          {earningsRisk && (
            <div className="card p-4 border-l-4 border-l-yellow-500 bg-yellow-500/5">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-medium uppercase bg-yellow-500/20 text-yellow-400">
                      Earnings
                    </span>
                    <span className="font-medium text-[var(--text-primary)]">
                      {earningsRisk.ticker} reports {earningsRisk.earnings_date}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">
                    Earnings in {earningsRisk.days_until_earnings} days - before your option expiration
                  </p>
                  <p className="text-sm text-[var(--text-secondary)] mt-2 p-3 bg-[var(--surface)] rounded">
                    {earningsRisk.recommendation}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="card overflow-hidden">
        <div className="flex border-b border-[var(--border)] overflow-x-auto">
          <Tab active={activeTab === 'current'} onClick={() => setActiveTab('current')}>
            Current Cycle
          </Tab>
          <Tab active={activeTab === 'history'} onClick={() => setActiveTab('history')}>
            Cycle History
          </Tab>
          <Tab active={activeTab === 'pnl'} onClick={() => setActiveTab('pnl')}>
            P&L Chart
          </Tab>
          <Tab active={activeTab === 'settings'} onClick={() => setActiveTab('settings')}>
            Settings
          </Tab>
        </div>

        <div className="p-6">
          {activeTab === 'current' && (
            <CurrentCycleTab position={position} cycles={cycles} onRoll={handleRoll} />
          )}
          {activeTab === 'history' && (
            <CycleHistoryTab cycles={cycles} />
          )}
          {activeTab === 'pnl' && (
            <div className="text-center py-12 text-[var(--text-secondary)]">
              P&L chart coming soon...
            </div>
          )}
          {activeTab === 'settings' && (
            <div className="text-center py-12 text-[var(--text-secondary)]">
              Position settings coming soon...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
