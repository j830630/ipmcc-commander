'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, FlaskConical, Search, RefreshCw, Target, DollarSign,
  TrendingUp, TrendingDown, Percent, Calendar, Activity, BarChart3,
  CheckCircle, AlertTriangle, ChevronDown, Briefcase, Clock, Zap
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

type Strategy = 'ipmcc' | '112' | 'strangle';
type InputMode = 'new' | 'position';

interface OptionExpiration {
  date: string;
  daysToExp: number;
  label: string;
}

interface OptionStrike {
  strike: number;
  callBid: number;
  callAsk: number;
  callDelta: number;
  callIV: number;
  putBid: number;
  putAsk: number;
  putDelta: number;
  putIV: number;
}

interface OptionsChain {
  expirations: OptionExpiration[];
  strikes: OptionStrike[];
  underlyingPrice: number;
  ivRank: number;
  ivPercentile: number;
}

interface Position {
  id: string;
  ticker: string;
  strategy: Strategy;
  optionType: string;
  strike: number;
  expiration: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
}

interface AnalysisResult {
  strategy: Strategy;
  score: number;
  signal: string;
  ivScore: number;
  trendScore: number;
  riskScore: number;
  recommendation: string;
  strikes: string;
  targetProfit: string;
  maxRisk: string;
  expectedReturn: string;
  warnings: string[];
}

// ============================================================================
// MOCK POSITIONS (Replace with API)
// ============================================================================

const MOCK_POSITIONS: Position[] = [
  { id: '1', ticker: 'AAPL', strategy: 'ipmcc', optionType: 'CALL', strike: 245, expiration: '2026-03-21', quantity: 2, entryPrice: 2.45, currentPrice: 1.85, unrealizedPnL: -120 },
  { id: '2', ticker: 'NVDA', strategy: '112', optionType: 'SPREAD', strike: 880, expiration: '2026-03-14', quantity: 1, entryPrice: 1.20, currentPrice: 2.15, unrealizedPnL: 95 },
  { id: '3', ticker: 'SPY', strategy: 'strangle', optionType: 'COMBO', strike: 580, expiration: '2026-03-07', quantity: 1, entryPrice: 4.80, currentPrice: 3.20, unrealizedPnL: 160 },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateMockChain(price: number): OptionsChain {
  const atm = Math.round(price / 5) * 5;
  const expirations: OptionExpiration[] = [];
  const today = new Date();
  
  // Generate expirations (weeklies for 8 weeks + monthlies)
  for (let i = 1; i <= 8; i++) {
    const expDate = new Date(today);
    expDate.setDate(expDate.getDate() + (i * 7));
    // Adjust to Friday
    const dayOfWeek = expDate.getDay();
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
    expDate.setDate(expDate.getDate() + daysUntilFriday);
    
    expirations.push({
      date: expDate.toISOString().split('T')[0],
      daysToExp: Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
      label: expDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    });
  }
  
  // Generate strikes around ATM
  const strikes: OptionStrike[] = [];
  for (let offset = -10; offset <= 10; offset++) {
    const strike = atm + (offset * 5);
    const moneyness = (strike - price) / price;
    
    // Simplified pricing model
    const baseIV = 0.25 + Math.abs(moneyness) * 0.1;
    const callDelta = 0.5 - moneyness * 2;
    const putDelta = callDelta - 1;
    
    const callPrice = Math.max(0.05, (price - strike) + price * baseIV * 0.1);
    const putPrice = Math.max(0.05, (strike - price) + price * baseIV * 0.1);
    
    strikes.push({
      strike,
      callBid: Number((callPrice * 0.98).toFixed(2)),
      callAsk: Number((callPrice * 1.02).toFixed(2)),
      callDelta: Number(Math.max(0, Math.min(1, callDelta)).toFixed(2)),
      callIV: Number((baseIV * 100).toFixed(1)),
      putBid: Number((putPrice * 0.98).toFixed(2)),
      putAsk: Number((putPrice * 1.02).toFixed(2)),
      putDelta: Number(Math.max(-1, Math.min(0, putDelta)).toFixed(2)),
      putIV: Number((baseIV * 100).toFixed(1)),
    });
  }
  
  return {
    expirations,
    strikes,
    underlyingPrice: price,
    ivRank: Math.floor(Math.random() * 60 + 20),
    ivPercentile: Math.floor(Math.random() * 60 + 20)
  };
}

function analyzeStrategy(
  strategy: Strategy,
  price: number,
  strike: number,
  premium: number,
  ivRank: number,
  dte: number
): AnalysisResult {
  const warnings: string[] = [];
  let score = 50;
  let ivScore = ivRank;
  let trendScore = 50;
  let riskScore = 50;
  
  // IV Analysis
  if (ivRank >= 50) score += 15;
  else if (ivRank >= 40) score += 8;
  else {
    score -= 10;
    warnings.push('IV Rank below 40 - limited premium');
  }
  
  // DTE Analysis
  if (dte >= 30 && dte <= 45) {
    score += 10;
  } else if (dte < 21) {
    score -= 5;
    warnings.push('DTE < 21 - consider rolling');
  } else if (dte > 60) {
    warnings.push('DTE > 60 - theta decay slower');
  }
  
  // Strategy-specific
  let recommendation = '';
  let strikes = '';
  let targetProfit = '';
  let maxRisk = '';
  let expectedReturn = '';
  const atm = Math.round(price / 5) * 5;
  
  if (strategy === 'ipmcc') {
    const otmStrike = atm + 10;
    strikes = `Sell ${otmStrike} Call @ 0.20-0.30 delta`;
    targetProfit = '50% of credit received';
    maxRisk = 'Stock ownership below cost basis';
    expectedReturn = `${(ivRank / 50 * 1.5).toFixed(1)}% - ${(ivRank / 50 * 2.5).toFixed(1)}% monthly`;
    recommendation = `Write ${dte}DTE covered call at ${otmStrike}`;
    riskScore = 30; // Low risk
  } else if (strategy === '112') {
    strikes = `Buy 1x ${atm}C / Sell 1x ${atm + 5}C / Sell 2x ${atm + 15}C`;
    targetProfit = '50-100% of credit';
    maxRisk = `Defined: ${(atm + 15) - (atm + 5)} wide - credit`;
    expectedReturn = 'Net credit target';
    recommendation = `Bullish 112 structure with ${dte}DTE`;
    riskScore = 40;
  } else if (strategy === 'strangle') {
    const callStrike = atm + 25;
    const putStrike = atm - 25;
    strikes = `Sell ${putStrike}P / Sell ${callStrike}C`;
    targetProfit = '50% of credit';
    maxRisk = 'UNDEFINED - position size max 2%';
    expectedReturn = `${(ivRank / 50 * 2).toFixed(1)}% - ${(ivRank / 50 * 4).toFixed(1)}% if in range`;
    recommendation = `Short ${dte}DTE strangle at ${putStrike}P/${callStrike}C`;
    riskScore = 80; // High risk
    
    if (ivRank < 50) {
      warnings.push('IV Rank < 50: Premium may not justify strangle risk');
      score -= 15;
    }
  }
  
  score = Math.max(0, Math.min(100, score));
  
  const signal = score >= 70 ? 'STRONG BUY' :
                 score >= 55 ? 'BUY' :
                 score >= 40 ? 'NEUTRAL' :
                 score >= 25 ? 'AVOID' : 'STRONG AVOID';
  
  return {
    strategy,
    score,
    signal,
    ivScore,
    trendScore,
    riskScore,
    recommendation,
    strikes,
    targetProfit,
    maxRisk,
    expectedReturn,
    warnings
  };
}

// ============================================================================
// COMPONENTS
// ============================================================================

function PositionSelector({ 
  positions, 
  onSelect 
}: { 
  positions: Position[]; 
  onSelect: (p: Position) => void;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-[var(--text-secondary)]">Select Existing Position</h4>
      {positions.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">No open positions</p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {positions.map(p => (
            <button
              key={p.id}
              onClick={() => onSelect(p)}
              className="w-full flex items-center justify-between p-3 bg-[var(--surface)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors text-left"
            >
              <div>
                <span className="font-bold">{p.ticker}</span>
                <span className="text-xs text-[var(--text-secondary)] ml-2">{p.strategy.toUpperCase()}</span>
                <p className="text-xs text-[var(--text-secondary)]">
                  {p.strike} {p.optionType} • Exp {p.expiration}
                </p>
              </div>
              <span className={`font-bold ${p.unrealizedPnL >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {p.unrealizedPnL >= 0 ? '+' : ''}${p.unrealizedPnL.toFixed(0)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function OptionsChainDisplay({
  chain,
  selectedStrike,
  selectedExpiration,
  onSelectStrike,
  onSelectExpiration
}: {
  chain: OptionsChain;
  selectedStrike: number | null;
  selectedExpiration: string | null;
  onSelectStrike: (strike: number, premium: number) => void;
  onSelectExpiration: (exp: string, dte: number) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Expirations */}
      <div>
        <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-2">Expiration</h4>
        <div className="flex flex-wrap gap-2">
          {chain.expirations.slice(0, 6).map(exp => (
            <button
              key={exp.date}
              onClick={() => onSelectExpiration(exp.date, exp.daysToExp)}
              className={`px-3 py-1.5 rounded text-sm ${
                selectedExpiration === exp.date 
                  ? 'bg-primary text-white' 
                  : 'bg-[var(--surface)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              {exp.label}
              <span className="text-xs opacity-75 ml-1">({exp.daysToExp}d)</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Strikes */}
      <div>
        <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-2">Strikes</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-[var(--text-secondary)]">
              <tr>
                <th className="py-2 text-left">Call Δ</th>
                <th className="py-2 text-left">Call Bid/Ask</th>
                <th className="py-2 text-center font-bold">Strike</th>
                <th className="py-2 text-right">Put Bid/Ask</th>
                <th className="py-2 text-right">Put Δ</th>
              </tr>
            </thead>
            <tbody>
              {chain.strikes.map(s => {
                const isATM = Math.abs(s.strike - chain.underlyingPrice) < 2.5;
                const isSelected = selectedStrike === s.strike;
                
                return (
                  <tr 
                    key={s.strike}
                    className={`border-t border-[var(--border)] cursor-pointer hover:bg-[var(--surface)] ${
                      isSelected ? 'bg-primary/10' : isATM ? 'bg-yellow-500/5' : ''
                    }`}
                  >
                    <td className="py-2 text-emerald-500">{s.callDelta.toFixed(2)}</td>
                    <td 
                      className="py-2 cursor-pointer hover:text-primary"
                      onClick={() => onSelectStrike(s.strike, (s.callBid + s.callAsk) / 2)}
                    >
                      ${s.callBid.toFixed(2)} / ${s.callAsk.toFixed(2)}
                    </td>
                    <td className={`py-2 text-center font-bold ${isATM ? 'text-yellow-500' : ''}`}>
                      {s.strike}
                      {isATM && <span className="text-xs ml-1">(ATM)</span>}
                    </td>
                    <td 
                      className="py-2 text-right cursor-pointer hover:text-primary"
                      onClick={() => onSelectStrike(s.strike, (s.putBid + s.putAsk) / 2)}
                    >
                      ${s.putBid.toFixed(2)} / ${s.putAsk.toFixed(2)}
                    </td>
                    <td className="py-2 text-right text-red-500">{s.putDelta.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AnalysisResultPanel({ result }: { result: AnalysisResult }) {
  const signalColors = {
    'STRONG BUY': 'bg-emerald-500',
    'BUY': 'bg-emerald-400',
    'NEUTRAL': 'bg-yellow-500',
    'AVOID': 'bg-orange-500',
    'STRONG AVOID': 'bg-red-500'
  };
  
  return (
    <div className="space-y-4">
      {/* Signal */}
      <div className={`${signalColors[result.signal as keyof typeof signalColors]}/10 border border-${signalColors[result.signal as keyof typeof signalColors].replace('bg-', '')}/30 rounded-lg p-4`}>
        <div className="flex justify-between items-center">
          <div className={`${signalColors[result.signal as keyof typeof signalColors]} text-white px-4 py-2 rounded-lg font-bold`}>
            {result.signal}
          </div>
          <div className="text-right">
            <p className="text-xs text-[var(--text-secondary)]">Score</p>
            <p className={`text-2xl font-bold ${
              result.score >= 60 ? 'text-emerald-500' : 
              result.score >= 40 ? 'text-yellow-500' : 'text-red-500'
            }`}>{result.score}</p>
          </div>
        </div>
      </div>
      
      {/* Score Breakdown */}
      <div className="card p-4">
        <h4 className="font-semibold mb-3">Score Breakdown</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">IV Score</span>
            <div className="flex items-center gap-2">
              <div className="w-20 h-2 bg-[var(--surface)] rounded-full overflow-hidden">
                <div className="h-full bg-purple-500" style={{ width: `${result.ivScore}%` }} />
              </div>
              <span className="text-sm font-bold w-8">{result.ivScore}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Trend Score</span>
            <div className="flex items-center gap-2">
              <div className="w-20 h-2 bg-[var(--surface)] rounded-full overflow-hidden">
                <div className="h-full bg-blue-500" style={{ width: `${result.trendScore}%` }} />
              </div>
              <span className="text-sm font-bold w-8">{result.trendScore}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Risk Score</span>
            <div className="flex items-center gap-2">
              <div className="w-20 h-2 bg-[var(--surface)] rounded-full overflow-hidden">
                <div className="h-full bg-red-500" style={{ width: `${result.riskScore}%` }} />
              </div>
              <span className="text-sm font-bold w-8">{result.riskScore}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Recommendation */}
      <div className="card p-4 border border-primary/30">
        <h4 className="font-semibold mb-3">Recommendation</h4>
        <p className="mb-3">{result.recommendation}</p>
        <div className="bg-[var(--surface)] p-3 rounded font-mono text-sm mb-3">
          {result.strikes}
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="p-2 bg-[var(--surface)] rounded">
            <p className="text-xs text-[var(--text-secondary)]">Target</p>
            <p className="font-medium">{result.targetProfit}</p>
          </div>
          <div className="p-2 bg-[var(--surface)] rounded">
            <p className="text-xs text-[var(--text-secondary)]">Max Risk</p>
            <p className="font-medium text-red-500">{result.maxRisk}</p>
          </div>
          <div className="col-span-2 p-2 bg-[var(--surface)] rounded">
            <p className="text-xs text-[var(--text-secondary)]">Expected Return</p>
            <p className="font-medium">{result.expectedReturn}</p>
          </div>
        </div>
      </div>
      
      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="card p-4 bg-yellow-500/10 border border-yellow-500/30">
          <h4 className="font-semibold mb-2 text-yellow-500 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />Warnings
          </h4>
          <ul className="space-y-1 text-sm">
            {result.warnings.map((w, i) => (
              <li key={i}>• {w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function TradeLab() {
  // Input mode
  const [inputMode, setInputMode] = useState<InputMode>('new');
  
  // Position state
  const [positions, setPositions] = useState<Position[]>(MOCK_POSITIONS);
  
  // New trade inputs
  const [ticker, setTicker] = useState('');
  const [strategy, setStrategy] = useState<Strategy>('ipmcc');
  const [price, setPrice] = useState<number>(0);
  const [strike, setStrike] = useState<number | null>(null);
  const [premium, setPremium] = useState<number>(0);
  const [expiration, setExpiration] = useState<string | null>(null);
  const [dte, setDte] = useState<number>(30);
  
  // Options chain
  const [chain, setChain] = useState<OptionsChain | null>(null);
  const [chainLoading, setChainLoading] = useState(false);
  
  // Analysis result
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  
  // Fetch quote & chain
  const fetchData = useCallback(async () => {
    if (!ticker) return;
    
    setChainLoading(true);
    try {
      // Fetch quote
      const quoteRes = await fetch(`/api/v1/market/quote/${ticker}`);
      let quotePrice = 100;
      
      if (quoteRes.ok) {
        const data = await quoteRes.json();
        quotePrice = data.price || 100;
      }
      setPrice(quotePrice);
      
      // Fetch options chain (or generate mock)
      try {
        const chainRes = await fetch(`/api/v1/market/chain/${ticker}`);
        if (chainRes.ok) {
          const chainData = await chainRes.json();
          setChain(chainData);
        } else {
          // Use mock chain
          setChain(generateMockChain(quotePrice));
        }
      } catch {
        setChain(generateMockChain(quotePrice));
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setChain(generateMockChain(100));
    } finally {
      setChainLoading(false);
    }
  }, [ticker]);
  
  // Load position into form
  const loadPosition = (pos: Position) => {
    setTicker(pos.ticker);
    setStrategy(pos.strategy);
    setStrike(pos.strike);
    setPremium(pos.currentPrice);
    setExpiration(pos.expiration);
    
    // Calculate DTE
    const expDate = new Date(pos.expiration);
    const today = new Date();
    const daysToExp = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    setDte(daysToExp);
    
    // Fetch fresh data
    setTimeout(() => fetchData(), 100);
  };
  
  // Run analysis
  const runAnalysis = () => {
    if (!ticker || !strike || !chain) return;
    
    setAnalyzing(true);
    setTimeout(() => {
      const analysisResult = analyzeStrategy(
        strategy,
        chain.underlyingPrice,
        strike,
        premium,
        chain.ivRank,
        dte
      );
      setResult(analysisResult);
      setAnalyzing(false);
    }, 500);
  };
  
  // Fetch positions
  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const res = await fetch('/api/v1/positions?status=open');
        if (res.ok) {
          const data = await res.json();
          if (data.positions) setPositions(data.positions);
        }
      } catch {
        // Use mock data
      }
    };
    fetchPositions();
  }, []);
  
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <Link href="/" className="text-sm text-[var(--text-secondary)] hover:text-primary flex items-center gap-1 mb-2">
          <ArrowLeft className="w-4 h-4" />Dashboard
        </Link>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <FlaskConical className="w-6 h-6 text-purple-500" />
          Trade Lab
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Analyze trades with live options data
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Inputs */}
        <div className="space-y-4">
          {/* Input Mode Toggle */}
          <div className="flex rounded-lg overflow-hidden border border-[var(--border)]">
            <button
              onClick={() => setInputMode('new')}
              className={`flex-1 px-4 py-2 text-sm ${inputMode === 'new' ? 'bg-primary text-white' : ''}`}
            >
              New Analysis
            </button>
            <button
              onClick={() => setInputMode('position')}
              className={`flex-1 px-4 py-2 text-sm ${inputMode === 'position' ? 'bg-primary text-white' : ''}`}
            >
              From Position
            </button>
          </div>
          
          {/* Position Selector */}
          {inputMode === 'position' && (
            <div className="card p-4">
              <PositionSelector positions={positions} onSelect={loadPosition} />
            </div>
          )}
          
          {/* Ticker & Strategy */}
          <div className="card p-4 space-y-3">
            <div>
              <label className="text-xs text-[var(--text-secondary)]">Ticker Symbol</label>
              <div className="flex gap-2 mt-1">
                <input
                  type="text"
                  value={ticker}
                  onChange={e => setTicker(e.target.value.toUpperCase())}
                  placeholder="SPY, AAPL, NVDA..."
                  className="input flex-1"
                />
                <button 
                  onClick={fetchData}
                  disabled={!ticker || chainLoading}
                  className="btn-primary px-4"
                >
                  {chainLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </button>
              </div>
            </div>
            
            <div>
              <label className="text-xs text-[var(--text-secondary)]">Strategy</label>
              <select value={strategy} onChange={e => setStrategy(e.target.value as Strategy)} className="input w-full mt-1">
                <option value="ipmcc">IPMCC (Covered Calls)</option>
                <option value="112">112 Trade</option>
                <option value="strangle">Short Strangle</option>
              </select>
            </div>
            
            {price > 0 && (
              <div className="flex justify-between p-2 bg-[var(--surface)] rounded">
                <span className="text-sm text-[var(--text-secondary)]">Current Price</span>
                <span className="font-bold">${price.toFixed(2)}</span>
              </div>
            )}
            
            {chain && (
              <div className="flex justify-between p-2 bg-purple-500/10 rounded">
                <span className="text-sm">IV Rank</span>
                <span className="font-bold text-purple-500">{chain.ivRank}</span>
              </div>
            )}
          </div>
          
          {/* Selected Values */}
          {(strike || expiration) && (
            <div className="card p-4">
              <h4 className="font-semibold mb-3">Selected</h4>
              <div className="space-y-2 text-sm">
                {expiration && (
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Expiration</span>
                    <span className="font-medium">{expiration} ({dte}d)</span>
                  </div>
                )}
                {strike && (
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Strike</span>
                    <span className="font-medium">${strike}</span>
                  </div>
                )}
                {premium > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Premium</span>
                    <span className="font-medium">${premium.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <button
            onClick={runAnalysis}
            disabled={!ticker || !strike || !chain || analyzing}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {analyzing ? (
              <><RefreshCw className="w-4 h-4 animate-spin" />Analyzing...</>
            ) : (
              <><Zap className="w-4 h-4" />Analyze Trade</>
            )}
          </button>
        </div>
        
        {/* MIDDLE: Options Chain */}
        <div className="card p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-500" />
            Options Chain
          </h3>
          
          {chainLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : chain ? (
            <OptionsChainDisplay
              chain={chain}
              selectedStrike={strike}
              selectedExpiration={expiration}
              onSelectStrike={(s, p) => { setStrike(s); setPremium(p); }}
              onSelectExpiration={(e, d) => { setExpiration(e); setDte(d); }}
            />
          ) : (
            <div className="text-center py-12 text-[var(--text-secondary)]">
              <Activity className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>Enter a ticker and click search to load options chain</p>
            </div>
          )}
        </div>
        
        {/* RIGHT: Analysis Result */}
        <div>
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            Analysis
          </h3>
          
          {result ? (
            <AnalysisResultPanel result={result} />
          ) : (
            <div className="card p-8 text-center">
              <BarChart3 className="w-12 h-12 mx-auto mb-4 text-[var(--text-secondary)] opacity-30" />
              <p className="text-[var(--text-secondary)]">
                Select ticker, expiration, and strike, then click Analyze
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
