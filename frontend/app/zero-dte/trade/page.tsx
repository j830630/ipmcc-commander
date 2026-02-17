'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Zap,
  Target,
  ArrowLeft,
  Calculator,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Info,
  DollarSign,
  Clock,
  Shield,
  RefreshCw,
  Play,
  Settings,
  ArrowUpCircle,
  ArrowDownCircle,
  Minus
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

type StrategyType = 
  | 'long_call'      // Simple: Buy call (bullish)
  | 'long_put'       // Simple: Buy put (bearish)
  | 'call_spread'    // 2-leg: Bull call spread
  | 'put_spread'     // 2-leg: Bear put spread
  | 'iron_condor';   // 4-leg: Sell call spread + sell put spread

interface StrategyInfo {
  name: string;
  description: string;
  legs: number;
  risk: string;
  bias: string;
  icon: React.ElementType;
  color: string;
  when: string;
}

const STRATEGIES: Record<StrategyType, StrategyInfo> = {
  long_call: {
    name: 'Long Call',
    description: 'Buy a call option to profit from upward price movement',
    legs: 1,
    risk: 'Limited to premium paid',
    bias: 'Bullish',
    icon: ArrowUpCircle,
    color: 'text-emerald-500',
    when: 'When expecting a rally toward Call Wall'
  },
  long_put: {
    name: 'Long Put',
    description: 'Buy a put option to profit from downward price movement',
    legs: 1,
    risk: 'Limited to premium paid',
    bias: 'Bearish',
    icon: ArrowDownCircle,
    color: 'text-red-500',
    when: 'When expecting a drop toward Put Wall'
  },
  call_spread: {
    name: 'Bull Call Spread',
    description: 'Buy a call, sell a higher strike call to reduce cost',
    legs: 2,
    risk: 'Limited to net debit',
    bias: 'Bullish',
    icon: TrendingUp,
    color: 'text-emerald-500',
    when: 'Bullish but want to reduce premium cost'
  },
  put_spread: {
    name: 'Bear Put Spread',
    description: 'Buy a put, sell a lower strike put to reduce cost',
    legs: 2,
    risk: 'Limited to net debit',
    bias: 'Bearish',
    icon: TrendingDown,
    color: 'text-red-500',
    when: 'Bearish but want to reduce premium cost'
  },
  iron_condor: {
    name: 'Iron Condor',
    description: 'Sell call spread + put spread to collect premium in range-bound market',
    legs: 4,
    risk: 'Limited to spread width minus credit',
    bias: 'Neutral',
    icon: Minus,
    color: 'text-blue-500',
    when: 'Positive gamma regime, expecting PIN action'
  }
};

interface TradeSetup {
  underlying: string;
  currentPrice: number;
  strategy: StrategyType;
  strike: number;
  premium: number;
  longStrike: number;
  shortStrike: number;
  longPremium: number;
  shortPremium: number;
  callWall: number;
  putWall: number;
  shortCallStrike: number;
  longCallStrike: number;
  shortPutStrike: number;
  longPutStrike: number;
  shortCallPremium: number;
  longCallPremium: number;
  shortPutPremium: number;
  longPutPremium: number;
  quantity: number;
  expiration: string;
}

interface TradeMetrics {
  maxProfit: number | string;
  maxLoss: number;
  breakeven: number | number[];
  cost: number;
  riskReward: string;
  profitTarget: number;
}

// ============================================================================
// CALCULATION FUNCTIONS
// ============================================================================

function calculateMetrics(setup: TradeSetup): TradeMetrics {
  const { strategy, quantity } = setup;
  const multiplier = 100 * quantity;

  switch (strategy) {
    case 'long_call':
    case 'long_put': {
      const cost = setup.premium * multiplier;
      return {
        maxProfit: 'Unlimited',
        maxLoss: cost,
        breakeven: strategy === 'long_call' 
          ? setup.strike + setup.premium 
          : setup.strike - setup.premium,
        cost: cost,
        riskReward: 'Unlimited upside',
        profitTarget: cost * 2
      };
    }
    
    case 'call_spread': {
      const netDebit = (setup.longPremium - setup.shortPremium) * multiplier;
      const maxProfit = (setup.shortStrike - setup.longStrike) * multiplier - netDebit;
      return {
        maxProfit: maxProfit,
        maxLoss: netDebit,
        breakeven: setup.longStrike + (netDebit / multiplier),
        cost: netDebit,
        riskReward: `${(maxProfit / netDebit).toFixed(1)}:1`,
        profitTarget: maxProfit * 0.5
      };
    }
    
    case 'put_spread': {
      const netDebit = (setup.longPremium - setup.shortPremium) * multiplier;
      const maxProfit = (setup.longStrike - setup.shortStrike) * multiplier - netDebit;
      return {
        maxProfit: maxProfit,
        maxLoss: netDebit,
        breakeven: setup.longStrike - (netDebit / multiplier),
        cost: netDebit,
        riskReward: `${(maxProfit / netDebit).toFixed(1)}:1`,
        profitTarget: maxProfit * 0.5
      };
    }
    
    case 'iron_condor': {
      const callCredit = (setup.shortCallPremium - setup.longCallPremium) * multiplier;
      const putCredit = (setup.shortPutPremium - setup.longPutPremium) * multiplier;
      const totalCredit = callCredit + putCredit;
      const callWidth = (setup.longCallStrike - setup.shortCallStrike) * multiplier;
      const putWidth = (setup.shortPutStrike - setup.longPutStrike) * multiplier;
      const maxLoss = Math.max(callWidth, putWidth) - totalCredit;
      
      return {
        maxProfit: totalCredit,
        maxLoss: maxLoss,
        breakeven: [
          setup.shortPutStrike - (totalCredit / multiplier),
          setup.shortCallStrike + (totalCredit / multiplier)
        ],
        cost: -totalCredit,
        riskReward: `${(maxLoss / totalCredit).toFixed(1)}:1 risk`,
        profitTarget: totalCredit * 0.35
      };
    }
    
    default:
      return {
        maxProfit: 0,
        maxLoss: 0,
        breakeven: 0,
        cost: 0,
        riskReward: 'N/A',
        profitTarget: 0
      };
  }
}

// ============================================================================
// COMPONENTS
// ============================================================================

function StrategySelector({ 
  selected, 
  onSelect 
}: { 
  selected: StrategyType; 
  onSelect: (s: StrategyType) => void;
}) {
  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Target className="w-5 h-5 text-primary" />
        Select Strategy
      </h2>
      
      <div className="space-y-2">
        {(Object.entries(STRATEGIES) as [StrategyType, StrategyInfo][]).map(([key, info]) => {
          const Icon = info.icon;
          const isSelected = selected === key;
          
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                isSelected 
                  ? 'border-primary bg-primary/10' 
                  : 'border-[var(--border)] hover:border-primary/50 hover:bg-[var(--surface)]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary/20' : 'bg-[var(--surface)]'}`}>
                  <Icon className={`w-5 h-5 ${info.color}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{info.name}</span>
                    <span className="text-xs px-2 py-0.5 bg-[var(--surface)] rounded">
                      {info.legs} leg{info.legs > 1 ? 's' : ''}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      info.bias === 'Bullish' ? 'bg-emerald-500/20 text-emerald-500' :
                      info.bias === 'Bearish' ? 'bg-red-500/20 text-red-500' :
                      'bg-blue-500/20 text-blue-500'
                    }`}>
                      {info.bias}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">{info.description}</p>
                </div>
                {isSelected && <CheckCircle className="w-5 h-5 text-primary" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SimpleOptionForm({ 
  setup, 
  updateSetup,
  type 
}: { 
  setup: TradeSetup; 
  updateSetup: (field: keyof TradeSetup, value: number | string) => void;
  type: 'call' | 'put';
}) {
  return (
    <div className={`card p-6 border-l-4 ${type === 'call' ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
      <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${type === 'call' ? 'text-emerald-500' : 'text-red-500'}`}>
        {type === 'call' ? <ArrowUpCircle className="w-5 h-5" /> : <ArrowDownCircle className="w-5 h-5" />}
        Buy {type === 'call' ? 'Call' : 'Put'} Option
      </h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-[var(--text-secondary)] mb-1">Strike Price</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]">$</span>
            <input
              type="number"
              value={setup.strike}
              onChange={(e) => updateSetup('strike', Number(e.target.value))}
              className="input w-full pl-7"
              placeholder="Strike"
            />
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            {type === 'call' ? 'Above current price for OTM' : 'Below current price for OTM'}
          </p>
        </div>
        <div>
          <label className="block text-xs text-[var(--text-secondary)] mb-1">Premium (per contract)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]">$</span>
            <input
              type="number"
              step="0.05"
              value={setup.premium}
              onChange={(e) => updateSetup('premium', Number(e.target.value))}
              className="input w-full pl-7"
              placeholder="Premium"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 p-3 bg-[var(--surface)] rounded-lg">
        <div className="flex justify-between text-sm">
          <span className="text-[var(--text-secondary)]">Total Cost:</span>
          <span className={`font-bold ${type === 'call' ? 'text-emerald-500' : 'text-red-500'}`}>
            ${(setup.premium * 100 * setup.quantity).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}

function SpreadForm({ 
  setup, 
  updateSetup,
  type 
}: { 
  setup: TradeSetup; 
  updateSetup: (field: keyof TradeSetup, value: number | string) => void;
  type: 'call' | 'put';
}) {
  const isCall = type === 'call';
  
  return (
    <div className={`card p-6 border-l-4 ${isCall ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
      <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${isCall ? 'text-emerald-500' : 'text-red-500'}`}>
        {isCall ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
        {isCall ? 'Bull Call Spread' : 'Bear Put Spread'}
      </h3>
      
      <div className="mb-4">
        <h4 className="text-sm font-medium text-emerald-400 mb-2">BUY {type.toUpperCase()}</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-1">Strike</label>
            <input
              type="number"
              value={setup.longStrike}
              onChange={(e) => updateSetup('longStrike', Number(e.target.value))}
              className="input w-full text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-1">Premium</label>
            <input
              type="number"
              step="0.05"
              value={setup.longPremium}
              onChange={(e) => updateSetup('longPremium', Number(e.target.value))}
              className="input w-full text-sm"
            />
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-red-400 mb-2">SELL {type.toUpperCase()}</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-1">Strike</label>
            <input
              type="number"
              value={setup.shortStrike}
              onChange={(e) => updateSetup('shortStrike', Number(e.target.value))}
              className="input w-full text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-1">Premium</label>
            <input
              type="number"
              step="0.05"
              value={setup.shortPremium}
              onChange={(e) => updateSetup('shortPremium', Number(e.target.value))}
              className="input w-full text-sm"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 p-3 bg-[var(--surface)] rounded-lg">
        <div className="flex justify-between text-sm">
          <span className="text-[var(--text-secondary)]">Net Debit:</span>
          <span className="font-bold">
            ${((setup.longPremium - setup.shortPremium) * 100 * setup.quantity).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}

function IronCondorForm({ 
  setup, 
  updateSetup 
}: { 
  setup: TradeSetup; 
  updateSetup: (field: keyof TradeSetup, value: number | string) => void;
}) {
  const autoAlign = () => {
    updateSetup('shortCallStrike', setup.callWall);
    updateSetup('longCallStrike', setup.callWall + 10);
    updateSetup('shortPutStrike', setup.putWall);
    updateSetup('longPutStrike', setup.putWall - 10);
  };

  return (
    <div className="space-y-4">
      <div className="card p-4 bg-[var(--info)]/10 border border-[var(--info)]/30">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-medium">GEX Levels</p>
            <p className="text-xs text-[var(--text-secondary)]">Align short strikes to walls</p>
          </div>
          <div className="flex gap-4 text-sm">
            <div>
              <span className="text-[var(--text-secondary)]">Call Wall: </span>
              <input
                type="number"
                value={setup.callWall}
                onChange={(e) => updateSetup('callWall', Number(e.target.value))}
                className="input w-20 text-sm inline-block ml-1"
              />
            </div>
            <div>
              <span className="text-[var(--text-secondary)]">Put Wall: </span>
              <input
                type="number"
                value={setup.putWall}
                onChange={(e) => updateSetup('putWall', Number(e.target.value))}
                className="input w-20 text-sm inline-block ml-1"
              />
            </div>
          </div>
          <button onClick={autoAlign} className="btn-secondary text-sm flex items-center gap-1">
            <Zap className="w-4 h-4" />
            Auto-Align
          </button>
        </div>
      </div>

      <div className="card p-4 border-l-4 border-l-red-500">
        <h4 className="text-sm font-semibold text-red-500 mb-3">SELL Call Spread (Bear)</h4>
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-1">Short Call</label>
            <input type="number" value={setup.shortCallStrike} onChange={(e) => updateSetup('shortCallStrike', Number(e.target.value))} className="input w-full text-sm" />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-1">Premium</label>
            <input type="number" step="0.05" value={setup.shortCallPremium} onChange={(e) => updateSetup('shortCallPremium', Number(e.target.value))} className="input w-full text-sm" />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-1">Long Call</label>
            <input type="number" value={setup.longCallStrike} onChange={(e) => updateSetup('longCallStrike', Number(e.target.value))} className="input w-full text-sm" />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-1">Premium</label>
            <input type="number" step="0.05" value={setup.longCallPremium} onChange={(e) => updateSetup('longCallPremium', Number(e.target.value))} className="input w-full text-sm" />
          </div>
        </div>
      </div>

      <div className="card p-4 border-l-4 border-l-emerald-500">
        <h4 className="text-sm font-semibold text-emerald-500 mb-3">SELL Put Spread (Bull)</h4>
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-1">Short Put</label>
            <input type="number" value={setup.shortPutStrike} onChange={(e) => updateSetup('shortPutStrike', Number(e.target.value))} className="input w-full text-sm" />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-1">Premium</label>
            <input type="number" step="0.05" value={setup.shortPutPremium} onChange={(e) => updateSetup('shortPutPremium', Number(e.target.value))} className="input w-full text-sm" />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-1">Long Put</label>
            <input type="number" value={setup.longPutStrike} onChange={(e) => updateSetup('longPutStrike', Number(e.target.value))} className="input w-full text-sm" />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-1">Premium</label>
            <input type="number" step="0.05" value={setup.longPutPremium} onChange={(e) => updateSetup('longPutPremium', Number(e.target.value))} className="input w-full text-sm" />
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricsPanel({ metrics, strategy }: { metrics: TradeMetrics; strategy: StrategyType }) {
  const formatCurrency = (v: number | string) => 
    typeof v === 'number' ? `$${v.toFixed(2)}` : v;

  return (
    <div className="card p-6">
      <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4 flex items-center gap-2">
        <Calculator className="w-4 h-4" />
        Trade Metrics
      </h3>
      
      <div className="space-y-4">
        <div className={`p-4 rounded-lg text-center ${
          strategy === 'iron_condor' ? 'bg-emerald-500/10' : 'bg-blue-500/10'
        }`}>
          <p className="text-xs text-[var(--text-secondary)]">
            {strategy === 'iron_condor' ? 'Credit Received' : 'Total Cost'}
          </p>
          <p className={`text-2xl font-bold ${
            strategy === 'iron_condor' ? 'text-emerald-500' : 'text-blue-500'
          }`}>
            {formatCurrency(Math.abs(metrics.cost))}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-emerald-500/10 rounded-lg">
            <p className="text-xs text-[var(--text-secondary)]">Max Profit</p>
            <p className="text-lg font-semibold text-emerald-500">
              {formatCurrency(metrics.maxProfit)}
            </p>
          </div>
          <div className="p-3 bg-red-500/10 rounded-lg">
            <p className="text-xs text-[var(--text-secondary)]">Max Loss</p>
            <p className="text-lg font-semibold text-red-500">
              -{formatCurrency(metrics.maxLoss)}
            </p>
          </div>
        </div>

        <div className="p-3 bg-[var(--surface)] rounded-lg">
          <p className="text-xs text-[var(--text-secondary)]">Breakeven</p>
          <p className="text-lg font-semibold">
            {Array.isArray(metrics.breakeven) 
              ? `$${metrics.breakeven[0].toFixed(0)} / $${metrics.breakeven[1].toFixed(0)}`
              : `$${(metrics.breakeven as number).toFixed(2)}`}
          </p>
        </div>

        <div className="p-3 bg-[var(--surface)] rounded-lg">
          <p className="text-xs text-[var(--text-secondary)]">Risk/Reward</p>
          <p className="text-lg font-semibold">{metrics.riskReward}</p>
        </div>

        <div className="p-3 bg-primary/10 rounded-lg">
          <p className="text-xs text-[var(--text-secondary)]">Profit Target</p>
          <p className="text-lg font-semibold text-primary">
            {formatCurrency(metrics.profitTarget)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ZeroDTETradePage() {
  const [setup, setSetup] = useState<TradeSetup>({
    underlying: 'SPX',
    currentPrice: 5850,
    strategy: 'long_call',
    strike: 5875,
    premium: 5.00,
    longStrike: 5850,
    shortStrike: 5875,
    longPremium: 8.00,
    shortPremium: 4.00,
    callWall: 5900,
    putWall: 5800,
    shortCallStrike: 5900,
    longCallStrike: 5910,
    shortPutStrike: 5800,
    longPutStrike: 5790,
    shortCallPremium: 2.50,
    longCallPremium: 1.00,
    shortPutPremium: 2.50,
    longPutPremium: 1.00,
    quantity: 1,
    expiration: new Date().toISOString().split('T')[0]
  });

  const [metrics, setMetrics] = useState<TradeMetrics | null>(null);

  useEffect(() => {
    setMetrics(calculateMetrics(setup));
  }, [setup]);

  const updateSetup = (field: keyof TradeSetup, value: number | string) => {
    setSetup(prev => ({ ...prev, [field]: value }));
  };

  const strategyInfo = STRATEGIES[setup.strategy];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <Link href="/zero-dte" className="text-sm text-[var(--text-secondary)] hover:text-primary flex items-center gap-1 mb-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Target className="w-6 h-6 text-primary" />
          0-DTE Trade Builder
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Build and analyze 0-DTE options trades
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <StrategySelector 
            selected={setup.strategy} 
            onSelect={(s) => updateSetup('strategy', s)} 
          />
          
          <div className="card p-4 mt-4 bg-[var(--surface)]">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Info className="w-4 h-4 text-primary" />
              When to Use
            </h4>
            <p className="text-sm text-[var(--text-secondary)]">{strategyInfo.when}</p>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-4">
          <div className="card p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">Underlying</label>
                <select
                  value={setup.underlying}
                  onChange={(e) => updateSetup('underlying', e.target.value)}
                  className="input w-full"
                >
                  <option value="SPX">SPX</option>
                  <option value="SPY">SPY</option>
                  <option value="QQQ">QQQ</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">Current Price</label>
                <input
                  type="number"
                  value={setup.currentPrice}
                  onChange={(e) => updateSetup('currentPrice', Number(e.target.value))}
                  className="input w-full"
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                value={setup.quantity}
                onChange={(e) => updateSetup('quantity', Math.max(1, Number(e.target.value)))}
                className="input w-full"
              />
            </div>
          </div>

          {setup.strategy === 'long_call' && (
            <SimpleOptionForm setup={setup} updateSetup={updateSetup} type="call" />
          )}
          {setup.strategy === 'long_put' && (
            <SimpleOptionForm setup={setup} updateSetup={updateSetup} type="put" />
          )}
          {setup.strategy === 'call_spread' && (
            <SpreadForm setup={setup} updateSetup={updateSetup} type="call" />
          )}
          {setup.strategy === 'put_spread' && (
            <SpreadForm setup={setup} updateSetup={updateSetup} type="put" />
          )}
          {setup.strategy === 'iron_condor' && (
            <IronCondorForm setup={setup} updateSetup={updateSetup} />
          )}
        </div>

        <div className="lg:col-span-1 space-y-4">
          {metrics && <MetricsPanel metrics={metrics} strategy={setup.strategy} />}

          <div className="card p-4 bg-[var(--info)]/10 border border-[var(--info)]/30">
            <h4 className="text-sm font-medium text-[var(--info)] mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              0-DTE Rules
            </h4>
            <ul className="space-y-1 text-xs text-[var(--text-secondary)]">
              <li>- Entry: 9:45 AM - 10:15 AM EST</li>
              <li>- Take profit at target</li>
              <li>- Exit by 3:50 PM - NEVER hold to close</li>
              <li>- Cut losses at 2x premium for shorts</li>
            </ul>
          </div>

          <button className="btn-primary w-full flex items-center justify-center gap-2">
            <Play className="w-4 h-4" />
            Copy Order to Broker
          </button>
        </div>
      </div>
    </div>
  );
}
