'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Target,
  Eye,
  Play,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Plus,
  Trash2,
  Edit,
  Save,
  Award,
  Brain,
  Microscope,
  ClipboardList
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

type MarketRegime = 'trend_day' | 'mean_reversion' | 'volatility_breakout' | 'choppy_fakeout' | 'gamma_squeeze';
type TradeStatus = 'green_light' | 'caution' | 'no_trade';
type TradeDirection = 'bullish' | 'bearish' | 'neutral' | 'none';
type TradeOutcome = 'win' | 'loss' | 'breakeven' | 'open';

interface SimulatorInput {
  underlying: string;
  currentPrice: number;
  zeroGamma: number;
  callWall: number;
  putWall: number;
  netGex: number;
  vannaFlow: 'supportive' | 'hostile' | 'neutral';
  charmEffect: 'pinning' | 'unpinning' | 'neutral';
  volumeDelta: number;
  vold: number;
  tick: number;
  addLine: 'rising' | 'falling' | 'flat';
  vix: number;
  vixChange: number;
  darkPoolPrints: 'bullish' | 'bearish' | 'mixed' | 'none';
  institutionalFlow: 'accumulation' | 'distribution' | 'neutral';
}

interface SimulatorResult {
  status: TradeStatus;
  statusReason: string;
  regime: MarketRegime;
  regimeDescription: string;
  direction: TradeDirection;
  structureSuggested: string;
  entryZone: string;
  target: number;
  invalidation: number;
  confidence: number;
  warnings: string[];
  decisionTree: DecisionStep[];
}

interface DecisionStep {
  check: string;
  value: string;
  passed: boolean;
  impact: string;
}

interface TradeEntry {
  id: string;
  date: string;
  time: string;
  underlying: string;
  direction: TradeDirection;
  structure: string;
  entry: number;
  exit: number | null;
  target: number;
  invalidation: number;
  outcome: TradeOutcome;
  pnl: number | null;
  regimeAtEntry: MarketRegime;
  deskSignal: TradeStatus;
  followedDesk: boolean;
  confidenceAtEntry: number;
  setupNotes: string;
  executionNotes: string;
  lessonLearned: string;
  vixAtEntry: number;
  gexAtEntry: number;
}

interface PerformanceStats {
  totalTrades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  followedDeskRate: number;
  winRateWhenFollowed: number;
  winRateWhenIgnored: number;
  regimeBreakdown: Record<string, { trades: number; winRate: number }>;
}

// ============================================================================
// THE DESK LOGIC ENGINE
// ============================================================================

function analyzeWithDesk(input: SimulatorInput): SimulatorResult {
  const decisionTree: DecisionStep[] = [];
  const warnings: string[] = [];
  
  // STEP 1: REGIME IDENTIFICATION
  let regime: MarketRegime;
  let regimeDescription = '';
  
  const gexCheck = input.netGex < -3 && Math.abs(input.volumeDelta) > 1.5;
  decisionTree.push({
    check: 'Trend Day Check',
    value: `GEX: ${input.netGex}B, Vol Delta: ${input.volumeDelta}`,
    passed: gexCheck,
    impact: gexCheck ? 'Dealers SHORT gamma + strong flow = TREND DAY' : 'Not a trend day setup'
  });
  
  const meanReversionCheck = input.netGex > 4 && input.charmEffect === 'pinning';
  decisionTree.push({
    check: 'Mean Reversion Check',
    value: `GEX: ${input.netGex}B, Charm: ${input.charmEffect}`,
    passed: meanReversionCheck,
    impact: meanReversionCheck ? 'Dealers LONG gamma + pinning = MEAN REVERSION' : 'Not mean reversion setup'
  });
  
  const volBreakoutCheck = input.vixChange > 8;
  decisionTree.push({
    check: 'Volatility Breakout Check',
    value: `VIX Change: ${input.vixChange}%`,
    passed: volBreakoutCheck,
    impact: volBreakoutCheck ? 'VIX expanding = VOL BREAKOUT' : 'VIX stable'
  });
  
  const gammaSqueezeCheck = input.vannaFlow === 'hostile' && input.charmEffect === 'unpinning';
  decisionTree.push({
    check: 'Gamma Squeeze Check',
    value: `Vanna: ${input.vannaFlow}, Charm: ${input.charmEffect}`,
    passed: gammaSqueezeCheck,
    impact: gammaSqueezeCheck ? 'Vanna hostile + unpinning = SQUEEZE POTENTIAL' : 'No squeeze setup'
  });
  
  const choppyCheck = Math.abs(input.volumeDelta) < 0.5 && input.addLine === 'flat';
  decisionTree.push({
    check: 'Choppy/Fakeout Check',
    value: `Vol Delta: ${input.volumeDelta}, ADD: ${input.addLine}`,
    passed: choppyCheck,
    impact: choppyCheck ? 'Low conviction = CHOPPY FAKEOUT' : 'Has conviction'
  });
  
  if (gexCheck) {
    regime = 'trend_day';
    regimeDescription = 'Dealers SHORT gamma + strong flow = TREND DAY. They must chase, amplifying moves.';
  } else if (meanReversionCheck) {
    regime = 'mean_reversion';
    regimeDescription = 'Dealers LONG gamma + charm pinning = MEAN REVERSION. Fades expected.';
  } else if (volBreakoutCheck) {
    regime = 'volatility_breakout';
    regimeDescription = 'VIX expanding = VOLATILITY BREAKOUT. Direction from flow.';
  } else if (gammaSqueezeCheck) {
    regime = 'gamma_squeeze';
    regimeDescription = 'Vanna hostile + charm unpinning = GAMMA SQUEEZE potential.';
  } else if (choppyCheck) {
    regime = 'choppy_fakeout';
    regimeDescription = 'Low conviction + flat breadth = CHOPPY FAKEOUT. NO TRADE.';
  } else {
    regime = 'choppy_fakeout';
    regimeDescription = 'Conflicting signals = unclear regime. NO TRADE stance.';
  }
  
  // STEP 2: FAKEOUT DETECTION
  const priceAboveZeroGamma = input.currentPrice > input.zeroGamma;
  const flowBullish = input.volumeDelta > 0.5;
  const internalsPositive = input.vold > 0.5 && input.tick > 100;
  
  let fakeoutRisk: 'low' | 'medium' | 'high' = 'low';
  
  if (priceAboveZeroGamma && !flowBullish) {
    warnings.push('DIVERGENCE: Price above Zero Gamma but volume delta negative - potential bull trap');
    fakeoutRisk = 'high';
    decisionTree.push({
      check: 'Bull Trap Detection',
      value: `Price > ZG but Vol Delta: ${input.volumeDelta}`,
      passed: false,
      impact: 'DANGER: Flow not confirming price action'
    });
  }
  
  if (!priceAboveZeroGamma && flowBullish) {
    warnings.push('DIVERGENCE: Price below Zero Gamma but volume delta positive - potential bear trap');
    fakeoutRisk = 'high';
    decisionTree.push({
      check: 'Bear Trap Detection',
      value: `Price < ZG but Vol Delta: ${input.volumeDelta}`,
      passed: false,
      impact: 'DANGER: Flow diverging from structure'
    });
  }
  
  if (priceAboveZeroGamma && !internalsPositive) {
    warnings.push('INTERNALS LAG: Price above Zero Gamma but breadth not confirming');
    fakeoutRisk = fakeoutRisk === 'high' ? 'high' : 'medium';
  }
  
  if (input.darkPoolPrints === 'mixed') {
    warnings.push('DARK POOL: Mixed institutional prints - no clear conviction');
    fakeoutRisk = fakeoutRisk === 'low' ? 'medium' : fakeoutRisk;
  }
  
  // STEP 3: FLOW VALIDATION
  const volumeDeltaCheck = Math.abs(input.volumeDelta) < 0.5 ? 'neutral' :
    (input.volumeDelta > 0 && priceAboveZeroGamma) || 
    (input.volumeDelta < 0 && !priceAboveZeroGamma) ? 'confirming' : 'diverging';
  
  decisionTree.push({
    check: 'Volume Delta Alignment',
    value: `${volumeDeltaCheck.toUpperCase()}`,
    passed: volumeDeltaCheck === 'confirming',
    impact: volumeDeltaCheck === 'confirming' ? 'Flow confirms direction' : 'Flow questionable'
  });
  
  const institutionalAligned = input.institutionalFlow === 'neutral' ? 'neutral' :
    (input.institutionalFlow === 'accumulation' && priceAboveZeroGamma) ||
    (input.institutionalFlow === 'distribution' && !priceAboveZeroGamma) ? 'aligned' : 'opposed';
  
  decisionTree.push({
    check: 'Institutional Alignment',
    value: `${institutionalAligned.toUpperCase()}`,
    passed: institutionalAligned === 'aligned',
    impact: institutionalAligned === 'aligned' ? 'Institutions confirm' : 'Watch institutional positioning'
  });
  
  // STEP 4: STATUS DETERMINATION
  let status: TradeStatus;
  let statusReason = '';
  
  if (regime === 'choppy_fakeout') {
    status = 'no_trade';
    statusReason = 'SURVIVAL MODE: Choppy/fakeout regime. Capital preservation.';
  } else if (fakeoutRisk === 'high') {
    status = 'no_trade';
    statusReason = 'SURVIVAL MODE: High fakeout risk from flow divergences.';
  } else if (volumeDeltaCheck === 'diverging' && institutionalAligned === 'opposed') {
    status = 'no_trade';
    statusReason = 'SURVIVAL MODE: Flow divergence + institutional opposition.';
  } else if (fakeoutRisk === 'medium' || volumeDeltaCheck === 'neutral') {
    status = 'caution';
    statusReason = 'Setup present but needs confirmation. REDUCE SIZE.';
  } else if (volumeDeltaCheck === 'confirming' && institutionalAligned !== 'opposed') {
    status = 'green_light';
    statusReason = 'Flow confirmed, structure aligned. EXECUTABLE.';
  } else {
    status = 'caution';
    statusReason = 'Mixed signals. Reduced size recommended.';
  }
  
  // STEP 5: DIRECTION & STRUCTURE
  let direction: TradeDirection = 'none';
  let structureSuggested = 'NO TRADE';
  let entryZone = '-';
  let target = input.currentPrice;
  let invalidation = input.currentPrice;
  
  if (status !== 'no_trade') {
    if (regime === 'trend_day') {
      if (input.volumeDelta > 0) {
        direction = 'bullish';
        structureSuggested = 'Bull Call Vertical';
        target = input.callWall;
        invalidation = input.zeroGamma - 10;
      } else {
        direction = 'bearish';
        structureSuggested = 'Bear Put Vertical';
        target = input.putWall;
        invalidation = input.zeroGamma + 10;
      }
    } else if (regime === 'mean_reversion') {
      if (input.currentPrice > input.zeroGamma + 20) {
        direction = 'bearish';
        structureSuggested = 'Put Butterfly';
        target = input.zeroGamma;
        invalidation = input.callWall - 5;
      } else if (input.currentPrice < input.zeroGamma - 20) {
        direction = 'bullish';
        structureSuggested = 'Call Butterfly';
        target = input.zeroGamma;
        invalidation = input.putWall + 5;
      } else {
        direction = 'neutral';
        structureSuggested = 'Iron Condor';
        target = input.zeroGamma;
        invalidation = input.putWall - 15;
      }
    } else if (regime === 'gamma_squeeze' || regime === 'volatility_breakout') {
      direction = input.volumeDelta > 0 ? 'bullish' : 'bearish';
      structureSuggested = direction === 'bullish' ? 'Bull Call Vertical' : 'Bear Put Vertical';
      target = direction === 'bullish' ? input.callWall : input.putWall;
      invalidation = direction === 'bullish' ? input.zeroGamma - 15 : input.zeroGamma + 15;
    }
    entryZone = `${input.currentPrice - 3} - ${input.currentPrice + 3}`;
  }
  
  // STEP 6: CONFIDENCE
  let confidence = 5;
  if (volumeDeltaCheck === 'confirming') confidence += 2;
  if (volumeDeltaCheck === 'diverging') confidence -= 2;
  if (institutionalAligned === 'aligned') confidence += 1.5;
  if (institutionalAligned === 'opposed') confidence -= 2;
  if (fakeoutRisk === 'low') confidence += 1;
  if (fakeoutRisk === 'high') confidence -= 2;
  if (input.darkPoolPrints === (direction === 'bullish' ? 'bullish' : 'bearish')) confidence += 1;
  if (input.vannaFlow === 'supportive') confidence += 0.5;
  confidence = Math.max(0, Math.min(10, confidence));
  
  return {
    status, statusReason, regime, regimeDescription, direction, structureSuggested,
    entryZone, target, invalidation, confidence: Math.round(confidence * 10) / 10, warnings, decisionTree
  };
}

// ============================================================================
// PERFORMANCE CALCULATOR
// ============================================================================

function calculatePerformance(trades: TradeEntry[]): PerformanceStats {
  const completedTrades = trades.filter(t => t.outcome !== 'open');
  const wins = completedTrades.filter(t => t.outcome === 'win');
  const losses = completedTrades.filter(t => t.outcome === 'loss');
  const breakeven = completedTrades.filter(t => t.outcome === 'breakeven');
  const followedDesk = completedTrades.filter(t => t.followedDesk);
  const ignoredDesk = completedTrades.filter(t => !t.followedDesk);
  const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + (t.pnl || 0), 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + (t.pnl || 0), 0) / losses.length) : 0;
  
  const regimeBreakdown: Record<string, { trades: number; winRate: number }> = {};
  ['trend_day', 'mean_reversion', 'volatility_breakout', 'gamma_squeeze', 'choppy_fakeout'].forEach(r => {
    const rt = completedTrades.filter(t => t.regimeAtEntry === r);
    regimeBreakdown[r] = { trades: rt.length, winRate: rt.length > 0 ? (rt.filter(t => t.outcome === 'win').length / rt.length) * 100 : 0 };
  });
  
  return {
    totalTrades: completedTrades.length, wins: wins.length, losses: losses.length, breakeven: breakeven.length,
    winRate: completedTrades.length > 0 ? (wins.length / completedTrades.length) * 100 : 0,
    avgWin, avgLoss, profitFactor: avgLoss > 0 ? avgWin / avgLoss : 0,
    followedDeskRate: completedTrades.length > 0 ? (followedDesk.length / completedTrades.length) * 100 : 0,
    winRateWhenFollowed: followedDesk.length > 0 ? (followedDesk.filter(t => t.outcome === 'win').length / followedDesk.length) * 100 : 0,
    winRateWhenIgnored: ignoredDesk.length > 0 ? (ignoredDesk.filter(t => t.outcome === 'win').length / ignoredDesk.length) * 100 : 0,
    regimeBreakdown
  };
}

// ============================================================================
// COMPONENTS
// ============================================================================

function StatusBadge({ status }: { status: TradeStatus }) {
  const cfg = {
    green_light: { color: 'bg-emerald-500', text: 'GREEN LIGHT', icon: CheckCircle },
    caution: { color: 'bg-yellow-500', text: 'CAUTION', icon: AlertTriangle },
    no_trade: { color: 'bg-red-500', text: 'NO TRADE', icon: XCircle }
  };
  const { color, text, icon: Icon } = cfg[status];
  return <div className={`${color} text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold`}><Icon className="w-5 h-5" />{text}</div>;
}

// ============================================================================
// SELF-AUDIT TAB
// ============================================================================

function SelfAuditTab() {
  const deskRules = [
    { category: 'Regime Detection', rules: [
      { rule: 'Trend Day = GEX < -3B + Vol Delta > |1.5|', status: 'active', description: 'Identifies when dealers must chase' },
      { rule: 'Mean Reversion = GEX > 4B + Charm Pinning', status: 'active', description: 'Identifies when fades work' },
      { rule: 'Vol Breakout = VIX Change > 8%', status: 'active', description: 'Identifies volatility expansion' },
      { rule: 'Gamma Squeeze = Vanna Hostile + Charm Unpinning', status: 'active', description: 'Identifies acceleration setups' },
      { rule: 'Choppy = Vol Delta < |0.5| + ADD Flat', status: 'active', description: 'Identifies NO TRADE conditions' },
    ]},
    { category: 'Fakeout Detection', rules: [
      { rule: 'Bull Trap = Price > ZG but Vol Delta < 0', status: 'active', description: 'Price rising without flow support' },
      { rule: 'Bear Trap = Price < ZG but Vol Delta > 0', status: 'active', description: 'Price falling against bullish flow' },
      { rule: 'Internals Lag = Price move without VOLD/TICK confirm', status: 'active', description: 'Breadth not confirming' },
      { rule: 'Dark Pool Mixed = No clear institutional direction', status: 'active', description: 'Smart money unclear' },
    ]},
    { category: 'Trade Gating', rules: [
      { rule: 'NO TRADE if regime = choppy_fakeout', status: 'enforced', description: 'Survival mode in chop' },
      { rule: 'NO TRADE if fakeout risk = high', status: 'enforced', description: 'Protect from traps' },
      { rule: 'NO TRADE if flow diverging + institutional opposed', status: 'enforced', description: 'Multiple red flags' },
      { rule: 'CAUTION if fakeout risk = medium', status: 'enforced', description: 'Reduce position size' },
      { rule: 'GREEN LIGHT requires flow confirming', status: 'enforced', description: 'Full size only with confluence' },
    ]},
    { category: 'Structure Selection', rules: [
      { rule: 'Trend Day → Vertical Spreads', status: 'active', description: 'Directional defined-risk' },
      { rule: 'Mean Reversion → Butterflies', status: 'active', description: 'Pinning structures' },
      { rule: 'Neutral/Range → Iron Condors', status: 'active', description: 'Premium collection' },
      { rule: 'No far OTM (lottos)', status: 'enforced', description: 'ITM/ATM only' },
      { rule: 'No scalps (<15 min hold)', status: 'enforced', description: 'Minimum hold time' },
    ]},
    { category: 'Risk Management', rules: [
      { rule: 'Stop = Structural (Zero Gamma / Wall breach)', status: 'enforced', description: 'Not arbitrary points' },
      { rule: 'Target = Next structural level', status: 'active', description: 'Call Wall / Put Wall / Zero Gamma' },
      { rule: 'Confidence ≥ 7 for full size', status: 'active', description: 'Scale size with confidence' },
      { rule: 'Max loss = defined by spread width', status: 'enforced', description: 'No naked exposure' },
    ]}
  ];

  return (
    <div className="space-y-6">
      <div className="card p-4 bg-primary/5 border border-primary/20">
        <h3 className="font-semibold flex items-center gap-2 mb-2"><Brain className="w-5 h-5 text-primary" />The Desk Methodology - Self-Audit</h3>
        <p className="text-sm text-[var(--text-secondary)]">These are the rules &quot;The Desk&quot; follows. Each rule is active and enforced in the Trade Scanner.</p>
      </div>
      {deskRules.map((category, i) => (
        <div key={i} className="card p-4">
          <h4 className="font-semibold mb-3 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500" />{category.category}</h4>
          <div className="space-y-2">
            {category.rules.map((rule, j) => (
              <div key={j} className="flex items-start gap-3 p-2 bg-[var(--surface)] rounded">
                <div className={`px-2 py-0.5 rounded text-xs font-medium ${rule.status === 'enforced' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-blue-500/20 text-blue-500'}`}>{rule.status === 'enforced' ? 'ENFORCED' : 'ACTIVE'}</div>
                <div className="flex-1"><p className="text-sm font-medium">{rule.rule}</p><p className="text-xs text-[var(--text-secondary)]">{rule.description}</p></div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// SIMULATOR TAB
// ============================================================================

function SimulatorTab() {
  const [input, setInput] = useState<SimulatorInput>({
    underlying: 'SPX', currentPrice: 6050, zeroGamma: 6045, callWall: 6100, putWall: 5980, netGex: 2.5,
    vannaFlow: 'neutral', charmEffect: 'neutral', volumeDelta: 0.8, vold: 0.5, tick: 150, addLine: 'rising',
    vix: 18, vixChange: -1.5, darkPoolPrints: 'bullish', institutionalFlow: 'accumulation'
  });
  const [result, setResult] = useState<SimulatorResult | null>(null);
  const [showDecisionTree, setShowDecisionTree] = useState(false);

  const presets = [
    { name: 'Trend Day Up', values: { netGex: -4, volumeDelta: 2.0, vold: 1.5, tick: 500, addLine: 'rising' as const, charmEffect: 'unpinning' as const } },
    { name: 'Trend Day Down', values: { netGex: -5, volumeDelta: -2.5, vold: -1.8, tick: -600, addLine: 'falling' as const, charmEffect: 'unpinning' as const } },
    { name: 'Mean Reversion', values: { netGex: 5, volumeDelta: 0.3, vold: 0.2, tick: 50, addLine: 'flat' as const, charmEffect: 'pinning' as const } },
    { name: 'Gamma Squeeze', values: { netGex: -2, volumeDelta: 1.5, vannaFlow: 'hostile' as const, charmEffect: 'unpinning' as const, vixChange: 5 } },
    { name: 'Choppy (No Trade)', values: { netGex: 1, volumeDelta: 0.2, vold: 0.1, tick: 20, addLine: 'flat' as const } },
    { name: 'Bull Trap', values: { netGex: -2, volumeDelta: -0.8, currentPrice: 6070, zeroGamma: 6050 } },
  ];

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h4 className="text-sm font-semibold mb-3">Quick Scenarios</h4>
        <div className="flex flex-wrap gap-2">
          {presets.map((p, i) => <button key={i} onClick={() => { setInput({...input, ...p.values}); setResult(null); }} className="px-3 py-1.5 bg-[var(--surface)] hover:bg-[var(--border)] rounded text-sm">{p.name}</button>)}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <div className="card p-4">
            <h4 className="text-sm font-semibold mb-3 text-emerald-500">GEX Structure</h4>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs text-[var(--text-secondary)]">Current Price</label><input type="number" value={input.currentPrice} onChange={e => setInput({...input, currentPrice: +e.target.value})} className="input w-full text-sm" /></div>
              <div><label className="text-xs text-[var(--text-secondary)]">Zero Gamma</label><input type="number" value={input.zeroGamma} onChange={e => setInput({...input, zeroGamma: +e.target.value})} className="input w-full text-sm" /></div>
              <div><label className="text-xs text-[var(--text-secondary)]">Call Wall</label><input type="number" value={input.callWall} onChange={e => setInput({...input, callWall: +e.target.value})} className="input w-full text-sm" /></div>
              <div><label className="text-xs text-[var(--text-secondary)]">Put Wall</label><input type="number" value={input.putWall} onChange={e => setInput({...input, putWall: +e.target.value})} className="input w-full text-sm" /></div>
              <div><label className="text-xs text-[var(--text-secondary)]">Net GEX ($B)</label><input type="number" step="0.1" value={input.netGex} onChange={e => setInput({...input, netGex: +e.target.value})} className="input w-full text-sm" /></div>
            </div>
          </div>
          <div className="card p-4">
            <h4 className="text-sm font-semibold mb-3 text-purple-500">Vanna / Charm</h4>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs text-[var(--text-secondary)]">Vanna Flow</label><select value={input.vannaFlow} onChange={e => setInput({...input, vannaFlow: e.target.value as any})} className="input w-full text-sm"><option value="supportive">Supportive</option><option value="hostile">Hostile</option><option value="neutral">Neutral</option></select></div>
              <div><label className="text-xs text-[var(--text-secondary)]">Charm Effect</label><select value={input.charmEffect} onChange={e => setInput({...input, charmEffect: e.target.value as any})} className="input w-full text-sm"><option value="pinning">Pinning</option><option value="unpinning">Unpinning</option><option value="neutral">Neutral</option></select></div>
            </div>
          </div>
          <div className="card p-4">
            <h4 className="text-sm font-semibold mb-3 text-blue-500">Flow</h4>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs text-[var(--text-secondary)]">Volume Delta</label><input type="number" step="0.1" value={input.volumeDelta} onChange={e => setInput({...input, volumeDelta: +e.target.value})} className="input w-full text-sm" /></div>
              <div><label className="text-xs text-[var(--text-secondary)]">Dark Pool</label><select value={input.darkPoolPrints} onChange={e => setInput({...input, darkPoolPrints: e.target.value as any})} className="input w-full text-sm"><option value="bullish">Bullish</option><option value="bearish">Bearish</option><option value="mixed">Mixed</option><option value="none">None</option></select></div>
              <div><label className="text-xs text-[var(--text-secondary)]">Institutional</label><select value={input.institutionalFlow} onChange={e => setInput({...input, institutionalFlow: e.target.value as any})} className="input w-full text-sm"><option value="accumulation">Accumulation</option><option value="distribution">Distribution</option><option value="neutral">Neutral</option></select></div>
            </div>
          </div>
          <div className="card p-4">
            <h4 className="text-sm font-semibold mb-3 text-orange-500">Internals</h4>
            <div className="grid grid-cols-3 gap-2">
              <div><label className="text-xs text-[var(--text-secondary)]">VOLD</label><input type="number" step="0.1" value={input.vold} onChange={e => setInput({...input, vold: +e.target.value})} className="input w-full text-sm" /></div>
              <div><label className="text-xs text-[var(--text-secondary)]">TICK</label><input type="number" value={input.tick} onChange={e => setInput({...input, tick: +e.target.value})} className="input w-full text-sm" /></div>
              <div><label className="text-xs text-[var(--text-secondary)]">ADD</label><select value={input.addLine} onChange={e => setInput({...input, addLine: e.target.value as any})} className="input w-full text-sm"><option value="rising">Rising</option><option value="falling">Falling</option><option value="flat">Flat</option></select></div>
            </div>
          </div>
          <div className="card p-4">
            <h4 className="text-sm font-semibold mb-3 text-red-500">VIX</h4>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs text-[var(--text-secondary)]">VIX</label><input type="number" step="0.1" value={input.vix} onChange={e => setInput({...input, vix: +e.target.value})} className="input w-full text-sm" /></div>
              <div><label className="text-xs text-[var(--text-secondary)]">VIX Change %</label><input type="number" step="0.1" value={input.vixChange} onChange={e => setInput({...input, vixChange: +e.target.value})} className="input w-full text-sm" /></div>
            </div>
          </div>
          <button onClick={() => setResult(analyzeWithDesk(input))} className="btn-primary w-full flex items-center justify-center gap-2"><Play className="w-4 h-4" />Run The Desk Analysis</button>
        </div>
        <div>
          {result ? (
            <div className="space-y-4">
              <div className={`card p-4 border ${result.status === 'green_light' ? 'bg-emerald-500/10 border-emerald-500/30' : result.status === 'caution' ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                <div className="flex items-center justify-between mb-3">
                  <StatusBadge status={result.status} />
                  <div className="text-right"><p className="text-xs text-[var(--text-secondary)]">Confidence</p><p className={`text-xl font-bold ${result.confidence >= 7 ? 'text-emerald-500' : result.confidence >= 5 ? 'text-yellow-500' : 'text-red-500'}`}>{result.confidence}/10</p></div>
                </div>
                <p className="text-sm">{result.statusReason}</p>
              </div>
              <div className="card p-4"><h4 className="font-semibold mb-2">Regime: {result.regime.replace(/_/g, ' ').toUpperCase()}</h4><p className="text-sm text-[var(--text-secondary)]">{result.regimeDescription}</p></div>
              {result.status !== 'no_trade' && (
                <div className="card p-4 border border-primary/30">
                  <h4 className="font-semibold mb-3">Trade Setup</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-[var(--text-secondary)]">Direction:</span> <span className={`font-medium ${result.direction === 'bullish' ? 'text-emerald-500' : result.direction === 'bearish' ? 'text-red-500' : 'text-blue-500'}`}>{result.direction.toUpperCase()}</span></div>
                    <div><span className="text-[var(--text-secondary)]">Structure:</span> <span className="font-medium">{result.structureSuggested}</span></div>
                    <div><span className="text-[var(--text-secondary)]">Entry Zone:</span> <span className="font-medium">{result.entryZone}</span></div>
                    <div><span className="text-[var(--text-secondary)]">Target:</span> <span className="font-medium text-emerald-500">${result.target}</span></div>
                    <div><span className="text-[var(--text-secondary)]">Invalidation:</span> <span className="font-medium text-red-500">${result.invalidation}</span></div>
                  </div>
                </div>
              )}
              {result.warnings.length > 0 && (
                <div className="card p-4 bg-yellow-500/10 border border-yellow-500/30">
                  <h4 className="font-semibold mb-2 text-yellow-500 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Warnings</h4>
                  <ul className="text-sm space-y-1">{result.warnings.map((w, i) => <li key={i}>• {w}</li>)}</ul>
                </div>
              )}
              <button onClick={() => setShowDecisionTree(!showDecisionTree)} className="text-sm text-primary hover:underline flex items-center gap-1"><Eye className="w-4 h-4" />{showDecisionTree ? 'Hide' : 'Show'} Decision Tree</button>
              {showDecisionTree && (
                <div className="card p-4">
                  <h4 className="font-semibold mb-3">Decision Tree</h4>
                  <div className="space-y-2">{result.decisionTree.map((step, i) => (
                    <div key={i} className={`p-2 rounded flex items-start gap-2 ${step.passed ? 'bg-emerald-500/10' : 'bg-[var(--surface)]'}`}>
                      {step.passed ? <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5" /> : <XCircle className="w-4 h-4 text-[var(--text-secondary)] mt-0.5" />}
                      <div><p className="text-sm font-medium">{step.check}</p><p className="text-xs text-[var(--text-secondary)]">{step.value}</p><p className="text-xs">{step.impact}</p></div>
                    </div>
                  ))}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="card p-8 flex flex-col items-center justify-center text-center min-h-[400px]">
              <Microscope className="w-12 h-12 text-[var(--text-secondary)] mb-4" />
              <h3 className="font-medium mb-2">Ready to Simulate</h3>
              <p className="text-sm text-[var(--text-secondary)]">Adjust inputs or select a preset, then run analysis</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TRADE JOURNAL TAB
// ============================================================================

function JournalTab() {
  const [trades, setTrades] = useState<TradeEntry[]>(() => {
    if (typeof window !== 'undefined') { const saved = localStorage.getItem('desk_trades'); return saved ? JSON.parse(saved) : []; }
    return [];
  });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<TradeEntry>>({ underlying: 'SPX', direction: 'bullish', structure: 'Bull Call Vertical', outcome: 'open', regimeAtEntry: 'trend_day', deskSignal: 'green_light', followedDesk: true, confidenceAtEntry: 7, vixAtEntry: 18, gexAtEntry: 2 });

  useEffect(() => { localStorage.setItem('desk_trades', JSON.stringify(trades)); }, [trades]);

  const stats = calculatePerformance(trades);

  const saveTrade = () => {
    const trade: TradeEntry = {
      id: editingId || Date.now().toString(), date: formData.date || new Date().toISOString().split('T')[0], time: formData.time || new Date().toLocaleTimeString(),
      underlying: formData.underlying || 'SPX', direction: formData.direction || 'bullish', structure: formData.structure || '', entry: formData.entry || 0, exit: formData.exit || null,
      target: formData.target || 0, invalidation: formData.invalidation || 0, outcome: formData.outcome || 'open', pnl: formData.pnl || null, regimeAtEntry: formData.regimeAtEntry || 'trend_day',
      deskSignal: formData.deskSignal || 'green_light', followedDesk: formData.followedDesk ?? true, confidenceAtEntry: formData.confidenceAtEntry || 5,
      setupNotes: formData.setupNotes || '', executionNotes: formData.executionNotes || '', lessonLearned: formData.lessonLearned || '', vixAtEntry: formData.vixAtEntry || 0, gexAtEntry: formData.gexAtEntry || 0
    };
    if (editingId) { setTrades(trades.map(t => t.id === editingId ? trade : t)); } else { setTrades([trade, ...trades]); }
    setShowForm(false); setEditingId(null);
    setFormData({ underlying: 'SPX', direction: 'bullish', structure: 'Bull Call Vertical', outcome: 'open', regimeAtEntry: 'trend_day', deskSignal: 'green_light', followedDesk: true, confidenceAtEntry: 7, vixAtEntry: 18, gexAtEntry: 2 });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-3"><p className="text-xs text-[var(--text-secondary)]">Total Trades</p><p className="text-2xl font-bold">{stats.totalTrades}</p></div>
        <div className="card p-3"><p className="text-xs text-[var(--text-secondary)]">Win Rate</p><p className={`text-2xl font-bold ${stats.winRate >= 50 ? 'text-emerald-500' : 'text-red-500'}`}>{stats.winRate.toFixed(1)}%</p></div>
        <div className="card p-3"><p className="text-xs text-[var(--text-secondary)]">Followed Desk</p><p className="text-2xl font-bold text-primary">{stats.followedDeskRate.toFixed(0)}%</p></div>
        <div className="card p-3"><p className="text-xs text-[var(--text-secondary)]">Profit Factor</p><p className={`text-2xl font-bold ${stats.profitFactor >= 1.5 ? 'text-emerald-500' : stats.profitFactor >= 1 ? 'text-yellow-500' : 'text-red-500'}`}>{stats.profitFactor.toFixed(2)}</p></div>
      </div>
      <div className="card p-4 bg-primary/5 border border-primary/20">
        <h4 className="font-semibold mb-2 flex items-center gap-2"><Award className="w-5 h-5 text-primary" />Desk Compliance Analysis</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><p className="text-[var(--text-secondary)]">Win Rate When Following Desk:</p><p className={`text-lg font-bold ${stats.winRateWhenFollowed >= 60 ? 'text-emerald-500' : 'text-yellow-500'}`}>{stats.winRateWhenFollowed.toFixed(1)}%</p></div>
          <div><p className="text-[var(--text-secondary)]">Win Rate When Ignoring Desk:</p><p className={`text-lg font-bold ${stats.winRateWhenIgnored < stats.winRateWhenFollowed ? 'text-red-500' : 'text-yellow-500'}`}>{stats.winRateWhenIgnored.toFixed(1)}%</p></div>
        </div>
      </div>
      <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />Log New Trade</button>
      {showForm && (
        <div className="card p-4 border border-primary/30">
          <h4 className="font-semibold mb-4">{editingId ? 'Edit Trade' : 'New Trade Entry'}</h4>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <div><label className="block text-xs text-[var(--text-secondary)] mb-1">Date</label><input type="date" value={formData.date || ''} onChange={e => setFormData({...formData, date: e.target.value})} className="input w-full" /></div>
            <div><label className="block text-xs text-[var(--text-secondary)] mb-1">Underlying</label><select value={formData.underlying} onChange={e => setFormData({...formData, underlying: e.target.value})} className="input w-full"><option>SPX</option><option>SPY</option><option>QQQ</option><option>NDX</option></select></div>
            <div><label className="block text-xs text-[var(--text-secondary)] mb-1">Direction</label><select value={formData.direction} onChange={e => setFormData({...formData, direction: e.target.value as any})} className="input w-full"><option value="bullish">Bullish</option><option value="bearish">Bearish</option><option value="neutral">Neutral</option></select></div>
            <div><label className="block text-xs text-[var(--text-secondary)] mb-1">Structure</label><input value={formData.structure || ''} onChange={e => setFormData({...formData, structure: e.target.value})} className="input w-full" placeholder="e.g., Bull Call Vertical" /></div>
            <div><label className="block text-xs text-[var(--text-secondary)] mb-1">Entry Price</label><input type="number" value={formData.entry || ''} onChange={e => setFormData({...formData, entry: +e.target.value})} className="input w-full" /></div>
            <div><label className="block text-xs text-[var(--text-secondary)] mb-1">Exit Price</label><input type="number" value={formData.exit || ''} onChange={e => setFormData({...formData, exit: +e.target.value || null})} className="input w-full" /></div>
            <div><label className="block text-xs text-[var(--text-secondary)] mb-1">Target</label><input type="number" value={formData.target || ''} onChange={e => setFormData({...formData, target: +e.target.value})} className="input w-full" /></div>
            <div><label className="block text-xs text-[var(--text-secondary)] mb-1">Invalidation</label><input type="number" value={formData.invalidation || ''} onChange={e => setFormData({...formData, invalidation: +e.target.value})} className="input w-full" /></div>
            <div><label className="block text-xs text-[var(--text-secondary)] mb-1">Outcome</label><select value={formData.outcome} onChange={e => setFormData({...formData, outcome: e.target.value as any})} className="input w-full"><option value="open">Open</option><option value="win">Win</option><option value="loss">Loss</option><option value="breakeven">Breakeven</option></select></div>
            <div><label className="block text-xs text-[var(--text-secondary)] mb-1">P&L ($)</label><input type="number" value={formData.pnl || ''} onChange={e => setFormData({...formData, pnl: +e.target.value || null})} className="input w-full" /></div>
            <div><label className="block text-xs text-[var(--text-secondary)] mb-1">Regime</label><select value={formData.regimeAtEntry} onChange={e => setFormData({...formData, regimeAtEntry: e.target.value as any})} className="input w-full"><option value="trend_day">Trend Day</option><option value="mean_reversion">Mean Reversion</option><option value="volatility_breakout">Vol Breakout</option><option value="gamma_squeeze">Gamma Squeeze</option><option value="choppy_fakeout">Choppy</option></select></div>
            <div><label className="block text-xs text-[var(--text-secondary)] mb-1">Desk Signal</label><select value={formData.deskSignal} onChange={e => setFormData({...formData, deskSignal: e.target.value as any})} className="input w-full"><option value="green_light">Green Light</option><option value="caution">Caution</option><option value="no_trade">No Trade</option></select></div>
            <div><label className="block text-xs text-[var(--text-secondary)] mb-1">Followed Desk?</label><select value={formData.followedDesk ? 'yes' : 'no'} onChange={e => setFormData({...formData, followedDesk: e.target.value === 'yes'})} className="input w-full"><option value="yes">Yes</option><option value="no">No</option></select></div>
            <div><label className="block text-xs text-[var(--text-secondary)] mb-1">Confidence</label><input type="number" min="0" max="10" value={formData.confidenceAtEntry || ''} onChange={e => setFormData({...formData, confidenceAtEntry: +e.target.value})} className="input w-full" /></div>
            <div><label className="block text-xs text-[var(--text-secondary)] mb-1">VIX</label><input type="number" step="0.1" value={formData.vixAtEntry || ''} onChange={e => setFormData({...formData, vixAtEntry: +e.target.value})} className="input w-full" /></div>
            <div><label className="block text-xs text-[var(--text-secondary)] mb-1">Net GEX</label><input type="number" step="0.1" value={formData.gexAtEntry || ''} onChange={e => setFormData({...formData, gexAtEntry: +e.target.value})} className="input w-full" /></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3">
            <div><label className="block text-xs text-[var(--text-secondary)] mb-1">Setup Notes</label><textarea value={formData.setupNotes || ''} onChange={e => setFormData({...formData, setupNotes: e.target.value})} className="input w-full h-20" placeholder="Why did you take this trade?" /></div>
            <div><label className="block text-xs text-[var(--text-secondary)] mb-1">Execution Notes</label><textarea value={formData.executionNotes || ''} onChange={e => setFormData({...formData, executionNotes: e.target.value})} className="input w-full h-20" placeholder="How was the execution?" /></div>
            <div><label className="block text-xs text-[var(--text-secondary)] mb-1">Lesson Learned</label><textarea value={formData.lessonLearned || ''} onChange={e => setFormData({...formData, lessonLearned: e.target.value})} className="input w-full h-20" placeholder="What did you learn?" /></div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={saveTrade} className="btn-primary flex items-center gap-2"><Save className="w-4 h-4" />Save Trade</button>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="px-4 py-2 bg-[var(--surface)] hover:bg-[var(--border)] rounded">Cancel</button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {trades.map(trade => (
          <div key={trade.id} className={`card p-3 border ${trade.outcome === 'win' ? 'border-emerald-500/30' : trade.outcome === 'loss' ? 'border-red-500/30' : 'border-[var(--border)]'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`px-2 py-1 rounded text-xs font-bold ${trade.outcome === 'win' ? 'bg-emerald-500/20 text-emerald-500' : trade.outcome === 'loss' ? 'bg-red-500/20 text-red-500' : trade.outcome === 'breakeven' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-blue-500/20 text-blue-500'}`}>{trade.outcome.toUpperCase()}</div>
                <div><p className="font-medium">{trade.underlying} {trade.direction.toUpperCase()} - {trade.structure}</p><p className="text-xs text-[var(--text-secondary)]">{trade.date} | Entry: ${trade.entry} | {trade.regimeAtEntry.replace(/_/g, ' ')}</p></div>
              </div>
              <div className="flex items-center gap-3">
                {trade.pnl !== null && <span className={`font-bold ${trade.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{trade.pnl >= 0 ? '+' : ''}${trade.pnl}</span>}
                <div className={`px-2 py-0.5 rounded text-xs ${trade.followedDesk ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>{trade.followedDesk ? '✓ Followed' : '✗ Ignored'}</div>
                <button onClick={() => { setFormData(trade); setEditingId(trade.id); setShowForm(true); }} className="p-1 hover:bg-[var(--surface)] rounded"><Edit className="w-4 h-4" /></button>
                <button onClick={() => setTrades(trades.filter(t => t.id !== trade.id))} className="p-1 hover:bg-[var(--surface)] rounded text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        ))}
        {trades.length === 0 && <div className="card p-8 text-center"><ClipboardList className="w-12 h-12 text-[var(--text-secondary)] mx-auto mb-4" /><p className="text-[var(--text-secondary)]">No trades logged yet. Click &quot;Log New Trade&quot; to start.</p></div>}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN
// ============================================================================

export default function DeskCommandCenter() {
  const [activeTab, setActiveTab] = useState<'audit' | 'simulator' | 'journal'>('simulator');

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <Link href="/zero-dte" className="text-sm text-[var(--text-secondary)] hover:text-primary flex items-center gap-1 mb-2"><ArrowLeft className="w-4 h-4" />Back to Dashboard</Link>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><Shield className="w-6 h-6 text-primary" />The Desk Command Center</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Self-Audit • Regime Simulator • Trade Journal</p>
      </div>
      <div className="flex gap-2 border-b border-[var(--border)] pb-2">
        <button onClick={() => setActiveTab('audit')} className={`px-4 py-2 rounded-t text-sm font-medium flex items-center gap-2 ${activeTab === 'audit' ? 'bg-primary text-white' : 'hover:bg-[var(--surface)]'}`}><Brain className="w-4 h-4" />Self-Audit</button>
        <button onClick={() => setActiveTab('simulator')} className={`px-4 py-2 rounded-t text-sm font-medium flex items-center gap-2 ${activeTab === 'simulator' ? 'bg-primary text-white' : 'hover:bg-[var(--surface)]'}`}><Microscope className="w-4 h-4" />Regime Simulator</button>
        <button onClick={() => setActiveTab('journal')} className={`px-4 py-2 rounded-t text-sm font-medium flex items-center gap-2 ${activeTab === 'journal' ? 'bg-primary text-white' : 'hover:bg-[var(--surface)]'}`}><ClipboardList className="w-4 h-4" />Trade Journal</button>
      </div>
      {activeTab === 'audit' && <SelfAuditTab />}
      {activeTab === 'simulator' && <SimulatorTab />}
      {activeTab === 'journal' && <JournalTab />}
    </div>
  );
}
