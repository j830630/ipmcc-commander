'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Zap, ArrowLeft, Search, Target, AlertTriangle, CheckCircle, XCircle,
  Activity, BarChart3, Shield, RefreshCw, Crosshair, AlertOctagon, Ban,
  Gauge, Waves, Eye, Lock, FileWarning, Building2, Calendar, Globe,
  TrendingUp, TrendingDown, Minus, Clock, DollarSign, Landmark
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface MarketDataInput {
  underlying: string;
  currentPrice: number;
  dayHigh: number;
  dayLow: number;
  prevClose: number;
  zeroGamma: number;
  callWall: number;
  putWall: number;
  netGex: number;
  maxPain: number;
  vannaLevel: number | null;
  vannaFlow: 'supportive' | 'hostile' | 'neutral';
  charmEffect: 'pinning' | 'unpinning' | 'neutral';
  netDelta: 'bullish' | 'bearish' | 'neutral';
  volumeDelta: number;
  darkPoolPrints: 'bullish' | 'bearish' | 'mixed' | 'none';
  institutionalFlow: 'accumulation' | 'distribution' | 'neutral';
  vold: number;
  tick: number;
  addLine: 'rising' | 'falling' | 'flat';
  vix: number;
  vixChange: number;
  vix1d: number | null;
  ivRank: number;
}

interface MacroEvent {
  event_type: string;
  ticker?: string;
  date: string;
  days_away: number;
  impact: string;
  description: string;
}

interface SectorAnalysis {
  sector_etf: string;
  sector_name: string;
  sector_change_pct: number;
  spy_change_pct: number;
  relative_strength: number;
  flow_direction: string;
}

interface MacroContext {
  bond_yield_10y: number | null;
  bond_yield_change: number | null;
  vix_level: number;
  vix_regime: string;
  market_trend: string;
}

interface MacroData {
  ticker: string;
  asset_type: string;
  is_mag8: boolean;
  events: MacroEvent[];
  has_binary_event: boolean;
  event_override: string | null;
  sector: SectorAnalysis | null;
  macro: MacroContext;
  mag8_earnings_risk: MacroEvent[] | null;
  macro_adjustment: number;
  macro_warnings: string[];
  macro_status: string;
}

type TradeStatus = 'green_light' | 'caution' | 'no_trade';
type MarketRegime = 'trend_day' | 'mean_reversion' | 'volatility_breakout' | 'choppy_fakeout' | 'gamma_squeeze';
type StructureType = 'put_vertical' | 'call_vertical' | 'put_butterfly' | 'call_butterfly' | 'iron_condor' | 'none';
type Strategy = 'ipmcc' | '112' | 'strangle';

interface Strike {
  price: number;
  type: 'buy' | 'sell';
  optionType: 'call' | 'put';
}

interface TradeStructure {
  type: StructureType;
  name: string;
  strikes: Strike[];
  maxRisk: number;
  maxReward: number;
  breakevens: number[];
  description: string;
}

interface AnalysisResult {
  // Technical Analysis
  technicalStatus: TradeStatus;
  technicalReason: string;
  regime: MarketRegime;
  regimeDescription: string;
  structuralThesis: string;
  direction: 'bullish' | 'bearish' | 'neutral' | 'none';
  structure: TradeStructure | null;
  entryZone: { low: number; high: number };
  profitTarget: number;
  invalidationLevel: number;
  invalidationReason: string;
  volumeDeltaCheck: 'confirming' | 'diverging' | 'neutral';
  gammaWallCheck: 'supportive' | 'resistance' | 'neutral';
  institutionalCheck: 'aligned' | 'opposed' | 'neutral';
  technicalConfidence: number;
  holdTime: string;
  warnings: string[];
  fakeoutRisk: 'low' | 'medium' | 'high';
  
  // Final (after macro validation)
  finalStatus: TradeStatus;
  finalReason: string;
  finalConfidence: number;
  macroOverride: boolean;
}

// ============================================================================
// TECHNICAL ANALYSIS ENGINE
// ============================================================================

function analyzeTechnical(input: MarketDataInput): Omit<AnalysisResult, 'finalStatus' | 'finalReason' | 'finalConfidence' | 'macroOverride'> {
  const warnings: string[] = [];
  const distanceToCallWall = input.callWall - input.currentPrice;
  const distanceToPutWall = input.currentPrice - input.putWall;
  
  // STEP 1: REGIME
  let regime: MarketRegime;
  let regimeDescription = '';
  
  if (input.netGex < -3 && Math.abs(input.volumeDelta) > 1.5) {
    regime = 'trend_day';
    regimeDescription = 'Dealers SHORT gamma + strong flow = TREND DAY. They must chase, amplifying moves.';
  } else if (input.netGex > 4 && input.charmEffect === 'pinning') {
    regime = 'mean_reversion';
    regimeDescription = 'Dealers LONG gamma + charm pinning = MEAN REVERSION. Fades expected.';
  } else if (input.vixChange > 8 || (input.vix1d && input.vix1d > input.vix * 1.1)) {
    regime = 'volatility_breakout';
    regimeDescription = 'VIX expanding = VOLATILITY BREAKOUT. Direction from flow.';
  } else if (input.vannaFlow === 'hostile' && input.charmEffect === 'unpinning') {
    regime = 'gamma_squeeze';
    regimeDescription = 'Vanna hostile + charm unpinning = GAMMA SQUEEZE potential.';
  } else if (Math.abs(input.volumeDelta) < 0.5 && input.addLine === 'flat') {
    regime = 'choppy_fakeout';
    regimeDescription = 'Low conviction + flat breadth = CHOPPY FAKEOUT. NO TRADE.';
  } else {
    regime = 'choppy_fakeout';
    regimeDescription = 'Conflicting signals = unclear regime. NO TRADE stance.';
  }
  
  // STEP 2: FAKEOUT DETECTION
  let fakeoutRisk: 'low' | 'medium' | 'high' = 'low';
  const priceBullish = input.currentPrice > input.prevClose;
  const flowBullish = input.volumeDelta > 0.5;
  const internalsPositive = input.vold > 0.5 && input.tick > 100;
  
  if (priceBullish && !flowBullish) {
    warnings.push('DIVERGENCE: Price up but volume delta negative - potential bull trap');
    fakeoutRisk = 'high';
  }
  if (!priceBullish && flowBullish) {
    warnings.push('DIVERGENCE: Price down but volume delta positive - potential bear trap');
    fakeoutRisk = 'high';
  }
  if (priceBullish && !internalsPositive) {
    warnings.push('INTERNALS LAG: Rally lacks breadth confirmation');
    fakeoutRisk = fakeoutRisk === 'high' ? 'high' : 'medium';
  }
  if (input.darkPoolPrints === 'mixed') {
    warnings.push('DARK POOL: Mixed institutional prints - no clear conviction');
    fakeoutRisk = fakeoutRisk === 'low' ? 'medium' : fakeoutRisk;
  }
  
  // STEP 3: FLOW VALIDATION
  const volumeDeltaCheck: 'confirming' | 'diverging' | 'neutral' = 
    Math.abs(input.volumeDelta) < 0.5 ? 'neutral' :
    (input.volumeDelta > 0 && input.netDelta === 'bullish') || 
    (input.volumeDelta < 0 && input.netDelta === 'bearish') ? 'confirming' : 'diverging';
  
  const gammaWallCheck: 'supportive' | 'resistance' | 'neutral' =
    distanceToCallWall < 20 && input.netGex > 0 ? 'resistance' :
    distanceToPutWall < 20 && input.netGex > 0 ? 'supportive' : 'neutral';
    
  const institutionalCheck: 'aligned' | 'opposed' | 'neutral' =
    input.institutionalFlow === 'neutral' ? 'neutral' :
    (input.institutionalFlow === 'accumulation' && input.netDelta === 'bullish') ||
    (input.institutionalFlow === 'distribution' && input.netDelta === 'bearish') ? 'aligned' : 'opposed';
  
  // STEP 4: TECHNICAL STATUS
  let technicalStatus: TradeStatus;
  let technicalReason = '';
  
  if (regime === 'choppy_fakeout') {
    technicalStatus = 'no_trade';
    technicalReason = 'Choppy/fakeout regime. Capital preservation mode.';
  } else if (fakeoutRisk === 'high') {
    technicalStatus = 'no_trade';
    technicalReason = 'High fakeout risk from flow divergences.';
  } else if (volumeDeltaCheck === 'diverging' && institutionalCheck === 'opposed') {
    technicalStatus = 'no_trade';
    technicalReason = 'Flow divergence + institutional opposition.';
  } else if (fakeoutRisk === 'medium' || volumeDeltaCheck === 'neutral') {
    technicalStatus = 'caution';
    technicalReason = 'Setup present but needs confirmation. Reduce size.';
  } else if (volumeDeltaCheck === 'confirming' && institutionalCheck !== 'opposed') {
    technicalStatus = 'green_light';
    technicalReason = 'Flow confirmed, structure aligned. Executable.';
  } else {
    technicalStatus = 'caution';
    technicalReason = 'Mixed signals. Reduced size recommended.';
  }
  
  // STEP 5: THESIS & DIRECTION
  let structuralThesis = '';
  let direction: 'bullish' | 'bearish' | 'neutral' | 'none' = 'none';
  
  if (technicalStatus !== 'no_trade') {
    if (regime === 'trend_day') {
      if (input.volumeDelta > 0 && input.netDelta === 'bullish') {
        direction = 'bullish';
        structuralThesis = `Trend UP: Dealers short gamma must buy. Target: Call Wall ${input.callWall}.`;
      } else if (input.volumeDelta < 0 && input.netDelta === 'bearish') {
        direction = 'bearish';
        structuralThesis = `Trend DOWN: Dealers short gamma must sell. Target: Put Wall ${input.putWall}.`;
      }
    } else if (regime === 'mean_reversion') {
      if (input.currentPrice > input.zeroGamma + 20) {
        direction = 'bearish';
        structuralThesis = `FADE: Extended above Zero Gamma. Target: ${input.zeroGamma}.`;
      } else if (input.currentPrice < input.zeroGamma - 20) {
        direction = 'bullish';
        structuralThesis = `BUY DIP: Below Zero Gamma. Target: ${input.zeroGamma}.`;
      } else {
        direction = 'neutral';
        structuralThesis = `Range-bound near Zero Gamma (${input.zeroGamma}). Iron Condor zone.`;
      }
    } else if (regime === 'gamma_squeeze') {
      direction = input.currentPrice > input.zeroGamma ? 'bullish' : 'bearish';
      structuralThesis = `Gamma squeeze ${direction}: Vanna + charm creating acceleration.`;
    } else if (regime === 'volatility_breakout') {
      direction = input.volumeDelta > 0 ? 'bullish' : input.volumeDelta < 0 ? 'bearish' : 'neutral';
      structuralThesis = `Vol breakout: Direction from flow = ${direction}.`;
    }
  }
  
  // STEP 6: STRUCTURE
  let structure: TradeStructure | null = null;
  let entryZone = { low: input.currentPrice - 5, high: input.currentPrice + 5 };
  let profitTarget = input.currentPrice;
  let invalidationLevel = input.currentPrice;
  let invalidationReason = '';
  
  if (technicalStatus !== 'no_trade' && direction !== 'none') {
    const atm = Math.round(input.currentPrice / 5) * 5;
    
    if (direction === 'bullish') {
      if (regime === 'trend_day' || regime === 'gamma_squeeze') {
        structure = {
          type: 'call_vertical', name: 'Bull Call Vertical',
          strikes: [
            { price: atm, type: 'buy', optionType: 'call' },
            { price: atm + 10, type: 'sell', optionType: 'call' }
          ],
          maxRisk: 500, maxReward: 500, breakevens: [atm + 5],
          description: 'Defined risk bullish spread.'
        };
        profitTarget = Math.min(input.callWall, atm + 15);
        invalidationLevel = input.zeroGamma - 10;
        invalidationReason = 'Break below Zero Gamma kills bull thesis';
      } else {
        structure = {
          type: 'call_butterfly', name: 'Call Butterfly',
          strikes: [
            { price: atm - 5, type: 'buy', optionType: 'call' },
            { price: atm, type: 'sell', optionType: 'call' },
            { price: atm, type: 'sell', optionType: 'call' },
            { price: atm + 5, type: 'buy', optionType: 'call' }
          ],
          maxRisk: 150, maxReward: 350, breakevens: [atm - 3.5, atm + 3.5],
          description: 'Low cost pinning structure.'
        };
        profitTarget = input.zeroGamma;
        invalidationLevel = input.putWall + 5;
        invalidationReason = 'Break below Put Wall invalidates bounce';
      }
      entryZone = { low: input.currentPrice - 3, high: input.currentPrice + 2 };
    } else if (direction === 'bearish') {
      if (regime === 'trend_day' || regime === 'gamma_squeeze') {
        structure = {
          type: 'put_vertical', name: 'Bear Put Vertical',
          strikes: [
            { price: atm, type: 'buy', optionType: 'put' },
            { price: atm - 10, type: 'sell', optionType: 'put' }
          ],
          maxRisk: 500, maxReward: 500, breakevens: [atm - 5],
          description: 'Defined risk bearish spread.'
        };
        profitTarget = Math.max(input.putWall, atm - 15);
        invalidationLevel = input.zeroGamma + 10;
        invalidationReason = 'Break above Zero Gamma kills bear thesis';
      } else {
        structure = {
          type: 'put_butterfly', name: 'Put Butterfly',
          strikes: [
            { price: atm + 5, type: 'buy', optionType: 'put' },
            { price: atm, type: 'sell', optionType: 'put' },
            { price: atm, type: 'sell', optionType: 'put' },
            { price: atm - 5, type: 'buy', optionType: 'put' }
          ],
          maxRisk: 150, maxReward: 350, breakevens: [atm - 3.5, atm + 3.5],
          description: 'Low cost fade structure.'
        };
        profitTarget = input.zeroGamma;
        invalidationLevel = input.callWall - 5;
        invalidationReason = 'Break above Call Wall invalidates fade';
      }
      entryZone = { low: input.currentPrice - 2, high: input.currentPrice + 3 };
    } else if (direction === 'neutral') {
      structure = {
        type: 'iron_condor', name: 'Iron Condor',
        strikes: [
          { price: input.putWall, type: 'sell', optionType: 'put' },
          { price: input.putWall - 10, type: 'buy', optionType: 'put' },
          { price: input.callWall, type: 'sell', optionType: 'call' },
          { price: input.callWall + 10, type: 'buy', optionType: 'call' }
        ],
        maxRisk: 600, maxReward: 400, breakevens: [input.putWall - 4, input.callWall + 4],
        description: 'Premium collection at GEX walls.'
      };
      profitTarget = input.zeroGamma;
      invalidationLevel = input.putWall - 15;
      invalidationReason = 'Break beyond walls by 15 pts kills range thesis';
    }
  }
  
  // STEP 7: CONFIDENCE
  let conf = 50;
  if (volumeDeltaCheck === 'confirming') conf += 15;
  if (volumeDeltaCheck === 'diverging') conf -= 15;
  if (institutionalCheck === 'aligned') conf += 10;
  if (institutionalCheck === 'opposed') conf -= 15;
  if (fakeoutRisk === 'low') conf += 10;
  if (fakeoutRisk === 'high') conf -= 15;
  if (input.darkPoolPrints === input.netDelta) conf += 5;
  if (input.vannaFlow === 'supportive') conf += 5;
  conf = Math.max(0, Math.min(100, conf));
  
  const holdTime = regime === 'trend_day' ? '1-3 hours' : 
                   regime === 'mean_reversion' ? '30 min - 2 hours' :
                   regime === 'gamma_squeeze' ? '15-45 min' : '1-2 hours';
  
  return {
    technicalStatus, technicalReason: technicalReason, regime, regimeDescription, structuralThesis, direction,
    structure, entryZone, profitTarget, invalidationLevel, invalidationReason,
    volumeDeltaCheck, gammaWallCheck, institutionalCheck,
    technicalConfidence: conf, holdTime, warnings, fakeoutRisk
  };
}

// ============================================================================
// MACRO VALIDATION (Decision Hierarchy)
// ============================================================================

function applyMacroValidation(
  technical: Omit<AnalysisResult, 'finalStatus' | 'finalReason' | 'finalConfidence' | 'macroOverride'>,
  macro: MacroData | null
): AnalysisResult {
  
  // If no macro data, return technical as-is
  if (!macro) {
    return {
      ...technical,
      finalStatus: technical.technicalStatus,
      finalReason: technical.technicalReason,
      finalConfidence: technical.technicalConfidence,
      macroOverride: false
    };
  }
  
  let finalStatus = technical.technicalStatus;
  let finalReason = technical.technicalReason;
  let finalConfidence = technical.technicalConfidence;
  let macroOverride = false;
  
  // TIER 1: BINARY EVENTS (Highest Priority)
  // IF binary event within 0-5 days: Override ALL signals to NO_TRADE
  if (macro.has_binary_event && macro.event_override) {
    finalStatus = 'no_trade';
    finalReason = macro.event_override;
    finalConfidence = 0;
    macroOverride = true;
    
    // Add warning about good technical setup being blocked
    if (technical.technicalStatus === 'green_light') {
      technical.warnings.push(`⚠️ EXCELLENT TECHNICAL SETUP BLOCKED: ${macro.event_override}`);
    }
    
    return {
      ...technical,
      finalStatus,
      finalReason,
      finalConfidence,
      macroOverride
    };
  }
  
  // TIER 2: MACRO TRENDS (Medium Priority)
  // Apply macro adjustment to confidence
  finalConfidence = Math.max(0, Math.min(100, finalConfidence + macro.macro_adjustment));
  
  // Add macro warnings
  macro.macro_warnings.forEach(w => {
    if (!technical.warnings.includes(w)) {
      technical.warnings.push(w);
    }
  });
  
  // Sector underperformance check (for single stocks)
  if (macro.sector && macro.sector.flow_direction === 'outflow') {
    if (finalStatus === 'green_light') {
      finalStatus = 'caution';
      finalReason = `Technical GREEN but sector (${macro.sector.sector_etf}) underperforming. SPECULATIVE.`;
    }
  }
  
  // VIX regime adjustment
  if (macro.macro.vix_regime === 'extreme' && finalStatus === 'green_light') {
    finalStatus = 'caution';
    finalReason = `Technical GREEN but VIX EXTREME (${macro.macro.vix_level}). High uncertainty.`;
    finalConfidence -= 10;
  }
  
  // Market trend divergence
  if (macro.macro.market_trend !== 'neutral') {
    const technicalBullish = technical.direction === 'bullish';
    const marketBullish = macro.macro.market_trend === 'bullish';
    
    if (technicalBullish !== marketBullish && technical.direction !== 'neutral') {
      finalConfidence -= 10;
      technical.warnings.push(`Market trend (${macro.macro.market_trend}) diverges from signal (${technical.direction})`);
    }
  }
  
  // Events approaching (not yet binary but close)
  const approachingEvents = macro.events.filter(e => e.days_away > 5 && e.days_away <= 10);
  if (approachingEvents.length > 0) {
    finalConfidence -= 5;
    approachingEvents.forEach(e => {
      technical.warnings.push(`Approaching: ${e.description}`);
    });
  }
  
  // Re-evaluate status based on adjusted confidence
  if (!macroOverride) {
    if (finalConfidence < 30) {
      finalStatus = 'no_trade';
      finalReason = `Confidence too low (${finalConfidence}%) after macro adjustment.`;
    } else if (finalConfidence < 50 && finalStatus === 'green_light') {
      finalStatus = 'caution';
      finalReason = technical.technicalReason + ' [Reduced by macro headwinds]';
    }
  }
  
  return {
    ...technical,
    finalStatus,
    finalReason,
    finalConfidence: Math.round(finalConfidence),
    macroOverride
  };
}

// ============================================================================
// INPUT FORM COMPONENT
// ============================================================================

function DataInputForm({ data, setData, onTickerChange, loading }: {
  data: MarketDataInput;
  setData: (d: MarketDataInput) => void;
  onTickerChange: (t: string) => void;
  loading: boolean;
}) {
  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div><label className="text-xs text-[var(--text-secondary)] mb-1 block">{label}</label>{children}</div>
  );
  
  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h3 className="text-sm font-semibold mb-3 text-emerald-500 flex items-center gap-2"><Gauge className="w-4 h-4" />PRICE & STRUCTURE</h3>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Ticker">
            <select value={data.underlying} onChange={e => onTickerChange(e.target.value)} className="input w-full" disabled={loading}>
              <option value="SPX">SPX</option>
              <option value="SPY">SPY</option>
              <option value="QQQ">QQQ</option>
              <option value="NDX">NDX</option>
              <option value="AAPL">AAPL</option>
              <option value="NVDA">NVDA</option>
              <option value="MSFT">MSFT</option>
              <option value="AMZN">AMZN</option>
              <option value="META">META</option>
              <option value="GOOGL">GOOGL</option>
              <option value="TSLA">TSLA</option>
              <option value="AVGO">AVGO</option>
            </select>
          </Field>
          <Field label="Current Price"><input type="number" value={data.currentPrice || ''} onChange={e => setData({...data, currentPrice: +e.target.value})} className="input w-full" /></Field>
          <Field label="Day High"><input type="number" value={data.dayHigh || ''} onChange={e => setData({...data, dayHigh: +e.target.value})} className="input w-full" /></Field>
          <Field label="Day Low"><input type="number" value={data.dayLow || ''} onChange={e => setData({...data, dayLow: +e.target.value})} className="input w-full" /></Field>
          <Field label="Prev Close"><input type="number" value={data.prevClose || ''} onChange={e => setData({...data, prevClose: +e.target.value})} className="input w-full" /></Field>
        </div>
      </div>
      <div className="card p-4">
        <h3 className="text-sm font-semibold mb-3 text-purple-500 flex items-center gap-2"><Activity className="w-4 h-4" />GEX LEVELS</h3>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Zero Gamma"><input type="number" value={data.zeroGamma || ''} onChange={e => setData({...data, zeroGamma: +e.target.value})} className="input w-full" /></Field>
          <Field label="Call Wall"><input type="number" value={data.callWall || ''} onChange={e => setData({...data, callWall: +e.target.value})} className="input w-full" /></Field>
          <Field label="Put Wall"><input type="number" value={data.putWall || ''} onChange={e => setData({...data, putWall: +e.target.value})} className="input w-full" /></Field>
          <Field label="Net GEX ($B)"><input type="number" step="0.1" value={data.netGex || ''} onChange={e => setData({...data, netGex: +e.target.value})} className="input w-full" /></Field>
          <Field label="Max Pain"><input type="number" value={data.maxPain || ''} onChange={e => setData({...data, maxPain: +e.target.value})} className="input w-full" /></Field>
        </div>
      </div>
      <div className="card p-4">
        <h3 className="text-sm font-semibold mb-3 text-blue-500 flex items-center gap-2"><Waves className="w-4 h-4" />FLOW (Manual)</h3>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Vanna Flow">
            <select value={data.vannaFlow} onChange={e => setData({...data, vannaFlow: e.target.value as any})} className="input w-full">
              <option value="supportive">Supportive</option><option value="hostile">Hostile</option><option value="neutral">Neutral</option>
            </select>
          </Field>
          <Field label="Charm Effect">
            <select value={data.charmEffect} onChange={e => setData({...data, charmEffect: e.target.value as any})} className="input w-full">
              <option value="pinning">Pinning</option><option value="unpinning">Unpinning</option><option value="neutral">Neutral</option>
            </select>
          </Field>
          <Field label="Net Delta">
            <select value={data.netDelta} onChange={e => setData({...data, netDelta: e.target.value as any})} className="input w-full">
              <option value="bullish">Bullish</option><option value="bearish">Bearish</option><option value="neutral">Neutral</option>
            </select>
          </Field>
          <Field label="Vol Delta"><input type="number" step="0.1" value={data.volumeDelta || ''} onChange={e => setData({...data, volumeDelta: +e.target.value})} className="input w-full" placeholder="e.g., 1.5 or -0.8" /></Field>
          <Field label="Dark Pool">
            <select value={data.darkPoolPrints} onChange={e => setData({...data, darkPoolPrints: e.target.value as any})} className="input w-full">
              <option value="bullish">Bullish</option><option value="bearish">Bearish</option><option value="mixed">Mixed</option><option value="none">None</option>
            </select>
          </Field>
          <Field label="Institutional">
            <select value={data.institutionalFlow} onChange={e => setData({...data, institutionalFlow: e.target.value as any})} className="input w-full">
              <option value="accumulation">Accumulation</option><option value="distribution">Distribution</option><option value="neutral">Neutral</option>
            </select>
          </Field>
        </div>
      </div>
      <div className="card p-4">
        <h3 className="text-sm font-semibold mb-3 text-orange-500 flex items-center gap-2"><BarChart3 className="w-4 h-4" />INTERNALS (TOS)</h3>
        <div className="grid grid-cols-3 gap-2">
          <Field label="VOLD"><input type="number" step="0.1" value={data.vold || ''} onChange={e => setData({...data, vold: +e.target.value})} className="input w-full" /></Field>
          <Field label="TICK"><input type="number" value={data.tick || ''} onChange={e => setData({...data, tick: +e.target.value})} className="input w-full" /></Field>
          <Field label="ADD Line">
            <select value={data.addLine} onChange={e => setData({...data, addLine: e.target.value as any})} className="input w-full">
              <option value="rising">Rising</option><option value="falling">Falling</option><option value="flat">Flat</option>
            </select>
          </Field>
        </div>
      </div>
      <div className="card p-4">
        <h3 className="text-sm font-semibold mb-3 text-red-500 flex items-center gap-2"><Activity className="w-4 h-4" />VIX & IV</h3>
        <div className="grid grid-cols-3 gap-2">
          <Field label="VIX"><input type="number" step="0.1" value={data.vix || ''} onChange={e => setData({...data, vix: +e.target.value})} className="input w-full" /></Field>
          <Field label="VIX Change %"><input type="number" step="0.1" value={data.vixChange || ''} onChange={e => setData({...data, vixChange: +e.target.value})} className="input w-full" /></Field>
          <Field label="IV Rank"><input type="number" value={data.ivRank || ''} onChange={e => setData({...data, ivRank: +e.target.value})} className="input w-full" /></Field>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MACRO PANEL COMPONENT
// ============================================================================

function MacroPanel({ macro, loading }: { macro: MacroData | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="card p-4 flex items-center justify-center">
        <RefreshCw className="w-5 h-5 animate-spin text-primary mr-2" />
        <span className="text-sm">Loading macro data...</span>
      </div>
    );
  }
  
  if (!macro) {
    return (
      <div className="card p-4 text-center text-sm text-[var(--text-secondary)]">
        Macro data unavailable. Proceed with technical analysis only.
      </div>
    );
  }
  
  const statusColors = {
    clear: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500',
    caution: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500',
    high_risk: 'bg-red-500/10 border-red-500/30 text-red-500'
  };
  
  return (
    <div className="space-y-3">
      {/* Status Banner */}
      <div className={`card p-3 border ${statusColors[macro.macro_status as keyof typeof statusColors] || statusColors.caution}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {macro.macro_status === 'clear' && <CheckCircle className="w-5 h-5" />}
            {macro.macro_status === 'caution' && <AlertTriangle className="w-5 h-5" />}
            {macro.macro_status === 'high_risk' && <Ban className="w-5 h-5" />}
            <span className="font-bold">MACRO: {macro.macro_status.toUpperCase().replace('_', ' ')}</span>
          </div>
          <span className="text-sm">{macro.asset_type === 'index' ? 'INDEX' : 'SINGLE STOCK'}</span>
        </div>
        {macro.event_override && (
          <p className="text-sm mt-2 font-medium">{macro.event_override}</p>
        )}
      </div>
      
      {/* Events */}
      {macro.events.length > 0 && (
        <div className="card p-3">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-red-500" />
            Event Horizon
          </h4>
          <div className="space-y-1">
            {macro.events.map((e, i) => (
              <div key={i} className={`flex items-center justify-between text-sm p-2 rounded ${
                e.impact === 'high' ? 'bg-red-500/10' : 'bg-yellow-500/10'
              }`}>
                <span>{e.description}</span>
                <span className={`font-bold ${e.impact === 'high' ? 'text-red-500' : 'text-yellow-500'}`}>
                  {e.days_away}d
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Sector Analysis */}
      {macro.sector && (
        <div className="card p-3">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-500" />
            Sector: {macro.sector.sector_name} ({macro.sector.sector_etf})
          </h4>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="text-center p-2 bg-[var(--surface)] rounded">
              <p className="text-xs text-[var(--text-secondary)]">Sector</p>
              <p className={`font-bold ${macro.sector.sector_change_pct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {macro.sector.sector_change_pct >= 0 ? '+' : ''}{macro.sector.sector_change_pct}%
              </p>
            </div>
            <div className="text-center p-2 bg-[var(--surface)] rounded">
              <p className="text-xs text-[var(--text-secondary)]">SPY</p>
              <p className={`font-bold ${macro.sector.spy_change_pct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {macro.sector.spy_change_pct >= 0 ? '+' : ''}{macro.sector.spy_change_pct}%
              </p>
            </div>
            <div className="text-center p-2 bg-[var(--surface)] rounded">
              <p className="text-xs text-[var(--text-secondary)]">RS</p>
              <p className={`font-bold ${macro.sector.relative_strength >= 1 ? 'text-emerald-500' : 'text-red-500'}`}>
                {macro.sector.relative_strength.toFixed(2)}
              </p>
            </div>
          </div>
          <div className={`mt-2 p-2 rounded text-sm text-center font-medium ${
            macro.sector.flow_direction === 'inflow' ? 'bg-emerald-500/10 text-emerald-500' :
            macro.sector.flow_direction === 'outflow' ? 'bg-red-500/10 text-red-500' :
            'bg-[var(--surface)]'
          }`}>
            {macro.sector.flow_direction === 'inflow' ? '↑ Sector LEADING' :
             macro.sector.flow_direction === 'outflow' ? '↓ Sector LAGGING' :
             '→ Sector NEUTRAL'}
          </div>
        </div>
      )}
      
      {/* Macro Context */}
      <div className="card p-3">
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <Globe className="w-4 h-4 text-purple-500" />
          Macro Context
        </h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="p-2 bg-[var(--surface)] rounded">
            <p className="text-xs text-[var(--text-secondary)]">VIX</p>
            <p className={`font-bold ${
              macro.macro.vix_regime === 'low' ? 'text-emerald-500' :
              macro.macro.vix_regime === 'elevated' ? 'text-yellow-500' :
              macro.macro.vix_regime === 'high' ? 'text-orange-500' :
              'text-red-500'
            }`}>
              {macro.macro.vix_level} ({macro.macro.vix_regime})
            </p>
          </div>
          <div className="p-2 bg-[var(--surface)] rounded">
            <p className="text-xs text-[var(--text-secondary)]">Market Trend</p>
            <p className={`font-bold ${
              macro.macro.market_trend === 'bullish' ? 'text-emerald-500' :
              macro.macro.market_trend === 'bearish' ? 'text-red-500' :
              'text-yellow-500'
            }`}>
              {macro.macro.market_trend.toUpperCase()}
            </p>
          </div>
          {macro.macro.bond_yield_10y && (
            <div className="p-2 bg-[var(--surface)] rounded col-span-2">
              <p className="text-xs text-[var(--text-secondary)]">10Y Yield</p>
              <p className="font-bold">
                {macro.macro.bond_yield_10y.toFixed(2)}%
                {macro.macro.bond_yield_change && (
                  <span className={macro.macro.bond_yield_change > 0 ? 'text-red-500 ml-2' : 'text-emerald-500 ml-2'}>
                    ({macro.macro.bond_yield_change > 0 ? '+' : ''}{macro.macro.bond_yield_change.toFixed(2)})
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* Confidence Adjustment */}
      <div className={`card p-3 ${macro.macro_adjustment < 0 ? 'bg-red-500/5' : 'bg-emerald-500/5'}`}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Macro Confidence Adjustment</span>
          <span className={`font-bold ${macro.macro_adjustment < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
            {macro.macro_adjustment > 0 ? '+' : ''}{macro.macro_adjustment} pts
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// RESULTS PANEL COMPONENT
// ============================================================================

function ResultsPanel({ result }: { result: AnalysisResult }) {
  const statusCfg = {
    green_light: { color: 'bg-emerald-500', icon: CheckCircle, text: 'GREEN LIGHT' },
    caution: { color: 'bg-yellow-500', icon: AlertTriangle, text: 'CAUTION' },
    no_trade: { color: 'bg-red-500', icon: Ban, text: 'NO TRADE' }
  };
  const { color, icon: Icon, text } = statusCfg[result.finalStatus];
  
  const chkColor = (v: string) => v === 'confirming' || v === 'aligned' || v === 'supportive' ? 'text-emerald-500' : 
                                  v === 'diverging' || v === 'opposed' || v === 'resistance' ? 'text-red-500' : 'text-yellow-500';

  return (
    <div className="space-y-4">
      {/* Final Status */}
      <div className={`card p-4 ${color}/10 border border-${color.replace('bg-', '')}/30`}>
        <div className="flex items-center justify-between mb-2">
          <div className={`${color} text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold`}>
            <Icon className="w-5 h-5" />{text}
          </div>
          <div className="text-right">
            <p className="text-xs text-[var(--text-secondary)]">Confidence</p>
            <p className={`text-2xl font-bold ${result.finalConfidence >= 60 ? 'text-emerald-500' : result.finalConfidence >= 40 ? 'text-yellow-500' : 'text-red-500'}`}>
              {result.finalConfidence}%
            </p>
          </div>
        </div>
        <p className="text-sm">{result.finalReason}</p>
        {result.macroOverride && (
          <div className="mt-2 p-2 bg-red-500/20 rounded text-sm text-red-400 font-medium">
            ⚠️ MACRO OVERRIDE: Technical signals blocked by event risk
          </div>
        )}
      </div>
      
      {/* Technical vs Final Comparison */}
      {result.technicalStatus !== result.finalStatus && (
        <div className="card p-3 bg-yellow-500/5 border border-yellow-500/20">
          <p className="text-sm">
            <strong>Technical:</strong> <span className={
              result.technicalStatus === 'green_light' ? 'text-emerald-500' :
              result.technicalStatus === 'caution' ? 'text-yellow-500' : 'text-red-500'
            }>{result.technicalStatus.replace('_', ' ').toUpperCase()}</span>
            {' → '}
            <strong>Final:</strong> <span className={
              result.finalStatus === 'green_light' ? 'text-emerald-500' :
              result.finalStatus === 'caution' ? 'text-yellow-500' : 'text-red-500'
            }>{result.finalStatus.replace('_', ' ').toUpperCase()}</span>
            <span className="text-[var(--text-secondary)]"> (macro adjusted)</span>
          </p>
        </div>
      )}

      {/* Regime */}
      <div className="card p-4">
        <h3 className="font-semibold mb-2 flex items-center gap-2"><Zap className="w-5 h-5 text-primary" />1. REGIME</h3>
        <p className="text-lg font-bold text-primary mb-1">{result.regime.replace(/_/g, ' ').toUpperCase()}</p>
        <p className="text-sm text-[var(--text-secondary)]">{result.regimeDescription}</p>
      </div>

      {/* Structure */}
      {result.structure && result.finalStatus !== 'no_trade' && (
        <div className="card p-4 border border-primary/30">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Target className="w-5 h-5 text-primary" />2. TRADE STRUCTURE</h3>
          <p className="text-sm mb-2">{result.structuralThesis}</p>
          <div className={`p-3 rounded-lg mb-3 ${
            result.direction === 'bullish' ? 'bg-emerald-500/10' : 
            result.direction === 'bearish' ? 'bg-red-500/10' : 'bg-blue-500/10'
          }`}>
            <p className="font-bold text-lg">{result.structure.name}</p>
            <p className="text-sm">{result.structure.strikes.map(s => `${s.type.toUpperCase()} ${s.price} ${s.optionType.toUpperCase()}`).join(' / ')}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="p-3 bg-[var(--surface)] rounded-lg"><p className="text-xs text-[var(--text-secondary)]">ENTRY</p><p className="font-bold">${result.entryZone.low}-${result.entryZone.high}</p></div>
            <div className="p-3 bg-emerald-500/10 rounded-lg"><p className="text-xs text-[var(--text-secondary)]">TARGET</p><p className="font-bold text-emerald-500">${result.profitTarget}</p></div>
            <div className="p-3 bg-red-500/10 rounded-lg"><p className="text-xs text-[var(--text-secondary)]">INVALID</p><p className="font-bold text-red-500">${result.invalidationLevel}</p></div>
          </div>
          <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-sm"><strong className="text-red-400">Stop:</strong> {result.invalidationReason}</div>
          <div className="flex items-center gap-4 text-sm mt-2"><span className="text-[var(--text-secondary)]">Hold:</span><span className="font-medium">{result.holdTime}</span></div>
        </div>
      )}

      {/* Flow Check */}
      <div className="card p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Eye className="w-5 h-5 text-primary" />3. FLOW CHECK</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-[var(--surface)] rounded-lg text-center"><p className="text-xs text-[var(--text-secondary)]">Vol Delta</p><p className={`font-bold ${chkColor(result.volumeDeltaCheck)}`}>{result.volumeDeltaCheck.toUpperCase()}</p></div>
          <div className="p-3 bg-[var(--surface)] rounded-lg text-center"><p className="text-xs text-[var(--text-secondary)]">Gamma</p><p className={`font-bold ${chkColor(result.gammaWallCheck)}`}>{result.gammaWallCheck.toUpperCase()}</p></div>
          <div className="p-3 bg-[var(--surface)] rounded-lg text-center"><p className="text-xs text-[var(--text-secondary)]">Institutional</p><p className={`font-bold ${chkColor(result.institutionalCheck)}`}>{result.institutionalCheck.toUpperCase()}</p></div>
        </div>
        <div className={`mt-3 p-2 rounded flex items-center gap-2 ${result.fakeoutRisk === 'low' ? 'bg-emerald-500/10 text-emerald-500' : result.fakeoutRisk === 'medium' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-500'}`}>
          <FileWarning className="w-4 h-4" /><span className="text-sm font-medium">Fakeout Risk: {result.fakeoutRisk.toUpperCase()}</span>
        </div>
      </div>

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="card p-4 bg-yellow-500/10 border border-yellow-500/30">
          <h4 className="font-semibold mb-2 flex items-center gap-2 text-yellow-500"><AlertTriangle className="w-4 h-4" />WARNINGS</h4>
          <ul className="space-y-1">{result.warnings.map((w, i) => <li key={i} className="text-sm flex items-start gap-2"><AlertOctagon className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />{w}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function InstitutionalScanner() {
  const [data, setData] = useState<MarketDataInput>({
    underlying: 'SPX', currentPrice: 0, dayHigh: 0, dayLow: 0, prevClose: 0,
    zeroGamma: 0, callWall: 0, putWall: 0, netGex: 0, maxPain: 0,
    vannaLevel: null, vannaFlow: 'neutral', charmEffect: 'neutral',
    netDelta: 'neutral', volumeDelta: 0, darkPoolPrints: 'none', institutionalFlow: 'neutral',
    vold: 0, tick: 0, addLine: 'flat', vix: 0, vixChange: 0, vix1d: null, ivRank: 50
  });

  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [macroData, setMacroData] = useState<MacroData | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [macroLoading, setMacroLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'input' | 'macro'>('input');

  // Fetch market data from API
  const fetchMarketData = useCallback(async (symbol: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/v1/zero-dte/market-data/${symbol}`);
      if (!response.ok) throw new Error('Failed to fetch market data');
      
      const apiData = await response.json();
      
      setData(prev => ({
        ...prev,
        underlying: symbol,
        currentPrice: apiData.spot_price || 0,
        dayHigh: apiData.spot_price ? apiData.spot_price + 20 : 0,
        dayLow: apiData.spot_price ? apiData.spot_price - 20 : 0,
        prevClose: apiData.spot_price ? apiData.spot_price - (apiData.spot_change || 0) : 0,
        zeroGamma: apiData.key_levels?.zero_gamma || apiData.key_levels?.gamma_flip || apiData.spot_price,
        callWall: apiData.key_levels?.call_wall || (apiData.spot_price + 50),
        putWall: apiData.key_levels?.put_wall || (apiData.spot_price - 50),
        netGex: apiData.regime?.total_gex || 0,
        maxPain: apiData.key_levels?.max_pain || apiData.spot_price,
        vix: apiData.vix_data?.vix || 15,
        vixChange: apiData.vix_data?.vix_change_percent || 0,
        vix1d: apiData.vix_data?.vix1d || null,
      }));
      
      setLastUpdate(new Date().toLocaleTimeString());
      setResult(null);
      
    } catch (err) {
      console.error('Error fetching market data:', err);
      setError('Could not fetch live data. Enter manually or check API connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch macro data
  const fetchMacroData = useCallback(async (symbol: string, price: number, vix?: number) => {
    setMacroLoading(true);
    try {
      const response = await fetch('/api/v1/macro-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ticker: symbol, 
          current_price: price,
          vix: vix || undefined
        })
      });
      
      if (response.ok) {
        const macroResult = await response.json();
        setMacroData(macroResult);
      } else {
        console.log('Macro endpoint not available, proceeding with technical only');
        setMacroData(null);
      }
    } catch (err) {
      console.log('Macro data unavailable:', err);
      setMacroData(null);
    } finally {
      setMacroLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchMarketData(data.underlying);
  }, []); // eslint-disable-line

  // Handle ticker change
  const handleTickerChange = (newTicker: string) => {
    setData(prev => ({ ...prev, underlying: newTicker }));
    fetchMarketData(newTicker);
    setMacroData(null);
    setResult(null);
  };

  const run = async () => {
    setAnalyzing(true);
    
    // Fetch macro data first (pass VIX from scanner input)
    await fetchMacroData(data.underlying, data.currentPrice, data.vix);
    
    setTimeout(() => {
      const technical = analyzeTechnical(data);
      const final = applyMacroValidation(technical, macroData);
      setResult(final);
      setAnalyzing(false);
    }, 500);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <Link href="/zero-dte" className="text-sm text-[var(--text-secondary)] hover:text-primary flex items-center gap-1 mb-2"><ArrowLeft className="w-4 h-4" />Back</Link>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><Shield className="w-6 h-6 text-primary" />Institutional Trade Scanner</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">&quot;The Desk&quot; - Technical + Macro Validation</p>
      </div>

      <div className="card p-4 bg-primary/5 border border-primary/20">
        <div className="flex items-start gap-3">
          <Lock className="w-5 h-5 text-primary mt-0.5" />
          <div className="text-sm">
            <strong className="text-primary">DECISION HIERARCHY:</strong>
            <ol className="mt-1 space-y-1 text-[var(--text-secondary)]">
              <li>1. <strong>Binary Events</strong> (Earnings/FOMC &lt;5d) → Override ALL signals to NO TRADE</li>
              <li>2. <strong>Macro Trends</strong> (Sector rotation, VIX) → Adjust confidence ±15 pts</li>
              <li>3. <strong>Technical/GEX</strong> → Valid only if Tiers 1 & 2 clear</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Inputs */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Search className="w-5 h-5" />Market Data</h2>
            <div className="flex items-center gap-2">
              {lastUpdate && <span className="text-xs text-[var(--text-secondary)]">{lastUpdate}</span>}
              <button 
                onClick={() => fetchMarketData(data.underlying)} 
                disabled={loading}
                className="p-2 rounded hover:bg-[var(--surface)] transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-primary' : 'text-[var(--text-secondary)]'}`} />
              </button>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-2">
            <button onClick={() => setActiveTab('input')} className={`px-3 py-1.5 rounded text-sm ${activeTab === 'input' ? 'bg-primary text-white' : 'bg-[var(--surface)]'}`}>
              Technical Input
            </button>
            <button onClick={() => setActiveTab('macro')} className={`px-3 py-1.5 rounded text-sm flex items-center gap-1 ${activeTab === 'macro' ? 'bg-primary text-white' : 'bg-[var(--surface)]'}`}>
              <Globe className="w-4 h-4" />
              Macro Context
            </button>
          </div>
          
          {error && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm text-yellow-500 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </div>
          )}
          
          {activeTab === 'input' ? (
            <DataInputForm data={data} setData={setData} onTickerChange={handleTickerChange} loading={loading} />
          ) : (
            <MacroPanel macro={macroData} loading={macroLoading} />
          )}
          
          <button onClick={run} disabled={analyzing || loading} className="btn-primary w-full flex items-center justify-center gap-2">
            {analyzing ? <><RefreshCw className="w-4 h-4 animate-spin" />Analyzing...</> : <><Crosshair className="w-4 h-4" />Generate Trade Brief</>}
          </button>
          
          <div className="p-3 bg-[var(--surface)] rounded-lg text-xs text-[var(--text-secondary)]">
            <strong>Auto:</strong> Price, GEX, VIX, Macro events, Sector RS<br/>
            <strong>Manual:</strong> Vanna/Charm, Flow, Dark Pool, VOLD/TICK
          </div>
        </div>
        
        {/* Right Column: Results */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Target className="w-5 h-5" />Trade Brief</h2>
          {result ? <ResultsPanel result={result} /> : (
            <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[400px]">
              <Shield className="w-12 h-12 text-[var(--text-secondary)] mb-4" />
              <h3 className="text-lg font-medium mb-2">No Analysis Yet</h3>
              <p className="text-sm text-[var(--text-secondary)]">Enter data and click Generate Trade Brief</p>
              <p className="text-xs text-[var(--text-secondary)] mt-2">Analysis includes: Technical + Macro + Event Risk</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
