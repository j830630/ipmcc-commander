'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  DollarSign,
  Globe,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Target,
  Clock,
  BarChart3,
  Activity,
  Shield,
  Zap,
  FileText,
  Eye,
  ChevronDown,
  ChevronUp,
  AlertOctagon,
  Building2,
  Landmark,
  TrendingDown as TrendDownIcon
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

type Direction = 'bullish' | 'bearish' | 'neutral';
type Strategy = 'ipmcc' | '112' | 'strangle';
type Timeframe = 'short' | 'medium' | 'long';

interface Catalyst {
  date: string;
  event: string;
  impact: 'high' | 'medium' | 'low';
  direction: Direction;
  description: string;
}

interface HorizonAnalysis {
  direction: Direction;
  confidence: number;
  keyDriver: string;
  technicalContext: string;
  risks: string[];
  verdict: string;
}

interface TrapAnalysis {
  type: 'bull_trap' | 'bear_trap';
  description: string;
  catalyst: string;
  probability: 'high' | 'medium' | 'low';
}

interface MacroContext {
  sectorRotation: string;
  sectorDirection: Direction;
  bondYieldImpact: string;
  currencyImpact: string;
  flowDirection: 'inflow' | 'outflow' | 'neutral';
}

interface ValuationMetrics {
  currentPE: number;
  historicalPE: number;
  currentPS: number;
  historicalPS: number;
  insiderActivity: 'buying' | 'selling' | 'neutral';
  valuationStatus: 'undervalued' | 'overvalued' | 'fair';
}

interface AnalysisInput {
  ticker: string;
  strategy: Strategy;
  technicalSignal: Direction;
  currentPrice: number;
  // Macro inputs
  sectorRotation: Direction;
  bondYields: 'rising' | 'falling' | 'stable';
  vixLevel: 'low' | 'elevated' | 'high' | 'extreme';
  marketTrend: Direction;
  // Fundamental inputs
  earningsGrowth: 'accelerating' | 'stable' | 'decelerating';
  revenueGrowth: 'accelerating' | 'stable' | 'decelerating';
  marginTrend: 'expanding' | 'stable' | 'compressing';
  insiderActivity: 'buying' | 'selling' | 'neutral';
  // Valuation
  peVsHistorical: 'below' | 'at' | 'above';
  psVsHistorical: 'below' | 'at' | 'above';
  // Catalysts
  daysToEarnings: number | null;
  daysToFOMC: number | null;
  otherCatalysts: string;
}

interface FullAnalysis {
  ticker: string;
  strategy: Strategy;
  timestamp: Date;
  shortTerm: HorizonAnalysis;
  mediumTerm: HorizonAnalysis;
  longTerm: HorizonAnalysis;
  trapAnalysis: TrapAnalysis;
  catalysts: Catalyst[];
  macroContext: MacroContext;
  strategyFit: {
    score: number;
    recommendation: string;
    adjustments: string[];
  };
  finalVerdict: {
    direction: Direction;
    thesis: string;
    invalidationPrice: number;
    confidenceOverall: number;
  };
}

// ============================================================================
// ANALYSIS ENGINE
// ============================================================================

function analyzeMultiHorizon(input: AnalysisInput): FullAnalysis {
  const catalysts: Catalyst[] = [];
  
  // Build catalyst list
  if (input.daysToEarnings !== null && input.daysToEarnings <= 30) {
    catalysts.push({
      date: `${input.daysToEarnings} days`,
      event: 'Earnings Report',
      impact: input.daysToEarnings <= 7 ? 'high' : 'medium',
      direction: input.earningsGrowth === 'accelerating' ? 'bullish' : input.earningsGrowth === 'decelerating' ? 'bearish' : 'neutral',
      description: `Earnings in ${input.daysToEarnings} days. Growth trend: ${input.earningsGrowth}.`
    });
  }
  
  if (input.daysToFOMC !== null && input.daysToFOMC <= 14) {
    catalysts.push({
      date: `${input.daysToFOMC} days`,
      event: 'FOMC Meeting',
      impact: 'high',
      direction: input.bondYields === 'falling' ? 'bullish' : 'bearish',
      description: `Fed meeting in ${input.daysToFOMC} days. Bond yields ${input.bondYields}.`
    });
  }
  
  if (input.otherCatalysts) {
    catalysts.push({
      date: 'Upcoming',
      event: input.otherCatalysts,
      impact: 'medium',
      direction: 'neutral',
      description: input.otherCatalysts
    });
  }
  
  // ===== SHORT TERM ANALYSIS (1-4 Weeks) =====
  let shortDirection: Direction = input.technicalSignal;
  let shortConfidence = 60;
  let shortKeyDriver = 'Technical momentum';
  const shortRisks: string[] = [];
  
  // Catalyst proximity adjustment
  if (input.daysToEarnings !== null && input.daysToEarnings <= 7) {
    shortConfidence -= 15;
    shortRisks.push('Earnings within 7 days - high event risk');
    shortKeyDriver = 'Pre-earnings positioning';
  }
  
  if (input.daysToFOMC !== null && input.daysToFOMC <= 5) {
    shortConfidence -= 10;
    shortRisks.push('FOMC imminent - rate decision volatility');
  }
  
  // VIX adjustment
  if (input.vixLevel === 'extreme') {
    shortConfidence -= 20;
    shortRisks.push('Extreme VIX - unpredictable price action');
  } else if (input.vixLevel === 'high') {
    shortConfidence -= 10;
    shortRisks.push('Elevated VIX - wider ranges expected');
  }
  
  // Technical vs Macro conflict
  if (input.technicalSignal !== input.marketTrend) {
    shortConfidence -= 15;
    shortRisks.push(`Technical ${input.technicalSignal} vs Market ${input.marketTrend} DIVERGENCE`);
  }
  
  const shortTerm: HorizonAnalysis = {
    direction: shortDirection,
    confidence: Math.max(20, Math.min(95, shortConfidence)),
    keyDriver: shortKeyDriver,
    technicalContext: `Technical signal: ${input.technicalSignal.toUpperCase()}. VIX: ${input.vixLevel}.`,
    risks: shortRisks,
    verdict: shortRisks.length > 2 ? 'High uncertainty - reduce position size' : 
             shortConfidence >= 70 ? 'Favorable setup for short-term trade' : 
             'Proceed with caution'
  };
  
  // ===== MEDIUM TERM ANALYSIS (1-6 Months) =====
  let medDirection: Direction = 'neutral';
  let medConfidence = 50;
  let medKeyDriver = 'Sector rotation';
  const medRisks: string[] = [];
  
  // Sector rotation is key for medium term
  if (input.sectorRotation === 'bullish') {
    medDirection = 'bullish';
    medConfidence += 15;
    medKeyDriver = 'Capital flowing INTO sector';
  } else if (input.sectorRotation === 'bearish') {
    medDirection = 'bearish';
    medConfidence += 15;
    medKeyDriver = 'Capital flowing OUT of sector';
  }
  
  // Earnings trend
  if (input.earningsGrowth === 'accelerating') {
    if (medDirection === 'bullish') medConfidence += 15;
    else if (medDirection === 'bearish') medConfidence -= 10;
    else { medDirection = 'bullish'; medConfidence += 10; }
  } else if (input.earningsGrowth === 'decelerating') {
    if (medDirection === 'bearish') medConfidence += 15;
    else if (medDirection === 'bullish') medConfidence -= 10;
    else { medDirection = 'bearish'; medConfidence += 10; }
    medRisks.push('Earnings growth decelerating');
  }
  
  // Margin trend
  if (input.marginTrend === 'compressing') {
    medRisks.push('Margin compression - profitability risk');
    medConfidence -= 10;
  }
  
  // Bond yield impact
  if (input.bondYields === 'rising') {
    medRisks.push('Rising yields pressuring valuations');
    if (medDirection === 'bullish') medConfidence -= 10;
  }
  
  const mediumTerm: HorizonAnalysis = {
    direction: medDirection,
    confidence: Math.max(20, Math.min(95, medConfidence)),
    keyDriver: medKeyDriver,
    technicalContext: `Sector rotation: ${input.sectorRotation}. Earnings: ${input.earningsGrowth}.`,
    risks: medRisks,
    verdict: medDirection === 'bullish' && medConfidence >= 60 ? 'Favorable medium-term outlook' :
             medDirection === 'bearish' && medConfidence >= 60 ? 'Caution - headwinds building' :
             'Mixed signals - monitor sector flows'
  };
  
  // ===== LONG TERM ANALYSIS (1 Year) =====
  let longDirection: Direction = 'neutral';
  let longConfidence = 50;
  let longKeyDriver = 'Valuation mean reversion';
  const longRisks: string[] = [];
  
  // Valuation is key for long term
  if (input.peVsHistorical === 'below' && input.psVsHistorical === 'below') {
    longDirection = 'bullish';
    longConfidence += 20;
    longKeyDriver = 'Trading below historical valuations';
  } else if (input.peVsHistorical === 'above' && input.psVsHistorical === 'above') {
    longDirection = 'bearish';
    longConfidence += 15;
    longKeyDriver = 'Extended valuations need to compress';
    longRisks.push('Valuation multiple contraction risk');
  }
  
  // Insider activity
  if (input.insiderActivity === 'buying') {
    if (longDirection === 'bullish') longConfidence += 10;
    else longConfidence += 5;
  } else if (input.insiderActivity === 'selling') {
    longRisks.push('Insider selling detected');
    if (longDirection === 'bullish') longConfidence -= 10;
  }
  
  // Revenue growth for long term sustainability
  if (input.revenueGrowth === 'decelerating') {
    longRisks.push('Revenue growth slowing - growth story weakening');
    if (longDirection === 'bullish') longConfidence -= 15;
  }
  
  const longTerm: HorizonAnalysis = {
    direction: longDirection,
    confidence: Math.max(20, Math.min(95, longConfidence)),
    keyDriver: longKeyDriver,
    technicalContext: `P/E vs Historical: ${input.peVsHistorical}. Insiders: ${input.insiderActivity}.`,
    risks: longRisks,
    verdict: longDirection === 'bullish' && longConfidence >= 60 ? 'Long-term accumulation zone' :
             longDirection === 'bearish' && longConfidence >= 60 ? 'Avoid long-term positions' :
             'Fair value - no strong edge'
  };
  
  // ===== TRAP ANALYSIS =====
  let trapAnalysis: TrapAnalysis;
  
  if (input.technicalSignal === 'bullish') {
    // Looking for bear trap in bullish setup
    const trapReasons: string[] = [];
    if (input.earningsGrowth === 'decelerating') trapReasons.push('earnings deceleration');
    if (input.marginTrend === 'compressing') trapReasons.push('margin compression');
    if (input.sectorRotation === 'bearish') trapReasons.push('sector outflows');
    if (input.bondYields === 'rising') trapReasons.push('rising rates');
    if (input.insiderActivity === 'selling') trapReasons.push('insider selling');
    
    trapAnalysis = {
      type: 'bear_trap',
      description: trapReasons.length > 0 
        ? `Technical breakout may fail due to: ${trapReasons.join(', ')}`
        : 'No significant macro/fundamental headwinds detected',
      catalyst: input.daysToEarnings !== null && input.daysToEarnings <= 14 
        ? 'Upcoming earnings could trigger reversal' 
        : input.daysToFOMC !== null && input.daysToFOMC <= 7
        ? 'FOMC decision could shift sentiment'
        : 'Monitor sector rotation for early warning',
      probability: trapReasons.length >= 3 ? 'high' : trapReasons.length >= 1 ? 'medium' : 'low'
    };
  } else {
    // Looking for bull trap in bearish setup
    const trapReasons: string[] = [];
    if (input.earningsGrowth === 'accelerating') trapReasons.push('earnings acceleration');
    if (input.marginTrend === 'expanding') trapReasons.push('margin expansion');
    if (input.sectorRotation === 'bullish') trapReasons.push('sector inflows');
    if (input.insiderActivity === 'buying') trapReasons.push('insider buying');
    if (input.peVsHistorical === 'below') trapReasons.push('undervaluation');
    
    trapAnalysis = {
      type: 'bull_trap',
      description: trapReasons.length > 0 
        ? `Technical breakdown may fail due to: ${trapReasons.join(', ')}`
        : 'No significant bullish catalysts detected',
      catalyst: input.daysToEarnings !== null && input.daysToEarnings <= 14 
        ? 'Earnings beat could trigger short squeeze' 
        : 'Watch for sector rotation reversal',
      probability: trapReasons.length >= 3 ? 'high' : trapReasons.length >= 1 ? 'medium' : 'low'
    };
  }
  
  // ===== STRATEGY FIT =====
  let strategyScore = 50;
  const adjustments: string[] = [];
  let strategyRec = '';
  
  if (input.strategy === 'ipmcc') {
    // IPMCC works best in mild bullish to neutral with elevated IV
    if (input.vixLevel === 'elevated' || input.vixLevel === 'high') {
      strategyScore += 15;
    } else if (input.vixLevel === 'low') {
      strategyScore -= 10;
      adjustments.push('Low IV - consider wider strikes or different strategy');
    }
    
    if (shortTerm.direction === 'bullish' && mediumTerm.direction !== 'bearish') {
      strategyScore += 20;
    }
    
    if (input.daysToEarnings !== null && input.daysToEarnings <= 14) {
      adjustments.push('Close or adjust before earnings');
    }
    
    strategyRec = strategyScore >= 65 ? 'IPMCC favorable - good premium environment' :
                  strategyScore >= 45 ? 'IPMCC acceptable - manage aggressively' :
                  'Consider alternative strategy';
                  
  } else if (input.strategy === '112') {
    // 112 works in trending markets with defined risk
    if (shortTerm.direction === mediumTerm.direction && shortTerm.confidence >= 60) {
      strategyScore += 25;
    }
    
    if (input.vixLevel === 'low') {
      adjustments.push('Low IV - favorable for buying spreads');
      strategyScore += 10;
    }
    
    if (trapAnalysis.probability === 'high') {
      strategyScore -= 15;
      adjustments.push('High trap probability - consider reducing size');
    }
    
    strategyRec = strategyScore >= 65 ? '112 favorable - clear directional bias' :
                  strategyScore >= 45 ? '112 acceptable - watch for reversal signals' :
                  'Directional conviction too low for 112';
                  
  } else if (input.strategy === 'strangle') {
    // Strangle works in high IV expecting mean reversion
    if (input.vixLevel === 'high' || input.vixLevel === 'extreme') {
      strategyScore += 25;
    } else if (input.vixLevel === 'low') {
      strategyScore -= 20;
      adjustments.push('Low IV - avoid strangle sells');
    }
    
    if (input.daysToEarnings !== null && input.daysToEarnings <= 7) {
      strategyScore += 15;
      adjustments.push('Pre-earnings IV elevated - favorable for premium selling');
    }
    
    if (shortTerm.direction === 'neutral') {
      strategyScore += 10;
    }
    
    strategyRec = strategyScore >= 65 ? 'Strangle favorable - IV elevated, range-bound expected' :
                  strategyScore >= 45 ? 'Strangle acceptable - size conservatively' :
                  'IV too low or trend too strong for strangle';
  }
  
  // ===== FINAL VERDICT =====
  const horizonAlignment = 
    (shortTerm.direction === mediumTerm.direction ? 1 : 0) +
    (mediumTerm.direction === longTerm.direction ? 1 : 0) +
    (shortTerm.direction === longTerm.direction ? 1 : 0);
  
  const overallDirection: Direction = 
    horizonAlignment >= 2 ? shortTerm.direction :
    shortTerm.confidence > mediumTerm.confidence && shortTerm.confidence > longTerm.confidence ? shortTerm.direction :
    mediumTerm.confidence > longTerm.confidence ? mediumTerm.direction :
    longTerm.direction;
  
  const overallConfidence = Math.round(
    (shortTerm.confidence * 0.4 + mediumTerm.confidence * 0.35 + longTerm.confidence * 0.25) *
    (horizonAlignment >= 2 ? 1.1 : horizonAlignment === 1 ? 0.9 : 0.75)
  );
  
  const thesis = horizonAlignment >= 2 
    ? `All timeframes align ${overallDirection}. ${shortTerm.keyDriver} with ${mediumTerm.keyDriver} support.`
    : `Mixed signals: Short-term ${shortTerm.direction}, Medium-term ${mediumTerm.direction}, Long-term ${longTerm.direction}. Trade the dominant timeframe.`;
  
  const invalidationPrice = overallDirection === 'bullish' 
    ? input.currentPrice * 0.95
    : overallDirection === 'bearish'
    ? input.currentPrice * 1.05
    : input.currentPrice * 0.97;
  
  return {
    ticker: input.ticker,
    strategy: input.strategy,
    timestamp: new Date(),
    shortTerm,
    mediumTerm,
    longTerm,
    trapAnalysis,
    catalysts,
    macroContext: {
      sectorRotation: `Sector rotation: ${input.sectorRotation}`,
      sectorDirection: input.sectorRotation,
      bondYieldImpact: `Bond yields ${input.bondYields} - ${input.bondYields === 'rising' ? 'headwind for growth' : 'supportive'}`,
      currencyImpact: 'Monitor USD strength',
      flowDirection: input.sectorRotation === 'bullish' ? 'inflow' : input.sectorRotation === 'bearish' ? 'outflow' : 'neutral'
    },
    strategyFit: {
      score: Math.max(20, Math.min(95, strategyScore)),
      recommendation: strategyRec,
      adjustments
    },
    finalVerdict: {
      direction: overallDirection,
      thesis,
      invalidationPrice: Math.round(invalidationPrice * 100) / 100,
      confidenceOverall: Math.max(20, Math.min(95, overallConfidence))
    }
  };
}

// ============================================================================
// COMPONENTS
// ============================================================================

function DirectionBadge({ direction, size = 'normal' }: { direction: Direction; size?: 'normal' | 'large' }) {
  const config = {
    bullish: { icon: TrendingUp, color: 'bg-emerald-500', text: 'BULLISH' },
    bearish: { icon: TrendingDown, color: 'bg-red-500', text: 'BEARISH' },
    neutral: { icon: Minus, color: 'bg-yellow-500', text: 'NEUTRAL' }
  };
  const { icon: Icon, color, text } = config[direction];
  const sizeClass = size === 'large' ? 'px-4 py-2 text-base' : 'px-3 py-1 text-sm';
  
  return (
    <div className={`${color} text-white ${sizeClass} rounded-lg flex items-center gap-2 font-bold`}>
      <Icon className={size === 'large' ? 'w-5 h-5' : 'w-4 h-4'} />
      {text}
    </div>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 70 ? 'bg-emerald-500' : value >= 50 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-[var(--surface)] rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-sm font-medium w-12 text-right">{value}%</span>
    </div>
  );
}

function HorizonCard({ title, analysis, icon: Icon, color }: { 
  title: string; 
  analysis: HorizonAnalysis; 
  icon: React.ElementType;
  color: string;
}) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${color}`} />
          <h4 className="font-semibold">{title}</h4>
        </div>
        <DirectionBadge direction={analysis.direction} />
      </div>
      
      <div className="space-y-3">
        <div>
          <p className="text-xs text-[var(--text-secondary)] mb-1">Confidence</p>
          <ConfidenceBar value={analysis.confidence} />
        </div>
        
        <div>
          <p className="text-xs text-[var(--text-secondary)]">Key Driver</p>
          <p className="text-sm font-medium">{analysis.keyDriver}</p>
        </div>
        
        <div>
          <p className="text-xs text-[var(--text-secondary)]">Verdict</p>
          <p className="text-sm">{analysis.verdict}</p>
        </div>
        
        <button onClick={() => setExpanded(!expanded)} className="text-xs text-primary flex items-center gap-1">
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? 'Hide' : 'Show'} Details
        </button>
        
        {expanded && (
          <div className="space-y-2 pt-2 border-t border-[var(--border)]">
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Technical Context</p>
              <p className="text-sm">{analysis.technicalContext}</p>
            </div>
            {analysis.risks.length > 0 && (
              <div>
                <p className="text-xs text-[var(--text-secondary)]">Risks</p>
                <ul className="text-sm space-y-1">
                  {analysis.risks.map((r, i) => (
                    <li key={i} className="flex items-center gap-2 text-yellow-500">
                      <AlertTriangle className="w-3 h-3" />{r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function MacroAnalysis() {
  const [input, setInput] = useState<AnalysisInput>({
    ticker: 'SPY',
    strategy: 'ipmcc',
    technicalSignal: 'bullish',
    currentPrice: 580,
    sectorRotation: 'bullish',
    bondYields: 'stable',
    vixLevel: 'elevated',
    marketTrend: 'bullish',
    earningsGrowth: 'stable',
    revenueGrowth: 'stable',
    marginTrend: 'stable',
    insiderActivity: 'neutral',
    peVsHistorical: 'at',
    psVsHistorical: 'at',
    daysToEarnings: null,
    daysToFOMC: 12,
    otherCatalysts: ''
  });
  
  const [result, setResult] = useState<FullAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const runAnalysis = () => {
    setAnalyzing(true);
    setTimeout(() => {
      setResult(analyzeMultiHorizon(input));
      setAnalyzing(false);
    }, 800);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <Link href="/zero-dte/scanner" className="text-sm text-[var(--text-secondary)] hover:text-primary flex items-center gap-1 mb-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Scanner
        </Link>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Globe className="w-6 h-6 text-primary" />
          Multi-Horizon Macro Analysis
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Validate technical signals against macro, fundamentals, and event catalysts
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Panel */}
        <div className="space-y-4">
          {/* Core Inputs */}
          <div className="card p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              Setup
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Ticker</label>
                <input value={input.ticker} onChange={e => setInput({...input, ticker: e.target.value.toUpperCase()})} className="input w-full" placeholder="SPY, QQQ, AAPL..." />
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Strategy</label>
                <select value={input.strategy} onChange={e => setInput({...input, strategy: e.target.value as Strategy})} className="input w-full">
                  <option value="ipmcc">IPMCC</option>
                  <option value="112">112 Spread</option>
                  <option value="strangle">Strangle</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Technical Signal</label>
                <select value={input.technicalSignal} onChange={e => setInput({...input, technicalSignal: e.target.value as Direction})} className="input w-full">
                  <option value="bullish">Bullish</option>
                  <option value="bearish">Bearish</option>
                  <option value="neutral">Neutral</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Current Price</label>
                <input type="number" value={input.currentPrice} onChange={e => setInput({...input, currentPrice: +e.target.value})} className="input w-full" />
              </div>
            </div>
          </div>

          {/* Macro Inputs */}
          <div className="card p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-500" />
              Macro Context
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Sector Rotation</label>
                <select value={input.sectorRotation} onChange={e => setInput({...input, sectorRotation: e.target.value as Direction})} className="input w-full">
                  <option value="bullish">Inflows (Bullish)</option>
                  <option value="bearish">Outflows (Bearish)</option>
                  <option value="neutral">Neutral</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Bond Yields</label>
                <select value={input.bondYields} onChange={e => setInput({...input, bondYields: e.target.value as any})} className="input w-full">
                  <option value="rising">Rising</option>
                  <option value="stable">Stable</option>
                  <option value="falling">Falling</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)]">VIX Level</label>
                <select value={input.vixLevel} onChange={e => setInput({...input, vixLevel: e.target.value as any})} className="input w-full">
                  <option value="low">Low (&lt;15)</option>
                  <option value="elevated">Elevated (15-20)</option>
                  <option value="high">High (20-30)</option>
                  <option value="extreme">Extreme (&gt;30)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Market Trend</label>
                <select value={input.marketTrend} onChange={e => setInput({...input, marketTrend: e.target.value as Direction})} className="input w-full">
                  <option value="bullish">Bullish</option>
                  <option value="bearish">Bearish</option>
                  <option value="neutral">Neutral/Choppy</option>
                </select>
              </div>
            </div>
          </div>

          {/* Fundamental Inputs */}
          <div className="card p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-500" />
              Fundamentals
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Earnings Growth</label>
                <select value={input.earningsGrowth} onChange={e => setInput({...input, earningsGrowth: e.target.value as any})} className="input w-full text-sm">
                  <option value="accelerating">Accelerating</option>
                  <option value="stable">Stable</option>
                  <option value="decelerating">Decelerating</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Revenue Growth</label>
                <select value={input.revenueGrowth} onChange={e => setInput({...input, revenueGrowth: e.target.value as any})} className="input w-full text-sm">
                  <option value="accelerating">Accelerating</option>
                  <option value="stable">Stable</option>
                  <option value="decelerating">Decelerating</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Margin Trend</label>
                <select value={input.marginTrend} onChange={e => setInput({...input, marginTrend: e.target.value as any})} className="input w-full text-sm">
                  <option value="expanding">Expanding</option>
                  <option value="stable">Stable</option>
                  <option value="compressing">Compressing</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Insider Activity</label>
                <select value={input.insiderActivity} onChange={e => setInput({...input, insiderActivity: e.target.value as any})} className="input w-full text-sm">
                  <option value="buying">Buying</option>
                  <option value="neutral">Neutral</option>
                  <option value="selling">Selling</option>
                </select>
              </div>
            </div>
          </div>

          {/* Valuation */}
          <div className="card p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-yellow-500" />
              Valuation
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-[var(--text-secondary)]">P/E vs Historical</label>
                <select value={input.peVsHistorical} onChange={e => setInput({...input, peVsHistorical: e.target.value as any})} className="input w-full text-sm">
                  <option value="below">Below Average</option>
                  <option value="at">At Average</option>
                  <option value="above">Above Average</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)]">P/S vs Historical</label>
                <select value={input.psVsHistorical} onChange={e => setInput({...input, psVsHistorical: e.target.value as any})} className="input w-full text-sm">
                  <option value="below">Below Average</option>
                  <option value="at">At Average</option>
                  <option value="above">Above Average</option>
                </select>
              </div>
            </div>
          </div>

          {/* Catalysts */}
          <div className="card p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-red-500" />
              Event Horizon
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Days to Earnings (blank if &gt;30)</label>
                <input type="number" value={input.daysToEarnings ?? ''} onChange={e => setInput({...input, daysToEarnings: e.target.value ? +e.target.value : null})} className="input w-full" placeholder="e.g., 7" />
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Days to FOMC (blank if &gt;14)</label>
                <input type="number" value={input.daysToFOMC ?? ''} onChange={e => setInput({...input, daysToFOMC: e.target.value ? +e.target.value : null})} className="input w-full" placeholder="e.g., 5" />
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Other Catalysts</label>
                <input value={input.otherCatalysts} onChange={e => setInput({...input, otherCatalysts: e.target.value})} className="input w-full" placeholder="Product launch, litigation, etc." />
              </div>
            </div>
          </div>

          <button onClick={runAnalysis} disabled={analyzing} className="btn-primary w-full flex items-center justify-center gap-2">
            {analyzing ? <><RefreshCw className="w-4 h-4 animate-spin" />Analyzing...</> : <><Eye className="w-4 h-4" />Run Multi-Horizon Analysis</>}
          </button>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2 space-y-4">
          {result ? (
            <>
              {/* Executive Summary */}
              <div className="card p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Executive Summary: {result.ticker}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        <th className="text-left py-2">Horizon</th>
                        <th className="text-left py-2">Direction</th>
                        <th className="text-left py-2">Confidence</th>
                        <th className="text-left py-2">Key Driver</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-[var(--border)]">
                        <td className="py-2 font-medium">Short Term (Weeks)</td>
                        <td><DirectionBadge direction={result.shortTerm.direction} /></td>
                        <td>{result.shortTerm.confidence}%</td>
                        <td className="text-[var(--text-secondary)]">{result.shortTerm.keyDriver}</td>
                      </tr>
                      <tr className="border-b border-[var(--border)]">
                        <td className="py-2 font-medium">Medium Term (Months)</td>
                        <td><DirectionBadge direction={result.mediumTerm.direction} /></td>
                        <td>{result.mediumTerm.confidence}%</td>
                        <td className="text-[var(--text-secondary)]">{result.mediumTerm.keyDriver}</td>
                      </tr>
                      <tr>
                        <td className="py-2 font-medium">Long Term (Year)</td>
                        <td><DirectionBadge direction={result.longTerm.direction} /></td>
                        <td>{result.longTerm.confidence}%</td>
                        <td className="text-[var(--text-secondary)]">{result.longTerm.keyDriver}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Trap Analysis */}
              <div className={`card p-4 border ${result.trapAnalysis.probability === 'high' ? 'bg-red-500/10 border-red-500/30' : result.trapAnalysis.probability === 'medium' ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <AlertOctagon className={`w-5 h-5 ${result.trapAnalysis.probability === 'high' ? 'text-red-500' : result.trapAnalysis.probability === 'medium' ? 'text-yellow-500' : 'text-emerald-500'}`} />
                  {result.trapAnalysis.type === 'bear_trap' ? 'Bear Trap' : 'Bull Trap'} Analysis
                  <span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold ${result.trapAnalysis.probability === 'high' ? 'bg-red-500/20 text-red-500' : result.trapAnalysis.probability === 'medium' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                    {result.trapAnalysis.probability.toUpperCase()} PROBABILITY
                  </span>
                </h3>
                <p className="text-sm mb-2"><strong>The Trap:</strong> {result.trapAnalysis.description}</p>
                <p className="text-sm"><strong>Catalyst:</strong> {result.trapAnalysis.catalyst}</p>
              </div>

              {/* Strategy Fit */}
              <div className="card p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  Strategy Fit: {result.strategy.toUpperCase()}
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-[var(--text-secondary)] mb-1">Strategy Score</p>
                    <ConfidenceBar value={result.strategyFit.score} />
                  </div>
                  <p className="text-sm font-medium">{result.strategyFit.recommendation}</p>
                  {result.strategyFit.adjustments.length > 0 && (
                    <div>
                      <p className="text-xs text-[var(--text-secondary)]">Adjustments</p>
                      <ul className="text-sm space-y-1">
                        {result.strategyFit.adjustments.map((a, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <AlertTriangle className="w-3 h-3 text-yellow-500" />{a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Horizon Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <HorizonCard title="Short Term (Weeks)" analysis={result.shortTerm} icon={Zap} color="text-blue-500" />
                <HorizonCard title="Medium Term (Months)" analysis={result.mediumTerm} icon={Activity} color="text-purple-500" />
                <HorizonCard title="Long Term (Year)" analysis={result.longTerm} icon={Landmark} color="text-emerald-500" />
              </div>

              {/* Catalysts */}
              {result.catalysts.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-red-500" />
                    Upcoming Catalysts
                  </h3>
                  <div className="space-y-2">
                    {result.catalysts.map((c, i) => (
                      <div key={i} className="flex items-center gap-3 p-2 bg-[var(--surface)] rounded">
                        <div className={`px-2 py-0.5 rounded text-xs font-bold ${c.impact === 'high' ? 'bg-red-500/20 text-red-500' : c.impact === 'medium' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-blue-500/20 text-blue-500'}`}>
                          {c.impact.toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{c.event}</p>
                          <p className="text-xs text-[var(--text-secondary)]">{c.description}</p>
                        </div>
                        <span className="text-xs text-[var(--text-secondary)]">{c.date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Final Verdict */}
              <div className="card p-4 bg-primary/5 border border-primary/30">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  Final Verdict
                </h3>
                <div className="flex items-center gap-4 mb-4">
                  <DirectionBadge direction={result.finalVerdict.direction} size="large" />
                  <div>
                    <p className="text-xs text-[var(--text-secondary)]">Overall Confidence</p>
                    <p className={`text-2xl font-bold ${result.finalVerdict.confidenceOverall >= 70 ? 'text-emerald-500' : result.finalVerdict.confidenceOverall >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                      {result.finalVerdict.confidenceOverall}%
                    </p>
                  </div>
                </div>
                <p className="text-sm mb-3"><strong>Thesis:</strong> {result.finalVerdict.thesis}</p>
                <p className="text-sm text-red-500"><strong>Invalidation:</strong> ${result.finalVerdict.invalidationPrice} - Exit if price crosses this level</p>
              </div>
            </>
          ) : (
            <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[400px]">
              <Globe className="w-12 h-12 text-[var(--text-secondary)] mb-4" />
              <h3 className="font-medium mb-2">Ready for Analysis</h3>
              <p className="text-sm text-[var(--text-secondary)]">Configure inputs and run Multi-Horizon Analysis</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
