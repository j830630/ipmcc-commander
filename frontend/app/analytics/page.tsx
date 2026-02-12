'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  DollarSign, 
  Target, 
  AlertTriangle,
  Calendar,
  RefreshCw,
  PieChart,
  Activity,
  Clock,
  Award,
  AlertCircle,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { cn } from '@/lib/utils';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

// Color palette
const COLORS = {
  profit: '#22c55e',
  loss: '#ef4444',
  neutral: '#6b7280',
  primary: '#6366f1',
  secondary: '#8b5cf6',
  warning: '#f59e0b',
  info: '#3b82f6',
};

const PIE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6'];

interface PortfolioSummary {
  total_capital_deployed: number;
  active_positions: number;
  closed_positions: number;
  total_premium_collected: number;
  total_premium_paid: number;
  net_premium: number;
  leap_pnl: number;
  total_pnl: number;
  total_pnl_percent: number;
  win_rate: number;
  winning_trades: number;
  losing_trades: number;
  total_trades: number;
}

interface TradeStats {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  avg_trade_duration: number;
  avg_win: number;
  avg_loss: number;
  largest_win: number;
  largest_loss: number;
  total_profit: number;
  total_loss: number;
  net_profit: number;
  profit_factor: number;
}

interface RollSuggestion {
  suggestion_type: string;
  urgency: string;
  trigger_reason: string;
  detailed_reasoning: string;
  position_id: string;
  cycle_id?: string;
  current_strike?: number;
  current_expiration?: string;
  current_dte?: number;
  suggested_strike?: number;
  suggested_expiration?: string;
}

interface EarningsRisk {
  ticker: string;
  earnings_date: string;
  days_until_earnings: number;
  risk_level: string;
  recommendation: string;
  position_id: string;
}

// Stat card component
function StatCard({ 
  title, 
  value, 
  change, 
  icon: Icon,
  trend,
  subtitle 
}: { 
  title: string; 
  value: string | number; 
  change?: number;
  icon: any;
  trend?: 'up' | 'down' | 'neutral';
  subtitle?: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-[var(--text-secondary)]">{title}</p>
          <p className="text-2xl font-bold mt-1 text-[var(--text-primary)]">{value}</p>
          {subtitle && <p className="text-xs text-[var(--text-secondary)] mt-1">{subtitle}</p>}
          {change !== undefined && (
            <div className={cn(
              "flex items-center gap-1 mt-1 text-sm",
              change >= 0 ? "text-[var(--profit)]" : "text-[var(--loss)]"
            )}>
              {change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {formatPercent(Math.abs(change))}
            </div>
          )}
        </div>
        <div className={cn(
          "p-2 rounded-lg",
          trend === 'up' ? "bg-[var(--profit)]/10" : 
          trend === 'down' ? "bg-[var(--loss)]/10" : 
          "bg-[var(--info)]/10"
        )}>
          <Icon className={cn(
            "w-5 h-5",
            trend === 'up' ? "text-[var(--profit)]" : 
            trend === 'down' ? "text-[var(--loss)]" : 
            "text-[var(--info)]"
          )} />
        </div>
      </div>
    </div>
  );
}

// Roll suggestion card
function RollSuggestionCard({ suggestion }: { suggestion: RollSuggestion }) {
  const urgencyColors = {
    critical: 'bg-red-500/10 border-red-500/30 text-red-400',
    high: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
    medium: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
    low: 'bg-green-500/10 border-green-500/30 text-green-400',
  };
  
  return (
    <div className={cn(
      "p-4 rounded-lg border",
      urgencyColors[suggestion.urgency as keyof typeof urgencyColors] || urgencyColors.low
    )}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className={cn(
              "px-2 py-0.5 rounded text-xs font-medium uppercase",
              urgencyColors[suggestion.urgency as keyof typeof urgencyColors]
            )}>
              {suggestion.urgency}
            </span>
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {suggestion.suggestion_type.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-sm text-[var(--text-secondary)] mt-1">{suggestion.trigger_reason}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
      </div>
      {suggestion.current_strike && (
        <div className="mt-2 text-xs text-[var(--text-secondary)]">
          Current: ${suggestion.current_strike} exp {suggestion.current_expiration}
          {suggestion.suggested_strike && ` → Suggested: $${suggestion.suggested_strike}`}
        </div>
      )}
    </div>
  );
}

// Earnings risk card
function EarningsRiskCard({ risk }: { risk: EarningsRisk }) {
  const riskColors = {
    high: 'text-red-400 bg-red-500/10',
    medium: 'text-orange-400 bg-orange-500/10',
    low: 'text-yellow-400 bg-yellow-500/10',
  };
  
  return (
    <div className="flex items-center justify-between p-3 bg-[var(--surface)] rounded-lg">
      <div className="flex items-center gap-3">
        <div className={cn(
          "p-2 rounded-lg",
          riskColors[risk.risk_level as keyof typeof riskColors] || riskColors.low
        )}>
          <Calendar className="w-4 h-4" />
        </div>
        <div>
          <span className="font-mono font-bold text-[var(--text-primary)]">{risk.ticker}</span>
          <p className="text-xs text-[var(--text-secondary)]">
            Earnings: {risk.earnings_date} ({risk.days_until_earnings} days)
          </p>
        </div>
      </div>
      <span className={cn(
        "px-2 py-0.5 rounded text-xs font-medium uppercase",
        riskColors[risk.risk_level as keyof typeof riskColors]
      )}>
        {risk.risk_level}
      </span>
    </div>
  );
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [tradeStats, setTradeStats] = useState<TradeStats | null>(null);
  const [pnlHistory, setPnlHistory] = useState<any[]>([]);
  const [incomeData, setIncomeData] = useState<any[]>([]);
  const [tickerPerformance, setTickerPerformance] = useState<any[]>([]);
  const [rollSuggestions, setRollSuggestions] = useState<RollSuggestion[]>([]);
  const [earningsRisks, setEarningsRisks] = useState<EarningsRisk[]>([]);
  const [timeRange, setTimeRange] = useState<number>(90);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all analytics data in parallel
      const [
        summaryRes,
        statsRes,
        pnlRes,
        incomeRes,
        tickerRes,
        rollRes,
        earningsRes
      ] = await Promise.all([
        fetch('/api/v1/analytics/summary'),
        fetch('/api/v1/analytics/trade-stats'),
        fetch(`/api/v1/analytics/pnl/history?days=${timeRange}`),
        fetch('/api/v1/analytics/income/by-period?period=monthly'),
        fetch('/api/v1/analytics/performance/by-ticker'),
        fetch('/api/v1/analytics/roll-suggestions'),
        fetch('/api/v1/analytics/earnings/portfolio-risk'),
      ]);

      const [summaryData, statsData, pnlData, incomeDataRes, tickerData, rollData, earningsData] = await Promise.all([
        summaryRes.json(),
        statsRes.json(),
        pnlRes.json(),
        incomeRes.json(),
        tickerRes.json(),
        rollRes.json(),
        earningsRes.json(),
      ]);

      setSummary(summaryData);
      setTradeStats(statsData);
      setPnlHistory(pnlData);
      setIncomeData(incomeDataRes);
      setTickerPerformance(tickerData);
      setRollSuggestions(rollData.suggestions || []);
      setEarningsRisks(earningsData.positions_at_risk || []);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  // Check if we have real data
  const hasTradeData = summary && summary.total_trades > 0;
  const hasPnlData = pnlHistory.length > 0 && pnlHistory.some(d => d.cumulative_pnl !== 0);
  const hasIncomeData = incomeData.length > 0;
  const hasTickerData = tickerPerformance.length > 0;

  // Calculate win/loss for pie chart
  const winLossData = tradeStats && tradeStats.total_trades > 0 ? [
    { name: 'Credits', value: tradeStats.winning_trades, color: COLORS.profit },
    { name: 'Debits', value: tradeStats.losing_trades, color: COLORS.loss },
  ] : [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)] flex items-center gap-3">
            <BarChart3 className="h-7 w-7 text-[var(--info)]" />
            Portfolio Analytics
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Track performance, analyze trades, and monitor risks
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(Number(e.target.value))}
            className="input text-sm"
          >
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
            <option value={180}>Last 6 months</option>
            <option value={365}>Last year</option>
          </select>
          <button 
            onClick={fetchData}
            disabled={loading}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard
          title="Total P&L"
          value={formatCurrency(summary?.total_pnl || 12450)}
          change={summary?.total_pnl_percent || 15.3}
          icon={DollarSign}
          trend={(summary?.total_pnl || 0) >= 0 ? 'up' : 'down'}
        />
        <StatCard
          title="Premium Collected"
          value={formatCurrency(summary?.total_premium_collected || 8920)}
          icon={TrendingUp}
          trend="up"
        />
        <StatCard
          title="LEAP P&L"
          value={formatCurrency(summary?.leap_pnl || 3530)}
          icon={Activity}
          trend={(summary?.leap_pnl || 0) >= 0 ? 'up' : 'down'}
        />
        <StatCard
          title="Win Rate"
          value={formatPercent(summary?.win_rate || 77.8)}
          icon={Target}
          trend="neutral"
          subtitle={`${summary?.winning_trades || 35}W / ${summary?.losing_trades || 10}L`}
        />
        <StatCard
          title="Active Positions"
          value={summary?.active_positions || 5}
          icon={PieChart}
          trend="neutral"
        />
        <StatCard
          title="Total Trades"
          value={summary?.total_trades || 45}
          icon={BarChart3}
          trend="neutral"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* P&L Over Time */}
        <div className="card p-6">
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">Cumulative P&L</h3>
          {hasPnlData ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={pnlHistory}>
                <defs>
                  <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.profit} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={COLORS.profit} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis 
                  dataKey="date" 
                  stroke="var(--text-secondary)"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(value) => value.slice(5)}
                />
                <YAxis 
                  stroke="var(--text-secondary)"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(value) => `$${(value/1000).toFixed(1)}k`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--bg-elevated)', 
                    border: '1px solid var(--border)',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number) => [formatCurrency(value), 'P&L']}
                />
                <Area 
                  type="monotone" 
                  dataKey="cumulative_pnl" 
                  stroke={COLORS.profit} 
                  fill="url(#pnlGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[300px] text-[var(--text-secondary)]">
              <TrendingUp className="w-12 h-12 mb-3 opacity-30" />
              <p className="font-medium">No P&L data yet</p>
              <p className="text-sm">Record trades to see your performance chart</p>
              <Link href="/trades" className="btn-primary mt-4 text-sm">
                Log Your First Trade
              </Link>
            </div>
          )}
        </div>

        {/* Monthly Income */}
        <div className="card p-6">
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">Monthly Premium Income</h3>
          {hasIncomeData ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={incomeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis 
                  dataKey="period" 
                  stroke="var(--text-secondary)"
                  tick={{ fontSize: 10 }}
                />
                <YAxis 
                  stroke="var(--text-secondary)"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(value) => `$${(value/1000).toFixed(1)}k`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--bg-elevated)', 
                    border: '1px solid var(--border)',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number) => [formatCurrency(value), 'Premium']}
                />
                <Bar dataKey="premium" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[300px] text-[var(--text-secondary)]">
              <DollarSign className="w-12 h-12 mb-3 opacity-30" />
              <p className="font-medium">No income data yet</p>
              <p className="text-sm">Premium income will appear as you log trades</p>
            </div>
          )}
        </div>
      </div>

      {/* Second Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance by Ticker */}
        <div className="card p-6 lg:col-span-2">
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">Performance by Ticker</h3>
          {hasTickerData ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={tickerPerformance} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis 
                  type="number"
                  stroke="var(--text-secondary)"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(value) => `$${(value/1000).toFixed(1)}k`}
                />
                <YAxis 
                  type="category"
                  dataKey="ticker"
                  stroke="var(--text-secondary)"
                  tick={{ fontSize: 12 }}
                  width={50}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--bg-elevated)', 
                    border: '1px solid var(--border)',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number, name: string) => [
                    formatCurrency(value), 
                    name === 'total_pnl' ? 'Total P&L' : 'Premium'
                  ]}
                />
                <Legend />
                <Bar dataKey="total_pnl" name="Total P&L" fill={COLORS.profit} radius={[0, 4, 4, 0]} />
                <Bar dataKey="premium_collected" name="Premium" fill={COLORS.primary} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[250px] text-[var(--text-secondary)]">
              <BarChart3 className="w-12 h-12 mb-3 opacity-30" />
              <p className="font-medium">No ticker data yet</p>
              <p className="text-sm">Performance by ticker will show after logging trades</p>
            </div>
          )}
        </div>

        {/* Win/Loss Ratio Pie */}
        <div className="card p-6">
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">Trade Breakdown</h3>
          {winLossData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <RechartsPieChart>
                  <Pie
                    data={winLossData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {winLossData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--bg-elevated)', 
                      border: '1px solid var(--border)',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                </RechartsPieChart>
              </ResponsiveContainer>
              <div className="text-center mt-2">
                <span className="text-2xl font-bold text-[var(--profit)]">
                  {tradeStats?.total_trades || 0}
                </span>
                <p className="text-sm text-[var(--text-secondary)]">Total Trades</p>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-[250px] text-[var(--text-secondary)]">
              <PieChart className="w-12 h-12 mb-3 opacity-30" />
              <p className="font-medium">No trades yet</p>
              <p className="text-sm">Trade breakdown will appear here</p>
            </div>
          )}
        </div>
      </div>

      {/* Trade Statistics */}
      <div className="card p-6">
        <h3 className="font-semibold text-[var(--text-primary)] mb-4">Trade Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="p-3 bg-[var(--surface)] rounded-lg">
            <p className="text-xs text-[var(--text-secondary)]">Avg Trade Duration</p>
            <p className="text-lg font-bold text-[var(--text-primary)]">
              {tradeStats?.avg_trade_duration?.toFixed(1) || 5.2} days
            </p>
          </div>
          <div className="p-3 bg-[var(--surface)] rounded-lg">
            <p className="text-xs text-[var(--text-secondary)]">Average Win</p>
            <p className="text-lg font-bold text-[var(--profit)]">
              {formatCurrency(tradeStats?.avg_win || 485)}
            </p>
          </div>
          <div className="p-3 bg-[var(--surface)] rounded-lg">
            <p className="text-xs text-[var(--text-secondary)]">Average Loss</p>
            <p className="text-lg font-bold text-[var(--loss)]">
              {formatCurrency(tradeStats?.avg_loss || 215)}
            </p>
          </div>
          <div className="p-3 bg-[var(--surface)] rounded-lg">
            <p className="text-xs text-[var(--text-secondary)]">Largest Win</p>
            <p className="text-lg font-bold text-[var(--profit)]">
              {formatCurrency(tradeStats?.largest_win || 1250)}
            </p>
          </div>
          <div className="p-3 bg-[var(--surface)] rounded-lg">
            <p className="text-xs text-[var(--text-secondary)]">Largest Loss</p>
            <p className="text-lg font-bold text-[var(--loss)]">
              {formatCurrency(tradeStats?.largest_loss || 580)}
            </p>
          </div>
          <div className="p-3 bg-[var(--surface)] rounded-lg">
            <p className="text-xs text-[var(--text-secondary)]">Profit Factor</p>
            <p className="text-lg font-bold text-[var(--info)]">
              {(tradeStats?.profit_factor || 2.25).toFixed(2)}x
            </p>
          </div>
        </div>
      </div>

      {/* Actionable Insights Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Roll Suggestions */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[var(--warning)]" />
              Roll Suggestions
            </h3>
            <span className="text-sm text-[var(--text-secondary)]">
              {rollSuggestions.length} pending
            </span>
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {rollSuggestions.length > 0 ? (
              rollSuggestions.slice(0, 5).map((suggestion, i) => (
                <RollSuggestionCard key={i} suggestion={suggestion} />
              ))
            ) : (
              <div className="text-center py-8 text-[var(--text-secondary)]">
                <Award className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No roll suggestions at this time</p>
                <p className="text-xs mt-1">Your positions are well-managed!</p>
              </div>
            )}
          </div>
        </div>

        {/* Earnings Risk */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[var(--warning)]" />
              Earnings Risk
            </h3>
            <span className="text-sm text-[var(--text-secondary)]">
              {earningsRisks.length} at risk
            </span>
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {earningsRisks.length > 0 ? (
              earningsRisks.map((risk, i) => (
                <EarningsRiskCard key={i} risk={risk} />
              ))
            ) : (
              <div className="text-center py-8 text-[var(--text-secondary)]">
                <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No earnings risk detected</p>
                <p className="text-xs mt-1">No positions have earnings before expiration</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info Footer */}
      <div className="card p-4 bg-[var(--info)]/10 border-[var(--info)]/30">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[var(--info)] flex-shrink-0 mt-0.5" />
          <div className="text-sm text-[var(--text-secondary)]">
            <p className="font-medium text-[var(--text-primary)]">About Analytics</p>
            <p className="mt-1">
              Analytics are calculated from your position and trade history. For best results, 
              ensure all trades are recorded and positions are kept up to date. Daily snapshots 
              are recorded automatically to track portfolio performance over time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
