'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Zap, ArrowLeft, Target, AlertTriangle, CheckCircle, XCircle, Ban,
  Activity, BarChart3, Shield, RefreshCw, Crosshair, AlertOctagon,
  Gauge, Waves, Eye, Lock, FileWarning, Building2, Calendar, Globe,
  TrendingUp, TrendingDown, Minus, Clock, Timer, BookOpen, ClipboardCheck,
  FlaskConical, FileText, Play, Settings, ChevronRight, History, Award
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

type DeskTab = 'scanner' | 'audit' | 'simulator' | 'journal';
type DeskStatus = 'green_light' | 'caution' | 'no_trade';
type MarketRegime = 'trend_day' | 'mean_reversion' | 'volatility_breakout' | 'choppy_fakeout' | 'gamma_squeeze';

interface GEXData {
  zeroGamma: number;
  callWall: number;
  putWall: number;
  netGex: number;
  maxPain: number;
  gexFlip: number;
}

interface FlowData {
  netDelta: 'bullish' | 'bearish' | 'neutral';
  volumeDelta: number;
  vannaFlow: 'supportive' | 'hostile' | 'neutral';
  charmEffect: 'pinning' | 'unpinning' | 'neutral';
  darkPoolPrints: 'bullish' | 'bearish' | 'mixed' | 'none';
  institutionalFlow: 'accumulation' | 'distribution' | 'neutral';
}

interface MarketInternals {
  vold: number;
  tick: number;
  addLine: 'rising' | 'falling' | 'flat';
  vix: number;
  vixChange: number;
}

interface DeskResult {
  status: DeskStatus;
  statusReason: string;
  regime: MarketRegime;
  regimeDescription: string;
  direction: 'bullish' | 'bearish' | 'neutral' | 'none';
  structuralThesis: string;
  structure: string | null;
  strikes: string | null;
  entryZone: { low: number; high: number } | null;
  profitTarget: number | null;
  invalidationLevel: number | null;
  invalidationReason: string | null;
  holdTime: string;
  confidence: number;
  warnings: string[];
  fakeoutRisk: 'low' | 'medium' | 'high';
  macroOverride: boolean;
  macroReason: string | null;
}

interface JournalEntry {
  id: string;
  date: string;
  ticker: string;
  regime: string;
  direction: string;
  structure: string;
  entry: number;
  exit: number | null;
  pnl: number | null;
  followedRules: boolean;
  notes: string;
}

interface AuditRule {
  id: string;
  category: string;
  rule: string;
  passed: boolean | null;
}

// ============================================================================
// AUDIT RULES
// ============================================================================

const DESK_RULES: AuditRule[] = [
  // Pre-Trade Rules
  { id: '1', category: 'Pre-Trade', rule: 'Market open for at least 30 minutes (past 10:00 AM ET)', passed: null },
  { id: '2', category: 'Pre-Trade', rule: 'Checked FOMC/CPI/NFP calendar - no events within 5 days', passed: null },
  { id: '3', category: 'Pre-Trade', rule: 'VIX is not in "extreme" regime (>30)', passed: null },
  { id: '4', category: 'Pre-Trade', rule: 'Identified current regime (trend/mean-reversion/squeeze/choppy)', passed: null },
  { id: '5', category: 'Pre-Trade', rule: 'If regime is "choppy fakeout" → NO TRADE', passed: null },
  // GEX Rules
  { id: '6', category: 'GEX', rule: 'Located Zero Gamma level on chart', passed: null },
  { id: '7', category: 'GEX', rule: 'Identified Call Wall and Put Wall', passed: null },
  { id: '8', category: 'GEX', rule: 'Confirmed Net GEX sign matches regime thesis', passed: null },
  { id: '9', category: 'GEX', rule: 'Price position relative to GEX levels supports direction', passed: null },
  // Flow Confirmation
  { id: '10', category: 'Flow', rule: 'Volume delta confirms directional thesis', passed: null },
  { id: '11', category: 'Flow', rule: 'No divergence between price and volume delta', passed: null },
  { id: '12', category: 'Flow', rule: 'Checked dark pool prints for institutional conviction', passed: null },
  { id: '13', category: 'Flow', rule: 'Vanna/Charm effects support (not contradict) thesis', passed: null },
  // Structure Rules
  { id: '14', category: 'Structure', rule: 'Using defined-risk structure (vertical/butterfly/condor)', passed: null },
  { id: '15', category: 'Structure', rule: 'No naked options or undefined risk', passed: null },
  { id: '16', category: 'Structure', rule: 'Strike selection based on GEX levels', passed: null },
  { id: '17', category: 'Structure', rule: 'Position size is 1-2% of account max', passed: null },
  // Exit Rules
  { id: '18', category: 'Exit', rule: 'Profit target defined BEFORE entry', passed: null },
  { id: '19', category: 'Exit', rule: 'Invalidation level defined BEFORE entry', passed: null },
  { id: '20', category: 'Exit', rule: 'Will exit if invalidation level breached (no hoping)', passed: null },
  { id: '21', category: 'Exit', rule: 'Hold time appropriate for regime (not scalping)', passed: null },
  // Prohibited
  { id: '22', category: 'Prohibited', rule: 'NOT scalping (hold time > 15 minutes)', passed: null },
  { id: '23', category: 'Prohibited', rule: 'NOT buying far OTM "lottos"', passed: null },
  { id: '24', category: 'Prohibited', rule: 'NOT averaging down on losing position', passed: null },
  { id: '25', category: 'Prohibited', rule: 'NOT trading during major news releases', passed: null },
];

// ============================================================================
// SIMULATOR SCENARIOS
// ============================================================================

const SIMULATOR_SCENARIOS = [
  {
    id: 'trend_bull',
    name: 'Bullish Trend Day',
    description: 'Dealers short gamma, strong buying flow, VIX stable',
    gex: { netGex: -4.5, zeroGamma: 590, callWall: 610, putWall: 570 },
    flow: { netDelta: 'bullish' as const, volumeDelta: 2.1, vannaFlow: 'supportive' as const },
    internals: { vix: 16, vixChange: -2 },
    expectedRegime: 'trend_day',
    expectedDirection: 'bullish'
  },
  {
    id: 'trend_bear',
    name: 'Bearish Trend Day',
    description: 'Dealers short gamma, strong selling pressure',
    gex: { netGex: -5.2, zeroGamma: 585, callWall: 600, putWall: 560 },
    flow: { netDelta: 'bearish' as const, volumeDelta: -2.8, vannaFlow: 'hostile' as const },
    internals: { vix: 22, vixChange: 8 },
    expectedRegime: 'trend_day',
    expectedDirection: 'bearish'
  },
  {
    id: 'mean_rev',
    name: 'Mean Reversion Setup',
    description: 'Dealers long gamma, charm pinning, extended move',
    gex: { netGex: 5.8, zeroGamma: 595, callWall: 605, putWall: 585 },
    flow: { netDelta: 'neutral' as const, volumeDelta: 0.3, vannaFlow: 'neutral' as const },
    internals: { vix: 14, vixChange: -1 },
    expectedRegime: 'mean_reversion',
    expectedDirection: 'neutral'
  },
  {
    id: 'choppy',
    name: 'Choppy Fakeout',
    description: 'Conflicting signals, no clear direction',
    gex: { netGex: 0.5, zeroGamma: 590, callWall: 600, putWall: 580 },
    flow: { netDelta: 'bullish' as const, volumeDelta: -0.5, vannaFlow: 'hostile' as const },
    internals: { vix: 18, vixChange: 1 },
    expectedRegime: 'choppy_fakeout',
    expectedDirection: 'none'
  },
  {
    id: 'gamma_squeeze',
    name: 'Gamma Squeeze Setup',
    description: 'Vanna hostile, charm unpinning, squeeze potential',
    gex: { netGex: -2.1, zeroGamma: 588, callWall: 615, putWall: 565 },
    flow: { netDelta: 'bullish' as const, volumeDelta: 3.5, vannaFlow: 'hostile' as const },
    internals: { vix: 19, vixChange: 3 },
    expectedRegime: 'gamma_squeeze',
    expectedDirection: 'bullish'
  }
];

// ============================================================================
// ANALYSIS ENGINE
// ============================================================================

function analyzeDesk(
  price: number,
  gex: GEXData,
  flow: FlowData,
  internals: MarketInternals,
  hasBinaryEvent: boolean,
  eventReason: string | null
): DeskResult {
  const warnings: string[] = [];
  
  // BINARY EVENT CHECK FIRST
  if (hasBinaryEvent) {
    return {
      status: 'no_trade',
      statusReason: eventReason || 'Binary event risk',
      regime: 'choppy_fakeout',
      regimeDescription: 'Trading suspended due to macro event risk',
      direction: 'none',
      structuralThesis: '',
      structure: null,
      strikes: null,
      entryZone: null,
      profitTarget: null,
      invalidationLevel: null,
      invalidationReason: null,
      holdTime: '-',
      confidence: 0,
      warnings: [eventReason || 'Binary event blocks trading'],
      fakeoutRisk: 'high',
      macroOverride: true,
      macroReason: eventReason
    };
  }
  
  // REGIME DETECTION
  let regime: MarketRegime;
  let regimeDescription = '';
  
  if (gex.netGex < -3 && Math.abs(flow.volumeDelta) > 1.5) {
    regime = 'trend_day';
    regimeDescription = 'Dealers SHORT gamma + strong flow = TREND DAY. They must chase, amplifying moves.';
  } else if (gex.netGex > 4 && flow.charmEffect === 'pinning') {
    regime = 'mean_reversion';
    regimeDescription = 'Dealers LONG gamma + charm pinning = MEAN REVERSION. Fades work toward Zero Gamma.';
  } else if (internals.vixChange > 8) {
    regime = 'volatility_breakout';
    regimeDescription = 'VIX expanding rapidly = VOLATILITY BREAKOUT. Direction determined by flow.';
  } else if (flow.vannaFlow === 'hostile' && flow.charmEffect === 'unpinning') {
    regime = 'gamma_squeeze';
    regimeDescription = 'Vanna hostile + charm unpinning = GAMMA SQUEEZE potential. Fast violent move.';
  } else {
    regime = 'choppy_fakeout';
    regimeDescription = 'Conflicting signals = CHOPPY FAKEOUT. Capital preservation mode - NO TRADE.';
  }
  
  // FAKEOUT DETECTION
  let fakeoutRisk: 'low' | 'medium' | 'high' = 'low';
  const priceBullish = price > gex.zeroGamma;
  const flowBullish = flow.volumeDelta > 0.5;
  
  if (priceBullish && flow.volumeDelta < 0) {
    warnings.push('BULL TRAP RISK: Price above Zero Gamma but selling pressure');
    fakeoutRisk = 'high';
  }
  if (!priceBullish && flow.volumeDelta > 0) {
    warnings.push('BEAR TRAP RISK: Price below Zero Gamma but buying pressure');
    fakeoutRisk = 'high';
  }
  if (flow.darkPoolPrints === 'mixed') {
    warnings.push('DARK POOL: Mixed prints indicate no institutional conviction');
    fakeoutRisk = fakeoutRisk === 'low' ? 'medium' : fakeoutRisk;
  }
  if (flow.netDelta !== flow.vannaFlow.replace('supportive', 'bullish').replace('hostile', 'bearish').replace('neutral', 'neutral')) {
    if (flow.vannaFlow !== 'neutral') {
      warnings.push('Vanna/Delta divergence - watch for reversal');
      fakeoutRisk = fakeoutRisk === 'low' ? 'medium' : fakeoutRisk;
    }
  }
  
  // STATUS DETERMINATION
  let status: DeskStatus;
  let statusReason = '';
  
  if (regime === 'choppy_fakeout') {
    status = 'no_trade';
    statusReason = 'Choppy regime - signals conflicting. Capital preservation mode.';
  } else if (fakeoutRisk === 'high') {
    status = 'no_trade';
    statusReason = 'High fakeout risk from flow divergences. Wait for confirmation.';
  } else if (fakeoutRisk === 'medium') {
    status = 'caution';
    statusReason = 'Setup present but elevated fakeout risk. Reduce position size.';
  } else {
    status = 'green_light';
    statusReason = 'Flow confirmed, structure aligned. Executable setup.';
  }
  
  // DIRECTION & STRUCTURE
  let direction: 'bullish' | 'bearish' | 'neutral' | 'none' = 'none';
  let structuralThesis = '';
  let structure: string | null = null;
  let strikes: string | null = null;
  const atm = Math.round(price / 5) * 5;
  
  if (status !== 'no_trade') {
    if (regime === 'trend_day') {
      if (flow.volumeDelta > 0 && flow.netDelta === 'bullish') {
        direction = 'bullish';
        structuralThesis = `Trend UP: Dealers must hedge by buying. Target: Call Wall ${gex.callWall}`;
        structure = 'Bull Call Vertical';
        strikes = `Buy ${atm}C / Sell ${atm + 10}C`;
      } else if (flow.volumeDelta < 0 && flow.netDelta === 'bearish') {
        direction = 'bearish';
        structuralThesis = `Trend DOWN: Dealers must hedge by selling. Target: Put Wall ${gex.putWall}`;
        structure = 'Bear Put Vertical';
        strikes = `Buy ${atm}P / Sell ${atm - 10}P`;
      }
    } else if (regime === 'mean_reversion') {
      if (price > gex.zeroGamma + 15) {
        direction = 'bearish';
        structuralThesis = `FADE: Extended ${(price - gex.zeroGamma).toFixed(0)} pts above Zero Gamma. Reversion target: ${gex.zeroGamma}`;
        structure = 'Put Butterfly';
        strikes = `Buy ${atm + 5}P / Sell 2x ${atm}P / Buy ${atm - 5}P`;
      } else if (price < gex.zeroGamma - 15) {
        direction = 'bullish';
        structuralThesis = `BUY THE DIP: Extended ${(gex.zeroGamma - price).toFixed(0)} pts below Zero Gamma. Target: ${gex.zeroGamma}`;
        structure = 'Call Butterfly';
        strikes = `Buy ${atm - 5}C / Sell 2x ${atm}C / Buy ${atm + 5}C`;
      } else {
        direction = 'neutral';
        structuralThesis = `Range-bound near Zero Gamma (${gex.zeroGamma}). Iron Condor zone.`;
        structure = 'Iron Condor';
        strikes = `Sell ${gex.putWall}P/Buy ${gex.putWall - 10}P | Sell ${gex.callWall}C/Buy ${gex.callWall + 10}C`;
      }
    } else if (regime === 'gamma_squeeze') {
      direction = flow.netDelta;
      structuralThesis = `Gamma squeeze potential. Fast move expected ${direction === 'bullish' ? 'UP' : 'DOWN'}.`;
      structure = direction === 'bullish' ? 'Call Debit Spread' : 'Put Debit Spread';
      strikes = direction === 'bullish' 
        ? `Buy ${atm}C / Sell ${atm + 15}C`
        : `Buy ${atm}P / Sell ${atm - 15}P`;
    }
  }
  
  // CONFIDENCE
  let confidence = 50;
  if (flow.volumeDelta !== 0 && flow.netDelta === direction) confidence += 15;
  if (flow.institutionalFlow === 'accumulation' && direction === 'bullish') confidence += 10;
  if (flow.institutionalFlow === 'distribution' && direction === 'bearish') confidence += 10;
  if (flow.darkPoolPrints === direction) confidence += 5;
  if (fakeoutRisk === 'low') confidence += 10;
  if (fakeoutRisk === 'high') confidence -= 15;
  if (internals.vix > 25) confidence -= 10;
  confidence = Math.max(0, Math.min(100, confidence));
  
  // LEVELS
  const entryZone = { low: price - 3, high: price + 2 };
  const profitTarget = direction === 'bullish' ? Math.min(gex.callWall, atm + 15) :
                       direction === 'bearish' ? Math.max(gex.putWall, atm - 15) :
                       direction === 'neutral' ? gex.zeroGamma : null;
  const invalidationLevel = direction === 'bullish' ? gex.zeroGamma - 10 :
                            direction === 'bearish' ? gex.zeroGamma + 10 :
                            direction === 'neutral' ? gex.putWall - 15 : null;
  const invalidationReason = direction === 'bullish' ? 'Break below Zero Gamma invalidates bull thesis' :
                             direction === 'bearish' ? 'Break above Zero Gamma invalidates bear thesis' :
                             direction === 'neutral' ? 'Break beyond expected range' : null;
  
  const holdTime = regime === 'trend_day' ? '1-3 hours' : 
                   regime === 'mean_reversion' ? '30 min - 2 hours' :
                   regime === 'gamma_squeeze' ? '15-45 min' : '1-2 hours';
  
  return {
    status,
    statusReason,
    regime,
    regimeDescription,
    direction,
    structuralThesis,
    structure,
    strikes,
    entryZone,
    profitTarget,
    invalidationLevel,
    invalidationReason,
    holdTime,
    confidence,
    warnings,
    fakeoutRisk,
    macroOverride: false,
    macroReason: null
  };
}

// ============================================================================
// TAB COMPONENTS
// ============================================================================

// === SCANNER TAB ===
function ScannerTab() {
  const [ticker, setTicker] = useState('SPY');
  const [price, setPrice] = useState(590);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DeskResult | null>(null);
  
  // GEX Data
  const [gex, setGex] = useState<GEXData>({
    zeroGamma: 590, callWall: 610, putWall: 570, netGex: 0, maxPain: 585, gexFlip: 595
  });
  
  // Flow Data
  const [flow, setFlow] = useState<FlowData>({
    netDelta: 'neutral', volumeDelta: 0, vannaFlow: 'neutral',
    charmEffect: 'neutral', darkPoolPrints: 'none', institutionalFlow: 'neutral'
  });
  
  // Internals
  const [internals, setInternals] = useState<MarketInternals>({
    vold: 0, tick: 0, addLine: 'flat', vix: 18, vixChange: 0
  });
  
  // Event status
  const [hasBinaryEvent, setHasBinaryEvent] = useState(false);
  const [eventReason, setEventReason] = useState<string | null>(null);
  
  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch quote
      const quoteRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/market/quote/${ticker}`);
      if (quoteRes.ok) {
        const q = await quoteRes.json();
        setPrice(q.price || 590);
      }
      
      // Fetch VIX
      const vixRes = await fetch('/api/v1/market/vix');
      if (vixRes.ok) {
        const v = await vixRes.json();
        setInternals(prev => ({ ...prev, vix: v.vix || 18, vixChange: v.vix_change_pct || 0 }));
      }
      
      // Fetch GEX (would need actual GEX data source)
      const gexRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/zero-dte/gex/${ticker}`);
      if (gexRes.ok) {
        const g = await gexRes.json();
        setGex({
          zeroGamma: g.zero_gamma || price,
          callWall: g.call_wall || price + 20,
          putWall: g.put_wall || price - 20,
          netGex: g.net_gex || 0,
          maxPain: g.max_pain || price,
          gexFlip: g.gex_flip || price + 5
        });
      }
      
      // Check events
      const eventRes = await fetch('/api/v1/scanner/events/0dte');
      if (eventRes.ok) {
        const e = await eventRes.json();
        setHasBinaryEvent(e.has_binary_event || false);
        setEventReason(e.event_override || null);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [ticker, price]);
  
  const runAnalysis = () => {
    const r = analyzeDesk(price, gex, flow, internals, hasBinaryEvent, eventReason);
    setResult(r);
  };
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const statusCfg = {
    green_light: { color: 'bg-emerald-500', icon: CheckCircle, text: 'GREEN LIGHT' },
    caution: { color: 'bg-yellow-500', icon: AlertTriangle, text: 'CAUTION' },
    no_trade: { color: 'bg-red-500', icon: Ban, text: 'NO TRADE' }
  };
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* LEFT: Inputs */}
      <div className="space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Activity className="w-4 h-4" />Market Data
        </h3>
        
        {/* Ticker & Price */}
        <div className="card p-4">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-[var(--text-secondary)]">Ticker</label>
              <select value={ticker} onChange={e => setTicker(e.target.value)} className="input w-full mt-1">
                <option>SPY</option><option>QQQ</option><option>IWM</option><option>SPX</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--text-secondary)]">Price</label>
              <input type="number" value={price} onChange={e => setPrice(+e.target.value)} className="input w-full mt-1" />
            </div>
          </div>
          <button onClick={fetchData} disabled={loading} className="btn w-full flex items-center justify-center gap-2">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh Data
          </button>
        </div>
        
        {/* GEX Levels */}
        <div className="card p-4">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-500" />GEX Levels
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-[var(--text-secondary)]">Zero Gamma</label>
              <input type="number" value={gex.zeroGamma} onChange={e => setGex({...gex, zeroGamma: +e.target.value})} className="input w-full mt-1" /></div>
            <div><label className="text-xs text-[var(--text-secondary)]">Net GEX ($B)</label>
              <input type="number" step="0.1" value={gex.netGex} onChange={e => setGex({...gex, netGex: +e.target.value})} className="input w-full mt-1" /></div>
            <div><label className="text-xs text-[var(--text-secondary)]">Call Wall</label>
              <input type="number" value={gex.callWall} onChange={e => setGex({...gex, callWall: +e.target.value})} className="input w-full mt-1" /></div>
            <div><label className="text-xs text-[var(--text-secondary)]">Put Wall</label>
              <input type="number" value={gex.putWall} onChange={e => setGex({...gex, putWall: +e.target.value})} className="input w-full mt-1" /></div>
          </div>
        </div>
        
        {/* Flow */}
        <div className="card p-4">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Eye className="w-4 h-4 text-blue-500" />Flow Data
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-[var(--text-secondary)]">Net Delta</label>
              <select value={flow.netDelta} onChange={e => setFlow({...flow, netDelta: e.target.value as any})} className="input w-full mt-1">
                <option value="bullish">Bullish</option><option value="bearish">Bearish</option><option value="neutral">Neutral</option>
              </select></div>
            <div><label className="text-xs text-[var(--text-secondary)]">Vol Delta</label>
              <input type="number" step="0.1" value={flow.volumeDelta} onChange={e => setFlow({...flow, volumeDelta: +e.target.value})} className="input w-full mt-1" /></div>
            <div><label className="text-xs text-[var(--text-secondary)]">Vanna</label>
              <select value={flow.vannaFlow} onChange={e => setFlow({...flow, vannaFlow: e.target.value as any})} className="input w-full mt-1">
                <option value="supportive">Supportive</option><option value="hostile">Hostile</option><option value="neutral">Neutral</option>
              </select></div>
            <div><label className="text-xs text-[var(--text-secondary)]">Charm</label>
              <select value={flow.charmEffect} onChange={e => setFlow({...flow, charmEffect: e.target.value as any})} className="input w-full mt-1">
                <option value="pinning">Pinning</option><option value="unpinning">Unpinning</option><option value="neutral">Neutral</option>
              </select></div>
          </div>
        </div>
        
        {/* Internals */}
        <div className="card p-4">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Gauge className="w-4 h-4 text-orange-500" />Internals
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-[var(--text-secondary)]">VIX</label>
              <input type="number" step="0.1" value={internals.vix} onChange={e => setInternals({...internals, vix: +e.target.value})} className="input w-full mt-1" /></div>
            <div><label className="text-xs text-[var(--text-secondary)]">VIX Chg %</label>
              <input type="number" step="0.1" value={internals.vixChange} onChange={e => setInternals({...internals, vixChange: +e.target.value})} className="input w-full mt-1" /></div>
          </div>
        </div>
        
        <button onClick={runAnalysis} className="btn-primary w-full flex items-center justify-center gap-2">
          <Crosshair className="w-4 h-4" />Analyze
        </button>
      </div>
      
      {/* MIDDLE: Result */}
      <div className="lg:col-span-2">
        {result ? (
          <div className="space-y-4">
            {/* Status */}
            <div className={`${statusCfg[result.status].color}/10 border border-${statusCfg[result.status].color.replace('bg-', '')}/30 rounded-xl p-6`}>
              <div className="flex justify-between items-start mb-4">
                <div className={`${statusCfg[result.status].color} text-white px-6 py-3 rounded-lg flex items-center gap-2`}>
                  {(() => { const Icon = statusCfg[result.status].icon; return <Icon className="w-6 h-6" />; })()}
                  <span className="text-xl font-bold">{statusCfg[result.status].text}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm text-[var(--text-secondary)]">Confidence</p>
                  <p className={`text-4xl font-bold ${result.confidence >= 60 ? 'text-emerald-500' : result.confidence >= 40 ? 'text-yellow-500' : 'text-red-500'}`}>
                    {result.confidence}%
                  </p>
                </div>
              </div>
              <p className="text-lg">{result.statusReason}</p>
              {result.macroOverride && (
                <div className="mt-3 p-3 bg-red-500/20 rounded-lg text-red-400">
                  ⚠️ {result.macroReason}
                </div>
              )}
            </div>
            
            {/* Regime */}
            <div className="card p-5">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />REGIME DETECTED
              </h4>
              <p className="text-xl font-bold text-primary mb-2">{result.regime.replace(/_/g, ' ').toUpperCase()}</p>
              <p className="text-[var(--text-secondary)]">{result.regimeDescription}</p>
            </div>
            
            {/* Trade Structure */}
            {result.structure && result.status !== 'no_trade' && (
              <div className="card p-5 border border-primary/30">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />TRADE BRIEF
                </h4>
                <p className="mb-4">{result.structuralThesis}</p>
                <div className={`p-4 rounded-lg mb-4 ${
                  result.direction === 'bullish' ? 'bg-emerald-500/10' : 
                  result.direction === 'bearish' ? 'bg-red-500/10' : 'bg-blue-500/10'
                }`}>
                  <p className="text-lg font-bold">{result.structure}</p>
                  <p className="font-mono">{result.strikes}</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-[var(--surface)] rounded-lg text-center">
                    <p className="text-xs text-[var(--text-secondary)]">Target</p>
                    <p className="text-lg font-bold text-emerald-500">${result.profitTarget}</p>
                  </div>
                  <div className="p-3 bg-[var(--surface)] rounded-lg text-center">
                    <p className="text-xs text-[var(--text-secondary)]">Invalidation</p>
                    <p className="text-lg font-bold text-red-500">${result.invalidationLevel}</p>
                  </div>
                  <div className="p-3 bg-[var(--surface)] rounded-lg text-center">
                    <p className="text-xs text-[var(--text-secondary)]">Hold Time</p>
                    <p className="text-lg font-bold">{result.holdTime}</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div className="card p-4 bg-yellow-500/10 border border-yellow-500/30">
                <h4 className="font-semibold mb-2 flex items-center gap-2 text-yellow-500">
                  <AlertTriangle className="w-4 h-4" />WARNINGS
                </h4>
                <ul className="space-y-1">
                  {result.warnings.map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <AlertOctagon className="w-4 h-4 mt-0.5 text-yellow-500" />{w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="card p-12 text-center">
            <Crosshair className="w-16 h-16 mx-auto mb-4 text-[var(--text-secondary)] opacity-30" />
            <h3 className="text-lg font-medium mb-2">Ready to Analyze</h3>
            <p className="text-[var(--text-secondary)]">
              Enter market data and click Analyze to get trade brief
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// === AUDIT TAB ===
function AuditTab() {
  const [rules, setRules] = useState(DESK_RULES);
  const categories = [...new Set(rules.map(r => r.category))];
  
  const toggleRule = (id: string) => {
    setRules(prev => prev.map(r => 
      r.id === id ? { ...r, passed: r.passed === true ? false : r.passed === false ? null : true } : r
    ));
  };
  
  const passedCount = rules.filter(r => r.passed === true).length;
  const failedCount = rules.filter(r => r.passed === false).length;
  const canTrade = failedCount === 0 && passedCount >= 20;
  
  const resetAll = () => setRules(DESK_RULES);
  
  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className={`card p-6 ${canTrade ? 'bg-emerald-500/10 border border-emerald-500/30' : failedCount > 0 ? 'bg-red-500/10 border border-red-500/30' : ''}`}>
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2">
              {canTrade ? <CheckCircle className="w-6 h-6 text-emerald-500" /> : <Shield className="w-6 h-6 text-[var(--text-secondary)]" />}
              Self-Audit Status
            </h3>
            <p className="text-[var(--text-secondary)]">
              {canTrade ? 'All critical rules passed - CLEAR TO TRADE' : 
               failedCount > 0 ? `${failedCount} rule(s) failed - DO NOT TRADE` :
               `${passedCount}/${rules.length} rules checked`}
            </p>
          </div>
          <button onClick={resetAll} className="btn flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />Reset
          </button>
        </div>
      </div>
      
      {/* Rules by Category */}
      {categories.map(cat => (
        <div key={cat} className="card p-4">
          <h4 className="font-semibold mb-3">{cat}</h4>
          <div className="space-y-2">
            {rules.filter(r => r.category === cat).map(rule => (
              <div 
                key={rule.id}
                onClick={() => toggleRule(rule.id)}
                className={`p-3 rounded-lg cursor-pointer flex items-center gap-3 transition-colors ${
                  rule.passed === true ? 'bg-emerald-500/10 border border-emerald-500/30' :
                  rule.passed === false ? 'bg-red-500/10 border border-red-500/30' :
                  'bg-[var(--surface)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  rule.passed === true ? 'bg-emerald-500 text-white' :
                  rule.passed === false ? 'bg-red-500 text-white' :
                  'bg-[var(--border)]'
                }`}>
                  {rule.passed === true ? <CheckCircle className="w-4 h-4" /> :
                   rule.passed === false ? <XCircle className="w-4 h-4" /> :
                   <span className="text-xs">{rule.id}</span>}
                </div>
                <span className="text-sm">{rule.rule}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// === SIMULATOR TAB ===
function SimulatorTab() {
  const [selectedScenario, setSelectedScenario] = useState(SIMULATOR_SCENARIOS[0]);
  const [result, setResult] = useState<DeskResult | null>(null);
  
  const runScenario = () => {
    const gex: GEXData = {
      ...selectedScenario.gex,
      maxPain: selectedScenario.gex.zeroGamma,
      gexFlip: selectedScenario.gex.zeroGamma + 5
    };
    const flow: FlowData = {
      ...selectedScenario.flow,
      charmEffect: selectedScenario.id === 'mean_rev' ? 'pinning' : selectedScenario.id === 'gamma_squeeze' ? 'unpinning' : 'neutral',
      darkPoolPrints: selectedScenario.flow.netDelta === 'bullish' ? 'bullish' : selectedScenario.flow.netDelta === 'bearish' ? 'bearish' : 'mixed',
      institutionalFlow: 'neutral'
    };
    const internals: MarketInternals = {
      vold: 0, tick: 0, addLine: 'flat',
      ...selectedScenario.internals
    };
    
    const r = analyzeDesk(gex.zeroGamma, gex, flow, internals, false, null);
    setResult(r);
  };
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Scenarios */}
      <div className="space-y-4">
        <h3 className="font-semibold">Select Scenario</h3>
        {SIMULATOR_SCENARIOS.map(s => (
          <div
            key={s.id}
            onClick={() => setSelectedScenario(s)}
            className={`card p-4 cursor-pointer transition-all ${
              selectedScenario.id === s.id ? 'border-primary ring-2 ring-primary/20' : 'hover:border-[var(--border-hover)]'
            }`}
          >
            <h4 className="font-medium">{s.name}</h4>
            <p className="text-sm text-[var(--text-secondary)]">{s.description}</p>
            <div className="flex gap-2 mt-2">
              <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                {s.expectedRegime.replace(/_/g, ' ')}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded ${
                s.expectedDirection === 'bullish' ? 'bg-emerald-500/20 text-emerald-400' :
                s.expectedDirection === 'bearish' ? 'bg-red-500/20 text-red-400' :
                'bg-yellow-500/20 text-yellow-400'
              }`}>
                {s.expectedDirection}
              </span>
            </div>
          </div>
        ))}
        <button onClick={runScenario} className="btn-primary w-full flex items-center justify-center gap-2">
          <Play className="w-4 h-4" />Run Scenario
        </button>
      </div>
      
      {/* Result */}
      <div>
        {result ? (
          <div className="card p-6">
            <h3 className="font-semibold mb-4">Analysis Result</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Regime Detected:</span>
                <span className={`font-bold ${result.regime === selectedScenario.expectedRegime ? 'text-emerald-500' : 'text-red-500'}`}>
                  {result.regime.replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Direction:</span>
                <span className={`font-bold ${result.direction === selectedScenario.expectedDirection ? 'text-emerald-500' : 'text-red-500'}`}>
                  {result.direction.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className={`font-bold ${
                  result.status === 'green_light' ? 'text-emerald-500' :
                  result.status === 'caution' ? 'text-yellow-500' : 'text-red-500'
                }`}>
                  {result.status.replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Confidence:</span>
                <span className="font-bold">{result.confidence}%</span>
              </div>
              {result.structure && (
                <div className="mt-4 p-3 bg-[var(--surface)] rounded">
                  <p className="font-medium">{result.structure}</p>
                  <p className="text-sm text-[var(--text-secondary)]">{result.strikes}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="card p-8 text-center">
            <FlaskConical className="w-12 h-12 mx-auto mb-4 text-[var(--text-secondary)] opacity-30" />
            <p className="text-[var(--text-secondary)]">Select a scenario and click Run to test the analysis engine</p>
          </div>
        )}
      </div>
    </div>
  );
}

// === JOURNAL TAB ===
function JournalTab() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  
  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('desk_journal');
    if (saved) setEntries(JSON.parse(saved));
  }, []);
  
  // Stats
  const stats = {
    total: entries.length,
    winners: entries.filter(e => e.pnl && e.pnl > 0).length,
    losers: entries.filter(e => e.pnl && e.pnl < 0).length,
    followedRules: entries.filter(e => e.followedRules).length,
    totalPnL: entries.reduce((sum, e) => sum + (e.pnl || 0), 0)
  };
  
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-[var(--text-secondary)]">Trades</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-emerald-500">{stats.winners}</p>
          <p className="text-xs text-[var(--text-secondary)]">Winners</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-red-500">{stats.losers}</p>
          <p className="text-xs text-[var(--text-secondary)]">Losers</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-blue-500">
            {stats.total > 0 ? Math.round(stats.followedRules / stats.total * 100) : 0}%
          </p>
          <p className="text-xs text-[var(--text-secondary)]">Rule Compliance</p>
        </div>
        <div className="card p-4 text-center">
          <p className={`text-2xl font-bold ${stats.totalPnL >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            ${stats.totalPnL.toFixed(0)}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">Total P&L</p>
        </div>
      </div>
      
      {/* Entries */}
      {entries.length > 0 ? (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-[var(--surface)]">
              <tr>
                <th className="text-left p-3 text-sm">Date</th>
                <th className="text-left p-3 text-sm">Ticker</th>
                <th className="text-left p-3 text-sm">Regime</th>
                <th className="text-left p-3 text-sm">Structure</th>
                <th className="text-left p-3 text-sm">P&L</th>
                <th className="text-left p-3 text-sm">Rules</th>
              </tr>
            </thead>
            <tbody>
              {entries.slice(0, 20).map(e => (
                <tr key={e.id} className="border-t border-[var(--border)]">
                  <td className="p-3 text-sm">{e.date}</td>
                  <td className="p-3 font-medium">{e.ticker}</td>
                  <td className="p-3 text-sm">{e.regime}</td>
                  <td className="p-3 text-sm">{e.structure}</td>
                  <td className={`p-3 font-bold ${e.pnl && e.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {e.pnl ? `$${e.pnl.toFixed(0)}` : '-'}
                  </td>
                  <td className="p-3">
                    {e.followedRules ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card p-8 text-center">
          <FileText className="w-12 h-12 mx-auto mb-4 text-[var(--text-secondary)] opacity-30" />
          <p className="text-[var(--text-secondary)]">No journal entries yet. Record your first trade!</p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function ZeroDTEPage() {
  const [activeTab, setActiveTab] = useState<DeskTab>('scanner');
  
  const tabs = [
    { id: 'scanner' as DeskTab, label: 'The Desk', icon: Crosshair },
    { id: 'audit' as DeskTab, label: 'Self-Audit', icon: ClipboardCheck },
    { id: 'simulator' as DeskTab, label: 'Simulator', icon: FlaskConical },
    { id: 'journal' as DeskTab, label: 'Journal', icon: FileText }
  ];
  
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <Link href="/" className="text-sm text-[var(--text-secondary)] hover:text-primary flex items-center gap-1 mb-2">
          <ArrowLeft className="w-4 h-4" />Dashboard
        </Link>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Timer className="w-6 h-6 text-red-500" />
          0-DTE Command Center
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          The Desk Methodology • No Scalping • No Lottos • Defined Risk Only
        </p>
      </div>
      
      {/* Methodology Banner */}
      <div className="card p-3 bg-red-500/5 border border-red-500/20">
        <div className="flex items-center gap-3">
          <Lock className="w-5 h-5 text-red-500" />
          <p className="text-sm">
            <strong>THE DESK RULES:</strong> If signals conflict → NO TRADE. If fakeout detected → NO TRADE. Capital preservation above all.
          </p>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--border)] pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-t-lg flex items-center gap-2 transition-colors ${
              activeTab === tab.id 
                ? 'bg-primary text-white' 
                : 'hover:bg-[var(--surface)]'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* Tab Content */}
      {activeTab === 'scanner' && <ScannerTab />}
      {activeTab === 'audit' && <AuditTab />}
      {activeTab === 'simulator' && <SimulatorTab />}
      {activeTab === 'journal' && <JournalTab />}
    </div>
  );
}
