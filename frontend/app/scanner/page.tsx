'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Search, ArrowLeft, AlertTriangle, CheckCircle, XCircle, RefreshCw, 
  ChevronDown, ChevronUp, Target, Globe, Play, X, WifiOff, Clock,
  Settings, Filter, Zap, Shield, TrendingUp, Minus, AlertCircle
} from 'lucide-react';

// ============================================================================
// TICKER UNIVERSE
// ============================================================================

const TICKER_UNIVERSE = {
  megaCaps: [
    'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'AVGO', 'BRK.B', 'LLY',
    'JPM', 'V', 'UNH', 'XOM', 'MA', 'JNJ', 'PG', 'COST', 'HD', 'ABBV',
    'WMT', 'NFLX', 'CRM', 'BAC', 'CVX', 'KO', 'MRK', 'PEP', 'AMD', 'TMO',
    'ADBE', 'ORCL', 'ACN', 'LIN', 'MCD', 'CSCO', 'ABT', 'DHR', 'INTC', 'QCOM',
    'WFC', 'PM', 'DIS', 'VZ', 'INTU', 'IBM', 'CMCSA', 'NOW', 'GE', 'CAT'
  ],
  largeCaps: [
    'UBER', 'SQ', 'SHOP', 'SNOW', 'PLTR', 'PANW', 'CRWD', 'DDOG', 'ZS', 'NET',
    'COIN', 'RBLX', 'RIVN', 'LCID', 'ABNB', 'DASH', 'ROKU', 'HOOD', 'SOFI', 'AFRM',
    'MELI', 'SE', 'BABA', 'JD', 'PDD', 'NIO', 'XPEV', 'LI', 'GRAB', 'BIDU',
    'F', 'GM', 'TM', 'OXY', 'DVN', 'MPC', 'VLO', 'PSX', 'EOG', 'SLB',
    'LMT', 'NOC', 'GD', 'BA', 'TDG', 'RTX', 'LHX', 'HWM', 'GS', 'MS'
  ],
  etfs: [
    'SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'VOO', 'XLF', 'XLK', 'XLE', 'XLV',
    'XLI', 'XLY', 'XLP', 'XLU', 'XLRE', 'XLB', 'XLC', 'GLD', 'SLV', 'TLT'
  ]
};

// Sector mapping
const TICKER_SECTORS: Record<string, string> = {
  'AAPL': 'Technology', 'MSFT': 'Technology', 'NVDA': 'Technology', 'AMD': 'Technology',
  'GOOGL': 'Communication', 'META': 'Communication', 'NFLX': 'Communication', 'DIS': 'Communication',
  'AMZN': 'Consumer Disc', 'TSLA': 'Consumer Disc', 'HD': 'Consumer Disc', 'MCD': 'Consumer Disc',
  'JPM': 'Financials', 'V': 'Financials', 'MA': 'Financials', 'BAC': 'Financials', 'GS': 'Financials',
  'UNH': 'Healthcare', 'JNJ': 'Healthcare', 'PFE': 'Healthcare', 'ABBV': 'Healthcare',
  'XOM': 'Energy', 'CVX': 'Energy', 'OXY': 'Energy', 'SLB': 'Energy',
  'PG': 'Consumer Staples', 'KO': 'Consumer Staples', 'PEP': 'Consumer Staples', 'WMT': 'Consumer Staples',
  'CAT': 'Industrials', 'BA': 'Industrials', 'GE': 'Industrials', 'LMT': 'Industrials',
  'SPY': 'Index', 'QQQ': 'Index', 'IWM': 'Index', 'DIA': 'Index',
};

// ============================================================================
// TYPES
// ============================================================================

type Strategy = 'ipmcc' | '112' | 'strangle';
type Signal = 'strong_buy' | 'buy' | 'neutral' | 'avoid' | 'strong_avoid';
type ScanPhase = 'config' | 'scanning' | 'results';

interface ScanConfig {
  strategy: Strategy | 'all';
  categories: ('megaCap' | 'largeCap' | 'etf')[];
  minIVRank: number;
  maxIVRank: number;
  excludeEarningsWithin: number;
}

interface TickerData {
  ticker: string;
  price: number;
  change: number;
  changePct: number;
  ivRank: number | null;
  ivPercentile: number | null;
  sectorRS: number | null;
  sector: string;
  daysToEarnings: number | null;
  hasIVData: boolean;
  hasSectorData: boolean;
  hasEarningsData: boolean;
}

interface StrategyScore {
  signal: Signal;
  score: number;
  reason: string;
  details: string[];
}

interface ScanResult {
  ticker: string;
  category: 'megaCap' | 'largeCap' | 'etf';
  data: TickerData;
  ipmcc: StrategyScore | null;
  t112: StrategyScore | null;
  strangle: StrategyScore | null;
  selectedStrategy: Strategy;
  selectedScore: number;
  selectedSignal: Signal;
  warnings: string[];
  missingData: string[];
}

interface MacroContext {
  vix: number;
  vixRegime: 'low' | 'elevated' | 'high' | 'extreme';
  spyTrend: 'bullish' | 'bearish' | 'neutral';
  spyChange: number;
  daysToFOMC: number | null;
}

// ============================================================================
// API FETCHING
// ============================================================================

async function fetchTickerData(ticker: string): Promise<TickerData> {
  const sector = TICKER_SECTORS[ticker] || 'Unknown';
  
  // Fetch all data in parallel
  const [quoteRes, ivRes, sectorRes, earningsRes] = await Promise.allSettled([
    fetch(`/api/v1/market/quote/${ticker}`),
    fetch(`/api/v1/market/iv/${ticker}`),
    fetch(`/api/v1/market/sector/${ticker}`),
    fetch(`/api/v1/earnings/${ticker}`)
  ]);
  
  // Parse quote (required)
  let price = 0, change = 0, changePct = 0;
  if (quoteRes.status === 'fulfilled' && quoteRes.value.ok) {
    const data = await quoteRes.value.json();
    price = data.price || data.last_price || data.mark || 0;
    change = data.change || data.net_change || 0;
    changePct = data.change_pct || data.percent_change || 0;
  }
  
  // Parse IV (optional)
  let ivRank: number | null = null;
  let ivPercentile: number | null = null;
  let hasIVData = false;
  if (ivRes.status === 'fulfilled' && ivRes.value.ok) {
    const data = await ivRes.value.json();
    ivRank = data.iv_rank ?? data.ivRank ?? null;
    ivPercentile = data.iv_percentile ?? data.ivPercentile ?? null;
    hasIVData = ivRank !== null;
  }
  
  // Parse sector RS (optional)
  let sectorRS: number | null = null;
  let hasSectorData = false;
  if (sectorRes.status === 'fulfilled' && sectorRes.value.ok) {
    const data = await sectorRes.value.json();
    sectorRS = data.relative_strength ?? data.rs ?? null;
    hasSectorData = sectorRS !== null;
  }
  
  // Parse earnings (optional)
  let daysToEarnings: number | null = null;
  let hasEarningsData = false;
  if (earningsRes.status === 'fulfilled' && earningsRes.value.ok) {
    const data = await earningsRes.value.json();
    daysToEarnings = data.days_until ?? data.daysToEarnings ?? null;
    hasEarningsData = true;
  }
  
  return {
    ticker,
    price,
    change,
    changePct,
    ivRank,
    ivPercentile,
    sectorRS,
    sector,
    daysToEarnings,
    hasIVData,
    hasSectorData,
    hasEarningsData
  };
}

async function fetchMacroContext(): Promise<MacroContext> {
  try {
    const [vixRes, spyRes] = await Promise.all([
      fetch('/api/v1/market/vix'),
      fetch('/api/v1/market/quote/SPY')
    ]);
    
    let vix = 18;
    if (vixRes.ok) {
      const data = await vixRes.json();
      vix = data.vix ?? data.last_price ?? 18;
    }
    
    let spyChange = 0;
    if (spyRes.ok) {
      const data = await spyRes.json();
      spyChange = data.change_pct ?? data.percent_change ?? 0;
    }
    
    return {
      vix,
      vixRegime: vix < 15 ? 'low' : vix < 20 ? 'elevated' : vix < 30 ? 'high' : 'extreme',
      spyTrend: spyChange > 0.5 ? 'bullish' : spyChange < -0.5 ? 'bearish' : 'neutral',
      spyChange,
      daysToFOMC: calculateDaysToFOMC()
    };
  } catch {
    return {
      vix: 18,
      vixRegime: 'elevated',
      spyTrend: 'neutral',
      spyChange: 0,
      daysToFOMC: null
    };
  }
}

function calculateDaysToFOMC(): number | null {
  const fomcDates = ['2026-01-28', '2026-03-18', '2026-04-29', '2026-06-17'];
  const today = new Date();
  for (const d of fomcDates) {
    const diff = Math.ceil((new Date(d).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff >= 0) return diff;
  }
  return null;
}

// ============================================================================
// SCORING ENGINE
// ============================================================================

function scoreIPMCC(data: TickerData, macro: MacroContext): StrategyScore {
  const details: string[] = [];
  let score = 50;
  let reason = '';
  
  // IV Rank (critical)
  if (data.ivRank === null) {
    details.push(`⚠️ IV Rank: NO DATA - cannot properly score`);
    reason = 'Missing IV data';
  } else if (data.ivRank >= 40 && data.ivRank <= 70) {
    score += 25;
    details.push(`✓ IV Rank ${data.ivRank} OPTIMAL (40-70): +25 pts`);
    reason = `IV ${data.ivRank} optimal`;
  } else if (data.ivRank > 70) {
    score += 15;
    details.push(`△ IV Rank ${data.ivRank} HIGH: +15 pts`);
    reason = `IV ${data.ivRank} high`;
  } else if (data.ivRank >= 30) {
    score += 8;
    details.push(`○ IV Rank ${data.ivRank} acceptable: +8 pts`);
    reason = `IV ${data.ivRank} ok`;
  } else {
    score -= 20;
    details.push(`✗ IV Rank ${data.ivRank} LOW: -20 pts`);
    reason = `IV ${data.ivRank} low`;
  }
  
  // Sector RS
  if (data.sectorRS === null) {
    details.push(`⚠️ Sector RS: NO DATA`);
  } else if (data.sectorRS >= 1.05) {
    score += 12;
    details.push(`✓ Sector RS ${data.sectorRS.toFixed(2)} strong: +12 pts`);
  } else if (data.sectorRS >= 0.95) {
    score += 5;
    details.push(`○ Sector RS ${data.sectorRS.toFixed(2)} neutral: +5 pts`);
  } else {
    score -= 15;
    details.push(`✗ Sector RS ${data.sectorRS.toFixed(2)} weak: -15 pts`);
  }
  
  // Earnings
  if (data.daysToEarnings !== null && data.daysToEarnings <= 14) {
    score -= 35;
    details.push(`✗ Earnings in ${data.daysToEarnings}d: -35 pts AVOID`);
  } else if (data.daysToEarnings !== null && data.daysToEarnings <= 30) {
    score -= 12;
    details.push(`△ Earnings in ${data.daysToEarnings}d: -12 pts`);
  }
  
  // Market
  if (macro.spyTrend === 'bullish') {
    score += 8;
    details.push(`✓ Market bullish: +8 pts`);
  } else if (macro.spyTrend === 'bearish') {
    score -= 12;
    details.push(`✗ Market bearish: -12 pts`);
  }
  
  // VIX
  if (macro.vixRegime === 'extreme') {
    score -= 20;
    details.push(`✗ VIX extreme: -20 pts`);
  } else if (macro.vixRegime === 'high') {
    score -= 8;
    details.push(`△ VIX high: -8 pts`);
  }
  
  score = Math.max(0, Math.min(100, score));
  return { score, signal: getSignal(score), reason, details };
}

function score112(data: TickerData, macro: MacroContext): StrategyScore {
  const details: string[] = [];
  let score = 50;
  let reason = '';
  
  // IV Rank
  if (data.ivRank === null) {
    details.push(`⚠️ IV Rank: NO DATA`);
    reason = 'Missing IV data';
  } else if (data.ivRank >= 35 && data.ivRank <= 60) {
    score += 22;
    details.push(`✓ IV Rank ${data.ivRank} IDEAL (35-60): +22 pts`);
    reason = `IV ${data.ivRank} ideal`;
  } else if (data.ivRank > 60) {
    score += 12;
    details.push(`△ IV Rank ${data.ivRank} elevated: +12 pts`);
    reason = `IV ${data.ivRank} high`;
  } else if (data.ivRank >= 25) {
    score += 5;
    details.push(`○ IV Rank ${data.ivRank}: +5 pts`);
    reason = `IV ${data.ivRank}`;
  } else {
    score -= 18;
    details.push(`✗ IV Rank ${data.ivRank} low: -18 pts`);
    reason = `IV ${data.ivRank} low`;
  }
  
  // Trend
  if (macro.spyTrend !== 'neutral') {
    score += 18;
    details.push(`✓ Clear ${macro.spyTrend} trend: +18 pts`);
    reason += ` + ${macro.spyTrend}`;
  } else {
    score -= 8;
    details.push(`✗ Neutral trend: -8 pts`);
  }
  
  // Sector alignment
  if (data.sectorRS !== null) {
    if (macro.spyTrend === 'bullish' && data.sectorRS >= 1.0) {
      score += 10;
      details.push(`✓ Sector aligned bullish: +10 pts`);
    } else if (macro.spyTrend === 'bearish' && data.sectorRS < 1.0) {
      score += 10;
      details.push(`✓ Sector aligned bearish: +10 pts`);
    }
  }
  
  // Earnings
  if (data.daysToEarnings !== null && data.daysToEarnings <= 21) {
    score -= 28;
    details.push(`✗ Earnings in ${data.daysToEarnings}d: -28 pts`);
  }
  
  score = Math.max(0, Math.min(100, score));
  return { score, signal: getSignal(score), reason, details };
}

function scoreStrangle(data: TickerData, macro: MacroContext): StrategyScore {
  const details: string[] = [];
  let score = 40;
  let reason = '';
  
  // IV Rank (critical for strangles)
  if (data.ivRank === null) {
    details.push(`⚠️ IV Rank: NO DATA - CRITICAL for strangles`);
    reason = 'Missing IV data';
  } else if (data.ivRank >= 60) {
    score += 38;
    details.push(`✓ IV Rank ${data.ivRank} HIGH (≥60): +38 pts IDEAL`);
    reason = `IV ${data.ivRank} ideal`;
  } else if (data.ivRank >= 50) {
    score += 22;
    details.push(`✓ IV Rank ${data.ivRank} good: +22 pts`);
    reason = `IV ${data.ivRank} good`;
  } else if (data.ivRank >= 40) {
    score += 8;
    details.push(`△ IV Rank ${data.ivRank} marginal: +8 pts`);
    reason = `IV ${data.ivRank} marginal`;
  } else {
    score -= 28;
    details.push(`✗ IV Rank ${data.ivRank} TOO LOW: -28 pts`);
    reason = `IV ${data.ivRank} avoid`;
  }
  
  // Market trend (strangles hate trends)
  if (macro.spyTrend === 'neutral') {
    score += 18;
    details.push(`✓ Neutral market: +18 pts`);
  } else {
    score -= 18;
    details.push(`✗ Trending market: -18 pts`);
  }
  
  // Earnings (never hold through)
  if (data.daysToEarnings !== null && data.daysToEarnings <= 30) {
    score -= 45;
    details.push(`✗ Earnings in ${data.daysToEarnings}d: -45 pts NEVER`);
  }
  
  // VIX extreme
  if (macro.vixRegime === 'extreme') {
    score -= 30;
    details.push(`✗ VIX extreme: -30 pts`);
  }
  
  score = Math.max(0, Math.min(100, score));
  return { score, signal: getSignal(score), reason, details };
}

function getSignal(score: number): Signal {
  if (score >= 78) return 'strong_buy';
  if (score >= 62) return 'buy';
  if (score >= 42) return 'neutral';
  if (score >= 28) return 'avoid';
  return 'strong_avoid';
}

// ============================================================================
// COMPONENTS
// ============================================================================

function ScanConfigPanel({ 
  config, 
  setConfig, 
  onStartScan,
  macro
}: { 
  config: ScanConfig; 
  setConfig: (c: ScanConfig) => void;
  onStartScan: () => void;
  macro: MacroContext | null;
}) {
  const totalTickers = 
    (config.categories.includes('megaCap') ? TICKER_UNIVERSE.megaCaps.length : 0) +
    (config.categories.includes('largeCap') ? TICKER_UNIVERSE.largeCaps.length : 0) +
    (config.categories.includes('etf') ? TICKER_UNIVERSE.etfs.length : 0);
  
  const strategyInfo = {
    ipmcc: {
      name: 'IPMCC (Covered Calls)',
      description: 'Sell covered calls for premium income. Best with IV Rank 40-70.',
      icon: Shield,
      color: 'blue'
    },
    '112': {
      name: '112 Trade',
      description: 'Ratio spread for directional bias with defined risk. Best with clear trends.',
      icon: TrendingUp,
      color: 'purple'
    },
    strangle: {
      name: 'Short Strangle',
      description: 'Sell puts and calls for maximum premium. Requires high IV (60+) and neutral market.',
      icon: Zap,
      color: 'orange'
    },
    all: {
      name: 'All Strategies',
      description: 'Score each ticker for all three strategies and show the best one.',
      icon: Target,
      color: 'green'
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Macro Context */}
      {macro && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-500" />Current Market Context
          </h3>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <p className="text-xs text-gray-500">VIX</p>
              <p className={`text-2xl font-bold ${
                macro.vixRegime === 'low' ? 'text-green-500' :
                macro.vixRegime === 'elevated' ? 'text-yellow-500' :
                macro.vixRegime === 'high' ? 'text-orange-500' : 'text-red-500'
              }`}>{macro.vix.toFixed(1)}</p>
              <p className="text-xs">{macro.vixRegime.toUpperCase()}</p>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <p className="text-xs text-gray-500">SPY Trend</p>
              <p className={`text-2xl font-bold ${
                macro.spyTrend === 'bullish' ? 'text-green-500' :
                macro.spyTrend === 'bearish' ? 'text-red-500' : 'text-yellow-500'
              }`}>
                {macro.spyTrend === 'bullish' ? '↑' : macro.spyTrend === 'bearish' ? '↓' : '→'}
              </p>
              <p className="text-xs capitalize">{macro.spyTrend}</p>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <p className="text-xs text-gray-500">SPY Change</p>
              <p className={`text-2xl font-bold ${macro.spyChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {macro.spyChange >= 0 ? '+' : ''}{macro.spyChange.toFixed(2)}%
              </p>
            </div>
            {macro.daysToFOMC !== null && (
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <p className="text-xs text-gray-500">Next FOMC</p>
                <p className={`text-2xl font-bold ${macro.daysToFOMC <= 7 ? 'text-red-500' : ''}`}>
                  {macro.daysToFOMC}d
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Strategy Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-blue-500" />
          Select Strategy to Scan
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {(['ipmcc', '112', 'strangle', 'all'] as const).map(strat => {
            const info = strategyInfo[strat];
            const Icon = info.icon;
            const isSelected = config.strategy === strat;
            const colorClass = {
              blue: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
              purple: 'border-purple-500 bg-purple-50 dark:bg-purple-900/20',
              orange: 'border-orange-500 bg-orange-50 dark:bg-orange-900/20',
              green: 'border-green-500 bg-green-50 dark:bg-green-900/20'
            }[info.color];
            
            return (
              <button
                key={strat}
                onClick={() => setConfig({ ...config, strategy: strat })}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  isSelected ? colorClass : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Icon className={`w-5 h-5 ${isSelected ? `text-${info.color}-500` : 'text-gray-400'}`} />
                  <span className="font-semibold">{info.name}</span>
                  {isSelected && <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />}
                </div>
                <p className="text-sm text-gray-500">{info.description}</p>
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Category Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Filter className="w-5 h-5 text-blue-500" />
          Select Categories to Scan
        </h3>
        <div className="flex gap-4">
          {[
            { id: 'megaCap', label: 'Mega Caps', count: TICKER_UNIVERSE.megaCaps.length },
            { id: 'largeCap', label: 'Large Caps', count: TICKER_UNIVERSE.largeCaps.length },
            { id: 'etf', label: 'ETFs', count: TICKER_UNIVERSE.etfs.length }
          ].map(cat => {
            const isSelected = config.categories.includes(cat.id as any);
            return (
              <button
                key={cat.id}
                onClick={() => {
                  const newCats = isSelected
                    ? config.categories.filter(c => c !== cat.id)
                    : [...config.categories, cat.id as any];
                  if (newCats.length > 0) {
                    setConfig({ ...config, categories: newCats });
                  }
                }}
                className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                  isSelected 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{cat.label}</span>
                  {isSelected && <CheckCircle className="w-4 h-4 text-green-500" />}
                </div>
                <p className="text-sm text-gray-500">{cat.count} tickers</p>
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-500" />
          Scan Filters (Optional)
        </h3>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <label className="text-sm text-gray-500 block mb-2">Min IV Rank</label>
            <input
              type="number"
              value={config.minIVRank}
              onChange={e => setConfig({ ...config, minIVRank: +e.target.value })}
              className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-700"
              min={0}
              max={100}
            />
            <p className="text-xs text-gray-400 mt-1">0 = no minimum</p>
          </div>
          <div>
            <label className="text-sm text-gray-500 block mb-2">Max IV Rank</label>
            <input
              type="number"
              value={config.maxIVRank}
              onChange={e => setConfig({ ...config, maxIVRank: +e.target.value })}
              className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-700"
              min={0}
              max={100}
            />
            <p className="text-xs text-gray-400 mt-1">100 = no maximum</p>
          </div>
          <div>
            <label className="text-sm text-gray-500 block mb-2">Exclude Earnings Within (days)</label>
            <input
              type="number"
              value={config.excludeEarningsWithin}
              onChange={e => setConfig({ ...config, excludeEarningsWithin: +e.target.value })}
              className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-700"
              min={0}
              max={60}
            />
            <p className="text-xs text-gray-400 mt-1">0 = don't exclude</p>
          </div>
        </div>
      </div>
      
      {/* API Data Notice */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-yellow-800 dark:text-yellow-300">Data Requirements</h4>
            <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
              Accurate scoring requires IV Rank data from the API. If IV data is unavailable, 
              tickers will be marked with a warning and scores may be less reliable.
            </p>
          </div>
        </div>
      </div>
      
      {/* Start Scan Button */}
      <button
        onClick={onStartScan}
        disabled={totalTickers === 0}
        className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white py-4 rounded-lg font-semibold flex items-center justify-center gap-3 text-lg"
      >
        <Play className="w-6 h-6" />
        Start Scan ({totalTickers} tickers)
      </button>
    </div>
  );
}

function SignalBadge({ signal }: { signal: Signal }) {
  const cfg = {
    strong_buy: { bg: 'bg-green-500', label: 'STRONG BUY' },
    buy: { bg: 'bg-green-400', label: 'BUY' },
    neutral: { bg: 'bg-yellow-500', label: 'NEUTRAL' },
    avoid: { bg: 'bg-orange-500', label: 'AVOID' },
    strong_avoid: { bg: 'bg-red-500', label: 'AVOID' }
  };
  const { bg, label } = cfg[signal];
  return <span className={`${bg} text-white text-xs px-2 py-1 rounded font-medium`}>{label}</span>;
}

function ResultRow({ result, strategy, onClick }: { result: ScanResult; strategy: Strategy | 'all'; onClick: () => void }) {
  const displayStrategy = strategy === 'all' ? result.selectedStrategy : strategy;
  const strategyNames: Record<Strategy, string> = { ipmcc: 'IPMCC', '112': '112', strangle: 'Strangle' };
  
  return (
    <tr className="border-b hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer" onClick={onClick}>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <span className="font-bold">{result.ticker}</span>
          {result.missingData.length > 0 && (
            <AlertTriangle className="w-3 h-3 text-yellow-500" title={`Missing: ${result.missingData.join(', ')}`} />
          )}
        </div>
        <div className="text-xs text-gray-500">{result.data.sector}</div>
      </td>
      <td className="py-3 px-4">
        <div>${result.data.price.toFixed(2)}</div>
        <div className={`text-xs ${result.data.changePct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {result.data.changePct >= 0 ? '+' : ''}{result.data.changePct.toFixed(2)}%
        </div>
      </td>
      <td className="py-3 px-4">
        {result.data.ivRank !== null ? (
          <div className="flex items-center gap-2">
            <div className="w-16 h-2 bg-gray-200 rounded-full">
              <div className={`h-full rounded-full ${
                result.data.ivRank >= 50 ? 'bg-purple-500' : result.data.ivRank >= 30 ? 'bg-blue-500' : 'bg-gray-400'
              }`} style={{ width: `${result.data.ivRank}%` }} />
            </div>
            <span className="font-medium">{result.data.ivRank}</span>
          </div>
        ) : (
          <span className="text-yellow-500 text-sm flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />No Data
          </span>
        )}
      </td>
      <td className="py-3 px-4">
        <SignalBadge signal={result.selectedSignal} />
        {strategy === 'all' && (
          <div className="text-xs text-gray-500 mt-1">{strategyNames[displayStrategy]}</div>
        )}
      </td>
      <td className="py-3 px-4">
        <span className={`font-bold text-lg ${
          result.selectedScore >= 62 ? 'text-green-500' : result.selectedScore >= 42 ? 'text-yellow-500' : 'text-red-500'
        }`}>{result.selectedScore}</span>
      </td>
      <td className="py-3 px-4">
        {result.data.daysToEarnings !== null ? (
          <span className={result.data.daysToEarnings <= 14 ? 'text-red-500 font-bold' : 'text-yellow-500'}>
            {result.data.daysToEarnings}d
          </span>
        ) : '-'}
      </td>
    </tr>
  );
}

function DetailModal({ result, onClose }: { result: ScanResult; onClose: () => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black bg-opacity-60" />
      <div 
        className="relative bg-white dark:bg-gray-900 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Missing data warning */}
          {result.missingData.length > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-medium">Missing data: {result.missingData.join(', ')}</span>
              </div>
              <p className="text-sm text-yellow-600 dark:text-yellow-500 mt-1">
                Scores may be less accurate without complete data
              </p>
            </div>
          )}
          
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold">{result.ticker}</h2>
              <p className="text-gray-500">{result.data.sector} • ${result.data.price.toFixed(2)}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Metrics */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-center">
              <div className="text-xs text-gray-500">IV Rank</div>
              <div className={`text-xl font-bold ${result.data.ivRank !== null ? 'text-purple-500' : 'text-yellow-500'}`}>
                {result.data.ivRank ?? 'N/A'}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-center">
              <div className="text-xs text-gray-500">Sector RS</div>
              <div className={`text-xl font-bold ${
                result.data.sectorRS !== null 
                  ? (result.data.sectorRS >= 1 ? 'text-green-500' : 'text-red-500')
                  : 'text-yellow-500'
              }`}>
                {result.data.sectorRS?.toFixed(2) ?? 'N/A'}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-center">
              <div className="text-xs text-gray-500">Earnings</div>
              <div className={`text-xl font-bold ${
                result.data.daysToEarnings !== null && result.data.daysToEarnings <= 14 ? 'text-red-500' : ''
              }`}>
                {result.data.daysToEarnings !== null ? `${result.data.daysToEarnings}d` : '-'}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-center">
              <div className="text-xs text-gray-500">Change</div>
              <div className={`text-xl font-bold ${result.data.changePct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {result.data.changePct >= 0 ? '+' : ''}{result.data.changePct.toFixed(2)}%
              </div>
            </div>
          </div>
          
          {/* Strategy Scores */}
          <div className="space-y-4 mb-6">
            <h3 className="font-semibold text-lg">Strategy Analysis</h3>
            
            {result.ipmcc && (
              <StrategyCard 
                name="IPMCC (Covered Calls)" 
                strategy={result.ipmcc}
                isBest={result.selectedStrategy === 'ipmcc'}
                expanded={expanded === 'ipmcc'}
                onToggle={() => setExpanded(expanded === 'ipmcc' ? null : 'ipmcc')}
              />
            )}
            
            {result.t112 && (
              <StrategyCard 
                name="112 Trade" 
                strategy={result.t112}
                isBest={result.selectedStrategy === '112'}
                expanded={expanded === '112'}
                onToggle={() => setExpanded(expanded === '112' ? null : '112')}
              />
            )}
            
            {result.strangle && (
              <StrategyCard 
                name="Short Strangle" 
                strategy={result.strangle}
                isBest={result.selectedStrategy === 'strangle'}
                expanded={expanded === 'strangle'}
                onToggle={() => setExpanded(expanded === 'strangle' ? null : 'strangle')}
              />
            )}
          </div>
          
          {/* Actions */}
          <div className="flex gap-3">
            <Link 
              href={`/trade-lab?ticker=${result.ticker}&strategy=${result.selectedStrategy}`}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg text-center font-medium"
            >
              Open in Trade Lab
            </Link>
            <button onClick={onClose} className="flex-1 bg-gray-200 dark:bg-gray-700 py-3 rounded-lg font-medium">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StrategyCard({ 
  name, 
  strategy, 
  isBest,
  expanded,
  onToggle
}: { 
  name: string; 
  strategy: StrategyScore; 
  isBest: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`border-2 rounded-lg p-4 ${
      isBest ? 'bg-green-50 dark:bg-green-900/20 border-green-500' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
    }`}>
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <span className="font-bold">{name}</span>
          {isBest && <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded">BEST</span>}
        </div>
        <SignalBadge signal={strategy.signal} />
      </div>
      
      <div className="flex items-center gap-3 mb-2">
        <div className="flex-1 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500" style={{ width: `${strategy.score}%` }} />
        </div>
        <span className="font-bold text-lg w-10">{strategy.score}</span>
      </div>
      
      <p className="text-sm font-medium mb-2">{strategy.reason}</p>
      
      <button onClick={onToggle} className="text-sm text-blue-500 hover:underline">
        {expanded ? '▼ Hide details' : '▶ Show details'}
      </button>
      
      {expanded && (
        <ul className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400">
          {strategy.details.map((d, i) => <li key={i}>{d}</li>)}
        </ul>
      )}
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function LongTermScanner() {
  const [phase, setPhase] = useState<ScanPhase>('config');
  const [config, setConfig] = useState<ScanConfig>({
    strategy: 'all',
    categories: ['megaCap', 'largeCap', 'etf'],
    minIVRank: 0,
    maxIVRank: 100,
    excludeEarningsWithin: 0
  });
  const [results, setResults] = useState<ScanResult[]>([]);
  const [macro, setMacro] = useState<MacroContext | null>(null);
  const [selectedResult, setSelectedResult] = useState<ScanResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [dataStats, setDataStats] = useState({ withIV: 0, withoutIV: 0 });
  
  // Filters for results
  const [signalFilter, setSignalFilter] = useState<'all' | 'buy' | 'avoid'>('all');
  const [sortBy, setSortBy] = useState<'score' | 'ivRank'>('score');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  
  // Load macro on mount
  useEffect(() => {
    fetchMacroContext().then(setMacro);
  }, []);
  
  // Build ticker list based on config
  const tickersToScan = useMemo(() => {
    let tickers: string[] = [];
    if (config.categories.includes('megaCap')) tickers.push(...TICKER_UNIVERSE.megaCaps);
    if (config.categories.includes('largeCap')) tickers.push(...TICKER_UNIVERSE.largeCaps);
    if (config.categories.includes('etf')) tickers.push(...TICKER_UNIVERSE.etfs);
    return tickers;
  }, [config.categories]);
  
  // Run scan
  const runScan = useCallback(async () => {
    if (!macro) return;
    
    setPhase('scanning');
    setProgress(0);
    
    const scanResults: ScanResult[] = [];
    let withIV = 0, withoutIV = 0;
    const batchSize = 5;
    
    for (let i = 0; i < tickersToScan.length; i += batchSize) {
      const batch = tickersToScan.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(async (ticker) => {
          const data = await fetchTickerData(ticker);
          
          // Track IV data availability
          if (data.hasIVData) withIV++;
          else withoutIV++;
          
          // Apply filters
          if (config.minIVRank > 0 && (data.ivRank === null || data.ivRank < config.minIVRank)) {
            return null;
          }
          if (config.maxIVRank < 100 && data.ivRank !== null && data.ivRank > config.maxIVRank) {
            return null;
          }
          if (config.excludeEarningsWithin > 0 && data.daysToEarnings !== null && data.daysToEarnings <= config.excludeEarningsWithin) {
            return null;
          }
          
          // Score strategies
          let ipmcc: StrategyScore | null = null;
          let t112: StrategyScore | null = null;
          let strangle: StrategyScore | null = null;
          
          if (config.strategy === 'all' || config.strategy === 'ipmcc') {
            ipmcc = scoreIPMCC(data, macro);
          }
          if (config.strategy === 'all' || config.strategy === '112') {
            t112 = score112(data, macro);
          }
          if (config.strategy === 'all' || config.strategy === 'strangle') {
            strangle = scoreStrangle(data, macro);
          }
          
          // Determine selected strategy/score
          let selectedStrategy: Strategy;
          let selectedScore: number;
          let selectedSignal: Signal;
          
          if (config.strategy !== 'all') {
            selectedStrategy = config.strategy;
            const strat = config.strategy === 'ipmcc' ? ipmcc : config.strategy === '112' ? t112 : strangle;
            selectedScore = strat!.score;
            selectedSignal = strat!.signal;
          } else {
            const scores = [
              ipmcc && { strategy: 'ipmcc' as Strategy, score: ipmcc.score, signal: ipmcc.signal },
              t112 && { strategy: '112' as Strategy, score: t112.score, signal: t112.signal },
              strangle && { strategy: 'strangle' as Strategy, score: strangle.score, signal: strangle.signal }
            ].filter(Boolean) as { strategy: Strategy; score: number; signal: Signal }[];
            
            scores.sort((a, b) => b.score - a.score);
            selectedStrategy = scores[0].strategy;
            selectedScore = scores[0].score;
            selectedSignal = scores[0].signal;
          }
          
          // Track missing data
          const missingData: string[] = [];
          if (!data.hasIVData) missingData.push('IV Rank');
          if (!data.hasSectorData) missingData.push('Sector RS');
          if (!data.hasEarningsData) missingData.push('Earnings');
          
          // Determine category
          let category: 'megaCap' | 'largeCap' | 'etf' = 'largeCap';
          if (TICKER_UNIVERSE.megaCaps.includes(ticker)) category = 'megaCap';
          else if (TICKER_UNIVERSE.etfs.includes(ticker)) category = 'etf';
          
          return {
            ticker,
            category,
            data,
            ipmcc,
            t112,
            strangle,
            selectedStrategy,
            selectedScore,
            selectedSignal,
            warnings: [],
            missingData
          } as ScanResult;
        })
      );
      
      scanResults.push(...batchResults.filter(Boolean) as ScanResult[]);
      setProgress(Math.round(((i + batchSize) / tickersToScan.length) * 100));
      
      await new Promise(r => setTimeout(r, 100));
    }
    
    setResults(scanResults);
    setDataStats({ withIV, withoutIV });
    setPhase('results');
  }, [tickersToScan, macro, config]);
  
  // Filter & sort results
  const filteredResults = useMemo(() => {
    let filtered = [...results];
    
    if (signalFilter === 'buy') {
      filtered = filtered.filter(r => ['strong_buy', 'buy'].includes(r.selectedSignal));
    } else if (signalFilter === 'avoid') {
      filtered = filtered.filter(r => ['avoid', 'strong_avoid'].includes(r.selectedSignal));
    }
    
    filtered.sort((a, b) => {
      const valA = sortBy === 'score' ? a.selectedScore : (a.data.ivRank ?? 0);
      const valB = sortBy === 'score' ? b.selectedScore : (b.data.ivRank ?? 0);
      return sortDir === 'desc' ? valB - valA : valA - valB;
    });
    
    return filtered;
  }, [results, signalFilter, sortBy, sortDir]);
  
  // Stats
  const stats = {
    total: results.length,
    buySignals: results.filter(r => ['strong_buy', 'buy'].includes(r.selectedSignal)).length,
    avgScore: results.length ? Math.round(results.reduce((s, r) => s + r.selectedScore, 0) / results.length) : 0
  };
  
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <Link href="/" className="text-sm text-gray-500 hover:text-blue-500 flex items-center gap-1 mb-2">
            <ArrowLeft className="w-4 h-4" />Dashboard
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Search className="w-6 h-6 text-blue-500" />Long Term Scanner
          </h1>
          <p className="text-gray-500">Configure and scan for options opportunities</p>
        </div>
        {phase === 'results' && (
          <button
            onClick={() => setPhase('config')}
            className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            New Scan
          </button>
        )}
      </div>
      
      {/* Config Phase */}
      {phase === 'config' && (
        <ScanConfigPanel 
          config={config} 
          setConfig={setConfig} 
          onStartScan={runScan}
          macro={macro}
        />
      )}
      
      {/* Scanning Phase */}
      {phase === 'scanning' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-12 text-center shadow">
          <RefreshCw className="w-12 h-12 mx-auto mb-4 text-blue-500 animate-spin" />
          <h3 className="text-lg font-medium mb-2">Scanning {tickersToScan.length} tickers...</h3>
          <p className="text-gray-500 mb-4">
            Strategy: {config.strategy === 'all' ? 'All Strategies' : config.strategy.toUpperCase()}
          </p>
          <div className="w-64 mx-auto h-3 bg-gray-200 rounded-full">
            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-sm text-gray-500 mt-2">{progress}%</p>
        </div>
      )}
      
      {/* Results Phase */}
      {phase === 'results' && (
        <>
          {/* Data Warning */}
          {dataStats.withoutIV > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                <div>
                  <span className="font-medium text-yellow-800 dark:text-yellow-300">
                    IV Data Unavailable
                  </span>
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">
                    {dataStats.withoutIV} of {dataStats.withIV + dataStats.withoutIV} tickers missing IV Rank data. 
                    Scores for these tickers are based on available data only.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow text-center">
              <div className="text-2xl font-bold text-blue-500">{stats.total}</div>
              <div className="text-xs text-gray-500">Results</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow text-center">
              <div className="text-2xl font-bold text-green-500">{stats.buySignals}</div>
              <div className="text-xs text-gray-500">Buy Signals</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow text-center">
              <div className="text-2xl font-bold text-purple-500">{stats.avgScore}</div>
              <div className="text-xs text-gray-500">Avg Score</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow text-center">
              <div className="text-2xl font-bold">{dataStats.withIV}</div>
              <div className="text-xs text-gray-500">With IV Data</div>
            </div>
          </div>
          
          {/* Filters */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow flex gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Signal</label>
              <select value={signalFilter} onChange={e => setSignalFilter(e.target.value as any)}
                className="border rounded px-3 py-2 bg-white dark:bg-gray-700">
                <option value="all">All</option>
                <option value="buy">Buy Only</option>
                <option value="avoid">Avoid Only</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Sort By</label>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
                className="border rounded px-3 py-2 bg-white dark:bg-gray-700">
                <option value="score">Score</option>
                <option value="ivRank">IV Rank</option>
              </select>
            </div>
            <button onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')} 
              className="mt-5 p-2 bg-gray-100 dark:bg-gray-700 rounded">
              {sortDir === 'desc' ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
          
          {/* Results Table */}
          {filteredResults.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="text-left py-3 px-4">Ticker</th>
                    <th className="text-left py-3 px-4">Price</th>
                    <th className="text-left py-3 px-4">IV Rank</th>
                    <th className="text-left py-3 px-4">Signal</th>
                    <th className="text-left py-3 px-4">Score</th>
                    <th className="text-left py-3 px-4">Earnings</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map(r => (
                    <ResultRow 
                      key={r.ticker} 
                      result={r} 
                      strategy={config.strategy}
                      onClick={() => setSelectedResult(r)} 
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-12 text-center shadow">
              <Search className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">No Results</h3>
              <p className="text-gray-500">No tickers matched your filter criteria</p>
            </div>
          )}
        </>
      )}
      
      {/* Detail Modal */}
      {selectedResult && <DetailModal result={selectedResult} onClose={() => setSelectedResult(null)} />}
    </div>
  );
}
