'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  LayoutDashboard, 
  TrendingUp, 
  Target, 
  GitBranch, 
  ArrowDownUp,
  Activity,
  Gauge,
  Globe,
  BarChart3,
  AlertTriangle,
  TrendingDown,
  RefreshCw,
  Calendar,
  ChevronRight,
  Plus,
  Clock,
  Zap
} from 'lucide-react';
import { TradingViewChart, TradingViewTickerTape, TradingViewMarketOverview } from '@/components/tradingview-widgets';
import { cn } from '@/lib/utils';

// Strategy types
type StrategyType = 'dashboard' | 'ipmcc' | '112-trade' | 'strangles' | 'credit-spreads';

// Strategy card component
function StrategyCard({ 
  id, 
  name, 
  icon, 
  metric, 
  metricValue, 
  isActive, 
  onClick 
}: {
  id: StrategyType;
  name: string;
  icon: React.ReactNode;
  metric: string;
  metricValue: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-start p-4 rounded-xl border transition-all duration-200 min-w-[160px] ${
        isActive 
          ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20' 
          : 'border-border bg-card hover:border-primary/50 hover:bg-primary/5'
      }`}
    >
      <div className={`p-2 rounded-lg mb-2 ${
        isActive ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
      }`}>
        {icon}
      </div>
      <span className={`font-semibold text-sm ${isActive ? 'text-primary' : 'text-foreground'}`}>
        {name}
      </span>
      <div className="mt-1">
        <span className="text-xs text-muted-foreground">{metric}</span>
        <p className={`text-lg font-mono font-bold ${
          metricValue.startsWith('+') ? 'text-green-500' : 
          metricValue.startsWith('-') ? 'text-red-500' : 'text-foreground'
        }`}>
          {metricValue}
        </p>
      </div>
    </button>
  );
}

// Fear & Greed gauge component
function FearGreedGauge({ score, rating }: { score: number; rating: string }) {
  const getColor = (score: number) => {
    if (score <= 25) return '#ef4444'; // Extreme Fear - Red
    if (score <= 45) return '#f97316'; // Fear - Orange
    if (score <= 55) return '#eab308'; // Neutral - Yellow
    if (score <= 75) return '#84cc16'; // Greed - Light Green
    return '#22c55e'; // Extreme Greed - Green
  };

  const rotation = (score / 100) * 180 - 90; // -90 to 90 degrees

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-16 overflow-hidden">
        {/* Gauge background */}
        <div className="absolute inset-0 rounded-t-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 opacity-30" />
        {/* Needle */}
        <div 
          className="absolute bottom-0 left-1/2 w-1 h-14 bg-white origin-bottom transition-transform duration-500"
          style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
        />
        {/* Center dot */}
        <div className="absolute bottom-0 left-1/2 w-3 h-3 bg-white rounded-full transform -translate-x-1/2 translate-y-1/2" />
      </div>
      <div className="text-center mt-2">
        <p className="text-3xl font-bold" style={{ color: getColor(score) }}>{Math.round(score)}</p>
        <p className="text-sm text-muted-foreground capitalize">{rating}</p>
      </div>
    </div>
  );
}

// Market indicator card
function IndicatorCard({ 
  title, 
  value, 
  change, 
  changePercent, 
  icon,
  interpretation 
}: {
  title: string;
  value: string | number;
  change?: number;
  changePercent?: number;
  icon: React.ReactNode;
  interpretation?: string;
}) {
  const isPositive = (change || 0) >= 0;
  
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{title}</span>
        {icon}
      </div>
      <p className="text-2xl font-mono font-bold">{value}</p>
      {change !== undefined && (
        <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          <span>{isPositive ? '+' : ''}{change?.toFixed(2)} ({changePercent?.toFixed(2)}%)</span>
        </div>
      )}
      {interpretation && (
        <p className="text-xs text-muted-foreground mt-1">{interpretation}</p>
      )}
    </div>
  );
}

// Interfaces for action items
interface RollSuggestion {
  suggestion_type: string;
  urgency: string;
  trigger_reason: string;
  position_id?: string;
  current_strike?: number;
  current_expiration?: string;
  current_dte?: number;
}

interface EarningsRisk {
  ticker: string;
  earnings_date: string;
  days_until_earnings: number;
  risk_level: string;
  position_id: string;
}

// Action Items Widget Component
function ActionItemsWidget({ 
  rollSuggestions, 
  earningsRisks,
  loading 
}: { 
  rollSuggestions: RollSuggestion[];
  earningsRisks: EarningsRisk[];
  loading: boolean;
}) {
  const criticalRolls = rollSuggestions.filter(r => r.urgency === 'critical');
  const highRolls = rollSuggestions.filter(r => r.urgency === 'high');
  const highEarnings = earningsRisks.filter(e => e.risk_level === 'high');

  const totalActions = criticalRolls.length + highRolls.length + highEarnings.length;

  if (loading) {
    return (
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-[var(--warning)]" />
          <h3 className="font-semibold">Action Items</h3>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-12 bg-[var(--surface)] rounded" />
          <div className="h-12 bg-[var(--surface)] rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className={cn(
            "w-5 h-5",
            totalActions > 0 ? "text-[var(--warning)]" : "text-[var(--profit)]"
          )} />
          <h3 className="font-semibold">Action Items</h3>
          {totalActions > 0 && (
            <span className="px-2 py-0.5 bg-[var(--warning)]/20 text-[var(--warning)] text-xs rounded-full font-medium">
              {totalActions}
            </span>
          )}
        </div>
        <Link href="/analytics" className="text-sm text-[var(--info)] hover:underline flex items-center gap-1">
          View All <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {totalActions === 0 ? (
        <div className="text-center py-6 text-[var(--text-secondary)]">
          <div className="w-12 h-12 rounded-full bg-[var(--profit)]/10 flex items-center justify-center mx-auto mb-2">
            <Target className="w-6 h-6 text-[var(--profit)]" />
          </div>
          <p className="font-medium">All Clear!</p>
          <p className="text-sm">No urgent actions needed</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Critical Roll Suggestions */}
          {criticalRolls.map((roll, i) => (
            <Link 
              key={`crit-${i}`}
              href="/analytics"
              className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <div>
                  <p className="text-sm font-medium text-red-400">Roll Now</p>
                  <p className="text-xs text-[var(--text-secondary)]">{roll.trigger_reason}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-red-400" />
            </Link>
          ))}

          {/* High Priority Roll Suggestions */}
          {highRolls.slice(0, 2).map((roll, i) => (
            <Link 
              key={`high-${i}`}
              href="/analytics"
              className="flex items-center justify-between p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg hover:bg-orange-500/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-orange-400" />
                <div>
                  <p className="text-sm font-medium text-orange-400">Roll Soon</p>
                  <p className="text-xs text-[var(--text-secondary)]">{roll.trigger_reason}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-orange-400" />
            </Link>
          ))}

          {/* Earnings Warnings */}
          {highEarnings.slice(0, 2).map((earning, i) => (
            <Link 
              key={`earn-${i}`}
              href="/analytics"
              className="flex items-center justify-between p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-yellow-400" />
                <div>
                  <p className="text-sm font-medium text-yellow-400">{earning.ticker} Earnings</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {earning.earnings_date} ({earning.days_until_earnings} days)
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-yellow-400" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// Quick Trade Widget
function QuickTradeWidget() {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Plus className="w-5 h-5 text-[var(--info)]" />
          <h3 className="font-semibold">Quick Actions</h3>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link 
          href="/trades"
          className="flex flex-col items-center p-4 bg-[var(--surface)] rounded-lg hover:bg-[var(--border)] transition-colors"
        >
          <Plus className="w-6 h-6 text-[var(--profit)] mb-2" />
          <span className="text-sm font-medium">Log Trade</span>
        </Link>
        <Link 
          href="/trade-lab"
          className="flex flex-col items-center p-4 bg-[var(--surface)] rounded-lg hover:bg-[var(--border)] transition-colors"
        >
          <Target className="w-6 h-6 text-[var(--info)] mb-2" />
          <span className="text-sm font-medium">New Setup</span>
        </Link>
        <Link 
          href="/scanner"
          className="flex flex-col items-center p-4 bg-[var(--surface)] rounded-lg hover:bg-[var(--border)] transition-colors"
        >
          <BarChart3 className="w-6 h-6 text-[var(--warning)] mb-2" />
          <span className="text-sm font-medium">Scan</span>
        </Link>
        <Link 
          href="/analytics"
          className="flex flex-col items-center p-4 bg-[var(--surface)] rounded-lg hover:bg-[var(--border)] transition-colors"
        >
          <TrendingUp className="w-6 h-6 text-[var(--secondary)] mb-2" />
          <span className="text-sm font-medium">Analytics</span>
        </Link>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [activeStrategy, setActiveStrategy] = useState<StrategyType>('dashboard');
  const [sentiment, setSentiment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [chartSymbol, setChartSymbol] = useState('SPY');
  const [rollSuggestions, setRollSuggestions] = useState<RollSuggestion[]>([]);
  const [earningsRisks, setEarningsRisks] = useState<EarningsRisk[]>([]);
  const [actionsLoading, setActionsLoading] = useState(true);

  // Fetch sentiment data
  const fetchSentiment = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/sentiment/all');
      const data = await response.json();
      setSentiment(data);
    } catch (error) {
      console.error('Error fetching sentiment:', error);
    }
    setLoading(false);
  };

  // Fetch action items (roll suggestions and earnings risks)
  const fetchActionItems = async () => {
    setActionsLoading(true);
    try {
      const [rollRes, earningsRes] = await Promise.all([
        fetch('/api/v1/analytics/roll-suggestions'),
        fetch('/api/v1/analytics/earnings/portfolio-risk'),
      ]);
      
      const rollData = await rollRes.json();
      const earningsData = await earningsRes.json();
      
      setRollSuggestions(rollData.suggestions || []);
      setEarningsRisks(earningsData.positions_at_risk || []);
    } catch (error) {
      console.error('Error fetching action items:', error);
    }
    setActionsLoading(false);
  };

  useEffect(() => {
    fetchSentiment();
    fetchActionItems();
    // Refresh sentiment every 5 minutes
    const interval = setInterval(fetchSentiment, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const strategies = [
    { id: 'dashboard' as StrategyType, name: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, metric: 'Overview', metricValue: 'Live' },
    { id: 'ipmcc' as StrategyType, name: 'IPMCC', icon: <TrendingUp className="w-5 h-5" />, metric: 'Positions', metricValue: '0' },
    { id: '112-trade' as StrategyType, name: '112 Trades', icon: <Target className="w-5 h-5" />, metric: 'Active', metricValue: '0' },
    { id: 'strangles' as StrategyType, name: 'Strangles', icon: <GitBranch className="w-5 h-5" />, metric: 'Open P/L', metricValue: '$0' },
    { id: 'credit-spreads' as StrategyType, name: 'Credit Spreads', icon: <ArrowDownUp className="w-5 h-5" />, metric: 'Open P/L', metricValue: '$0' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Ticker Tape */}
      <div className="w-full -mx-6 px-6 py-2 bg-card border-b border-border">
        <TradingViewTickerTape />
      </div>

      {/* Strategy Command Center */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Strategy Command Center
        </h2>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {strategies.map((strategy) => (
            <StrategyCard
              key={strategy.id}
              {...strategy}
              isActive={activeStrategy === strategy.id}
              onClick={() => setActiveStrategy(strategy.id)}
            />
          ))}
        </div>
      </div>

      {/* Main Content - Changes based on active strategy */}
      {activeStrategy === 'dashboard' && (
        <>
          {/* Action Items Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ActionItemsWidget 
                rollSuggestions={rollSuggestions}
                earningsRisks={earningsRisks}
                loading={actionsLoading}
              />
            </div>
            <QuickTradeWidget />
          </div>

          {/* Market Sentiment Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Gauge className="w-5 h-5 text-primary" />
                Market Sentiment
              </h2>
              <button 
                onClick={fetchSentiment}
                disabled={loading}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Fear & Greed Index */}
              <div className="card p-4 col-span-1">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Fear & Greed Index</h3>
                {sentiment?.fear_greed?.score != null ? (
                  <FearGreedGauge 
                    score={sentiment?.fear_greed?.score ?? 50} 
                    rating={sentiment?.fear_greed?.rating ?? 'Neutral'} 
                  />
                ) : (
                  <div className="text-center py-4 text-muted-foreground">Loading...</div>
                )}
              </div>

              {/* VIX */}
              <IndicatorCard
                title="VIX (Volatility Index)"
                value={sentiment?.vix?.value?.toFixed(2) || '--'}
                change={sentiment?.vix?.change}
                changePercent={sentiment?.vix?.change_percent}
                icon={<Activity className="w-4 h-4 text-muted-foreground" />}
                interpretation={sentiment?.vix?.interpretation}
              />

              {/* AUD/JPY */}
              <IndicatorCard
                title="AUD/JPY (Risk Sentiment)"
                value={sentiment?.forex?.['AUD/JPY']?.value?.toFixed(4) || '--'}
                change={sentiment?.forex?.['AUD/JPY']?.change}
                changePercent={sentiment?.forex?.['AUD/JPY']?.change_percent}
                icon={<Globe className="w-4 h-4 text-muted-foreground" />}
              />

              {/* DXY */}
              <IndicatorCard
                title="DXY (Dollar Index)"
                value={sentiment?.forex?.['DXY']?.value?.toFixed(2) || '--'}
                change={sentiment?.forex?.['DXY']?.change}
                changePercent={sentiment?.forex?.['DXY']?.change_percent}
                icon={<BarChart3 className="w-4 h-4 text-muted-foreground" />}
              />
            </div>
          </div>

          {/* Market Indices */}
          {sentiment?.indices?.indices && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Market Indices</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(sentiment.indices.indices).map(([symbol, data]: [string, any]) => (
                  <div key={symbol} className="card p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold">{symbol}</span>
                      <span className={`text-sm ${data.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {data.change >= 0 ? '+' : ''}{data.change_percent?.toFixed(2)}%
                      </span>
                    </div>
                    <p className="text-lg font-mono">${data.price?.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">{data.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TradingView Chart */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Chart Analysis
            </h2>
            <TradingViewChart 
              symbol={chartSymbol}
              height={500}
              showSymbolSearch={true}
              onSymbolChange={setChartSymbol}
            />
          </div>

          {/* Market Overview Widget */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Market Overview</h2>
            <TradingViewMarketOverview height={400} />
          </div>
        </>
      )}

      {/* Other strategy views - placeholder */}
      {activeStrategy !== 'dashboard' && (
        <div className="card p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">
            {strategies.find(s => s.id === activeStrategy)?.name} View
          </h2>
          <p className="text-muted-foreground mb-4">
            Click the links in the sidebar to access full strategy features.
          </p>
          <div className="flex gap-4 justify-center">
            <a href="/trade-lab" className="btn-primary">Trade Lab</a>
            <a href="/scanner" className="btn-secondary">Scanner</a>
          </div>
        </div>
      )}
    </div>
  );
}
