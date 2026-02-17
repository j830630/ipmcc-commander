'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  TrendingUp, TrendingDown, Minus, Activity, BarChart3, Target, Shield,
  AlertTriangle, CheckCircle, Clock, DollarSign, Zap, Eye, Calendar,
  ChevronRight, RefreshCw, Globe, Gauge, Waves, Timer, Briefcase,
  Search, BookOpen, FlaskConical, Award, ArrowUpRight, ArrowDownRight
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface MarketSentiment {
  vix: number;
  vixChange: number;
  vixRegime: 'low' | 'elevated' | 'high' | 'extreme';
  spyPrice: number;
  spyChange: number;
  spyChangePct: number;
  qqqPrice: number;
  qqqChange: number;
  qqqChangePct: number;
  iwmPrice: number;
  iwmChange: number;
  iwmChangePct: number;
  marketTrend: 'bullish' | 'bearish' | 'neutral';
  tenYearYield: number | null;
  dxyIndex: number | null;
  // Events
  nextFOMC: string | null;
  daysToFOMC: number | null;
  hasBinaryEvent: boolean;
  eventWarning: string | null;
}

interface PositionSummary {
  openCount: number;
  totalUnrealized: number;
  todayPnL: number;
  expiringSoon: number;
}

interface ScannerAlert {
  ticker: string;
  strategy: string;
  signal: string;
  score: number;
}

// ============================================================================
// COMPONENTS
// ============================================================================

// Market Sentiment Panel (TOP OF PAGE)
function MarketSentimentPanel({ sentiment, loading }: { sentiment: MarketSentiment | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-primary mr-2" />
          <span>Loading market data...</span>
        </div>
      </div>
    );
  }
  
  if (!sentiment) {
    return (
      <div className="card p-6 text-center text-[var(--text-secondary)]">
        Unable to load market sentiment
      </div>
    );
  }
  
  const vixColors = {
    low: { bg: 'bg-emerald-500', text: 'text-emerald-500', label: 'LOW FEAR' },
    elevated: { bg: 'bg-yellow-500', text: 'text-yellow-500', label: 'ELEVATED' },
    high: { bg: 'bg-orange-500', text: 'text-orange-500', label: 'HIGH FEAR' },
    extreme: { bg: 'bg-red-500', text: 'text-red-500', label: 'EXTREME' }
  };
  
  const vixStyle = vixColors[sentiment.vixRegime];
  
  return (
    <div className="card overflow-hidden">
      {/* Header Bar */}
      <div className={`${vixStyle.bg}/10 border-b border-${vixStyle.bg.replace('bg-', '')}/30 px-6 py-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-primary" />
            <span className="font-semibold">Market Sentiment</span>
            <span className="text-xs text-[var(--text-secondary)]">
              {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          {sentiment.hasBinaryEvent && (
            <div className="flex items-center gap-2 bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm">
              <AlertTriangle className="w-4 h-4" />
              {sentiment.eventWarning}
            </div>
          )}
        </div>
      </div>
      
      {/* Main Content */}
      <div className="p-6">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-6">
          {/* VIX - Featured */}
          <div className="col-span-2 lg:col-span-1">
            <div className={`${vixStyle.bg}/10 rounded-xl p-4 border border-${vixStyle.bg.replace('bg-', '')}/30`}>
              <div className="flex items-center gap-2 mb-2">
                <Gauge className="w-4 h-4 text-[var(--text-secondary)]" />
                <span className="text-xs text-[var(--text-secondary)]">VIX</span>
              </div>
              <div className={`text-3xl font-bold ${vixStyle.text}`}>
                {sentiment.vix.toFixed(1)}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className={`text-xs font-medium ${vixStyle.text}`}>{vixStyle.label}</span>
                <span className={`text-xs ${sentiment.vixChange >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {sentiment.vixChange >= 0 ? '+' : ''}{sentiment.vixChange.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
          
          {/* SPY */}
          <div className="text-center p-4 bg-[var(--surface)] rounded-xl">
            <p className="text-xs text-[var(--text-secondary)] mb-1">SPY</p>
            <p className="text-2xl font-bold">${sentiment.spyPrice.toFixed(2)}</p>
            <div className={`flex items-center justify-center gap-1 text-sm ${sentiment.spyChangePct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {sentiment.spyChangePct >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              {sentiment.spyChangePct >= 0 ? '+' : ''}{sentiment.spyChangePct.toFixed(2)}%
            </div>
          </div>
          
          {/* QQQ */}
          <div className="text-center p-4 bg-[var(--surface)] rounded-xl">
            <p className="text-xs text-[var(--text-secondary)] mb-1">QQQ</p>
            <p className="text-2xl font-bold">${sentiment.qqqPrice.toFixed(2)}</p>
            <div className={`flex items-center justify-center gap-1 text-sm ${sentiment.qqqChangePct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {sentiment.qqqChangePct >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              {sentiment.qqqChangePct >= 0 ? '+' : ''}{sentiment.qqqChangePct.toFixed(2)}%
            </div>
          </div>
          
          {/* IWM */}
          <div className="text-center p-4 bg-[var(--surface)] rounded-xl">
            <p className="text-xs text-[var(--text-secondary)] mb-1">IWM</p>
            <p className="text-2xl font-bold">${sentiment.iwmPrice.toFixed(2)}</p>
            <div className={`flex items-center justify-center gap-1 text-sm ${sentiment.iwmChangePct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {sentiment.iwmChangePct >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              {sentiment.iwmChangePct >= 0 ? '+' : ''}{sentiment.iwmChangePct.toFixed(2)}%
            </div>
          </div>
          
          {/* Market Trend */}
          <div className="text-center p-4 bg-[var(--surface)] rounded-xl">
            <p className="text-xs text-[var(--text-secondary)] mb-1">Trend</p>
            <div className={`text-2xl font-bold ${
              sentiment.marketTrend === 'bullish' ? 'text-emerald-500' :
              sentiment.marketTrend === 'bearish' ? 'text-red-500' : 'text-yellow-500'
            }`}>
              {sentiment.marketTrend === 'bullish' ? '↑' : sentiment.marketTrend === 'bearish' ? '↓' : '→'}
            </div>
            <p className="text-xs mt-1 capitalize">{sentiment.marketTrend}</p>
          </div>
          
          {/* FOMC */}
          <div className="text-center p-4 bg-[var(--surface)] rounded-xl">
            <p className="text-xs text-[var(--text-secondary)] mb-1">Next FOMC</p>
            <p className={`text-2xl font-bold ${sentiment.daysToFOMC && sentiment.daysToFOMC <= 7 ? 'text-red-500' : ''}`}>
              {sentiment.daysToFOMC !== null ? `${sentiment.daysToFOMC}d` : 'N/A'}
            </p>
            {sentiment.nextFOMC && (
              <p className="text-xs text-[var(--text-secondary)]">{sentiment.nextFOMC}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Strategy Command Center
function StrategyCommandCenter({ positions }: { positions: PositionSummary }) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <Target className="w-5 h-5 text-primary" />
        Strategy Command Center
      </h2>
      
      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-sm text-[var(--text-secondary)]">Open Positions</p>
          <p className="text-2xl font-bold">{positions.openCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-[var(--text-secondary)]">Unrealized P&L</p>
          <p className={`text-2xl font-bold ${positions.totalUnrealized >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {positions.totalUnrealized >= 0 ? '+' : ''}${positions.totalUnrealized.toFixed(0)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-[var(--text-secondary)]">Today's P&L</p>
          <p className={`text-2xl font-bold ${positions.todayPnL >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {positions.todayPnL >= 0 ? '+' : ''}${positions.todayPnL.toFixed(0)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-[var(--text-secondary)]">Expiring Soon</p>
          <p className={`text-2xl font-bold ${positions.expiringSoon > 0 ? 'text-yellow-500' : ''}`}>
            {positions.expiringSoon}
          </p>
        </div>
      </div>
      
      {/* Strategy Sections */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Long Term Strategies */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold">Long Term Strategies</h3>
          </div>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            IPMCC, 112 Trades, and Strangles for swing positions
          </p>
          <div className="space-y-2">
            <Link href="/scanner" className="flex items-center justify-between p-3 bg-[var(--surface)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors">
              <div className="flex items-center gap-3">
                <Search className="w-4 h-4 text-blue-500" />
                <span>Long Term Scanner</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
            </Link>
            <Link href="/trade-lab" className="flex items-center justify-between p-3 bg-[var(--surface)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors">
              <div className="flex items-center gap-3">
                <FlaskConical className="w-4 h-4 text-purple-500" />
                <span>Trade Lab</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
            </Link>
            <Link href="/positions" className="flex items-center justify-between p-3 bg-[var(--surface)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors">
              <div className="flex items-center gap-3">
                <Briefcase className="w-4 h-4 text-emerald-500" />
                <span>Positions & Journal</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
            </Link>
          </div>
        </div>
        
        {/* 0-DTE Strategies */}
        <div className="card p-5 border-red-500/20">
          <div className="flex items-center gap-2 mb-4">
            <Timer className="w-5 h-5 text-red-500" />
            <h3 className="font-semibold">0-DTE Trading</h3>
            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">The Desk</span>
          </div>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            Intraday defined-risk structures using GEX and flow analysis
          </p>
          <div className="space-y-2">
            <Link href="/zero-dte" className="flex items-center justify-between p-3 bg-red-500/5 rounded-lg hover:bg-red-500/10 transition-colors border border-red-500/20">
              <div className="flex items-center gap-3">
                <Zap className="w-4 h-4 text-red-500" />
                <span>0-DTE Command Center</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
            </Link>
          </div>
          <div className="mt-4 p-3 bg-red-500/10 rounded-lg text-sm">
            <p className="text-red-400 font-medium">⚠️ Remember The Desk Rules:</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">No scalping. No lottos. Defined risk only.</p>
          </div>
        </div>
      </div>
      
      {/* Resources */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Resources</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/guides" className="flex items-center gap-3 p-3 bg-[var(--surface)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors">
            <BookOpen className="w-4 h-4 text-primary" />
            <span>Strategy Guides</span>
          </Link>
          <Link href="/changelog" className="flex items-center gap-3 p-3 bg-[var(--surface)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors">
            <Clock className="w-4 h-4 text-[var(--text-secondary)]" />
            <span>Changelog</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

// Scanner Alerts
function ScannerAlerts({ alerts }: { alerts: ScannerAlert[] }) {
  if (alerts.length === 0) return null;
  
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-500" />
          <h3 className="font-semibold">Scanner Alerts</h3>
        </div>
        <Link href="/scanner" className="text-sm text-primary hover:underline">View All</Link>
      </div>
      <div className="space-y-2">
        {alerts.slice(0, 5).map((alert, i) => (
          <div key={i} className="flex items-center justify-between p-3 bg-[var(--surface)] rounded-lg">
            <div className="flex items-center gap-3">
              <span className="font-bold">{alert.ticker}</span>
              <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">{alert.strategy}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-medium ${
                alert.signal === 'BUY' ? 'text-emerald-500' : 
                alert.signal === 'STRONG BUY' ? 'text-emerald-400' : 'text-yellow-500'
              }`}>
                {alert.signal}
              </span>
              <span className="text-sm text-[var(--text-secondary)]">{alert.score}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function Dashboard() {
  const [sentiment, setSentiment] = useState<MarketSentiment | null>(null);
  const [sentimentLoading, setSentimentLoading] = useState(true);
  const [positions, setPositions] = useState<PositionSummary>({
    openCount: 0, totalUnrealized: 0, todayPnL: 0, expiringSoon: 0
  });
  const [alerts, setAlerts] = useState<ScannerAlert[]>([]);
  
  // Fetch market sentiment
  const fetchSentiment = useCallback(async () => {
    setSentimentLoading(true);
    try {
      // Fetch VIX
      const vixRes = await fetch('/api/v1/market/vix');
      const vixData = vixRes.ok ? await vixRes.json() : { vix: 18, vix_change_pct: 0, regime: 'elevated' };
      
      // Fetch SPY
      const spyRes = await fetch('/api/v1/market/quote/SPY');
      const spyData = spyRes.ok ? await spyRes.json() : { price: 590, change: 0, change_pct: 0 };
      
      // Fetch QQQ
      const qqqRes = await fetch('/api/v1/market/quote/QQQ');
      const qqqData = qqqRes.ok ? await qqqRes.json() : { price: 515, change: 0, change_pct: 0 };
      
      // Fetch IWM
      const iwmRes = await fetch('/api/v1/market/quote/IWM');
      const iwmData = iwmRes.ok ? await iwmRes.json() : { price: 225, change: 0, change_pct: 0 };
      
      // Calculate market trend
      const avgChange = (spyData.change_pct + qqqData.change_pct + iwmData.change_pct) / 3;
      const marketTrend = avgChange > 0.5 ? 'bullish' : avgChange < -0.5 ? 'bearish' : 'neutral';
      
      // Check for binary events
      const eventsRes = await fetch('/api/v1/scanner/events/0dte');
      const eventsData = eventsRes.ok ? await eventsRes.json() : { has_binary_event: false };
      
      // FOMC dates
      const fomcDates = ['2026-01-28', '2026-03-18', '2026-04-29', '2026-06-17'];
      const today = new Date();
      let nextFOMC: string | null = null;
      let daysToFOMC: number | null = null;
      
      for (const d of fomcDates) {
        const fomcDate = new Date(d);
        const diff = Math.ceil((fomcDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diff >= 0) {
          nextFOMC = d;
          daysToFOMC = diff;
          break;
        }
      }
      
      setSentiment({
        vix: vixData.vix || 18,
        vixChange: vixData.vix_change_pct || 0,
        vixRegime: vixData.regime || 'elevated',
        spyPrice: spyData.price || 590,
        spyChange: spyData.change || 0,
        spyChangePct: spyData.change_pct || 0,
        qqqPrice: qqqData.price || 515,
        qqqChange: qqqData.change || 0,
        qqqChangePct: qqqData.change_pct || 0,
        iwmPrice: iwmData.price || 225,
        iwmChange: iwmData.change || 0,
        iwmChangePct: iwmData.change_pct || 0,
        marketTrend,
        tenYearYield: null,
        dxyIndex: null,
        nextFOMC,
        daysToFOMC,
        hasBinaryEvent: eventsData.has_binary_event || false,
        eventWarning: eventsData.event_override || null
      });
    } catch (err) {
      console.error('Error fetching sentiment:', err);
      // Set defaults
      setSentiment({
        vix: 18, vixChange: 0, vixRegime: 'elevated',
        spyPrice: 590, spyChange: 0, spyChangePct: 0,
        qqqPrice: 515, qqqChange: 0, qqqChangePct: 0,
        iwmPrice: 225, iwmChange: 0, iwmChangePct: 0,
        marketTrend: 'neutral',
        tenYearYield: null, dxyIndex: null,
        nextFOMC: null, daysToFOMC: null,
        hasBinaryEvent: false, eventWarning: null
      });
    } finally {
      setSentimentLoading(false);
    }
  }, []);
  
  // Fetch positions summary
  const fetchPositions = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/positions/summary');
      if (res.ok) {
        const data = await res.json();
        setPositions(data);
      }
    } catch (err) {
      console.log('Positions API not available');
    }
  }, []);
  
  useEffect(() => {
    fetchSentiment();
    fetchPositions();
    
    // Refresh every 60 seconds
    const interval = setInterval(fetchSentiment, 60000);
    return () => clearInterval(interval);
  }, [fetchSentiment, fetchPositions]);
  
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold">IPMCC Commander</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Institutional-Grade Options Trading System
          </p>
        </div>
        <button onClick={fetchSentiment} className="btn flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>
      
      {/* Market Sentiment - FIRST */}
      <MarketSentimentPanel sentiment={sentiment} loading={sentimentLoading} />
      
      {/* Strategy Command Center */}
      <StrategyCommandCenter positions={positions} />
      
      {/* Scanner Alerts */}
      <ScannerAlerts alerts={alerts} />
    </div>
  );
}
