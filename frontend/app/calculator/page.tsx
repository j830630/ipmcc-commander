'use client';

import { useState, useMemo } from 'react';
import { 
  Calculator, 
  DollarSign, 
  TrendingUp, 
  Target, 
  Shield,
  AlertTriangle,
  Percent,
  Calendar,
  PiggyBank,
  Wallet,
  LineChart,
  BarChart3,
  Minus,
  Plus,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

type RiskProfile = 'conservative' | 'moderate' | 'aggressive';
type StrategyType = 'ipmcc' | '112-trade' | 'strangles' | 'credit-spreads' | 'wheel';

interface StrategyReturns {
  monthlyPercent: { min: number; avg: number; max: number };
  winRate: number;
  maxDrawdown: number;
  description: string;
}

// Strategy return profiles based on historical data and realistic expectations
const STRATEGY_RETURNS: Record<StrategyType, Record<RiskProfile, StrategyReturns>> = {
  'ipmcc': {
    conservative: { monthlyPercent: { min: 1.5, avg: 2.5, max: 4 }, winRate: 75, maxDrawdown: 15, description: 'ATM short calls, quality underlyings only' },
    moderate: { monthlyPercent: { min: 2, avg: 3.5, max: 6 }, winRate: 70, maxDrawdown: 25, description: 'ATM-ITM short calls, mega-caps and ETFs' },
    aggressive: { monthlyPercent: { min: 3, avg: 5, max: 10 }, winRate: 65, maxDrawdown: 40, description: 'ITM short calls, high-IV stocks like MSTR/COIN' },
  },
  '112-trade': {
    conservative: { monthlyPercent: { min: 1, avg: 2, max: 3 }, winRate: 70, maxDrawdown: 20, description: 'Wide strikes, high-probability setups' },
    moderate: { monthlyPercent: { min: 2, avg: 3, max: 5 }, winRate: 65, maxDrawdown: 30, description: 'Standard 112 setups, moderate strike width' },
    aggressive: { monthlyPercent: { min: 3, avg: 5, max: 8 }, winRate: 55, maxDrawdown: 50, description: 'Tighter strikes, higher premium collection' },
  },
  'strangles': {
    conservative: { monthlyPercent: { min: 1, avg: 2, max: 3 }, winRate: 80, maxDrawdown: 25, description: 'Wide strangles on low-beta ETFs' },
    moderate: { monthlyPercent: { min: 2, avg: 3.5, max: 5 }, winRate: 70, maxDrawdown: 35, description: 'Standard strangles on liquid underlyings' },
    aggressive: { monthlyPercent: { min: 3, avg: 5, max: 8 }, winRate: 60, maxDrawdown: 50, description: 'Tighter strangles, high IV underlyings' },
  },
  'credit-spreads': {
    conservative: { monthlyPercent: { min: 0.5, avg: 1.5, max: 2.5 }, winRate: 80, maxDrawdown: 15, description: 'Far OTM spreads, high probability' },
    moderate: { monthlyPercent: { min: 1.5, avg: 2.5, max: 4 }, winRate: 70, maxDrawdown: 25, description: 'Standard OTM spreads' },
    aggressive: { monthlyPercent: { min: 2.5, avg: 4, max: 6 }, winRate: 60, maxDrawdown: 40, description: 'Closer to ATM spreads' },
  },
  'wheel': {
    conservative: { monthlyPercent: { min: 1, avg: 1.5, max: 2.5 }, winRate: 85, maxDrawdown: 20, description: 'Far OTM puts, blue chip stocks only' },
    moderate: { monthlyPercent: { min: 1.5, avg: 2.5, max: 4 }, winRate: 75, maxDrawdown: 30, description: 'ATM puts, quality stocks' },
    aggressive: { monthlyPercent: { min: 2.5, avg: 4, max: 6 }, winRate: 65, maxDrawdown: 45, description: 'ATM puts, growth stocks' },
  },
};

const TAX_RATES = {
  shortTermCapitalGains: 0.37, // Max federal rate
  longTermCapitalGains: 0.20,
  stateAverage: 0.05,
  netInvestmentIncome: 0.038, // NIIT for high earners
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value: number) => {
  return `${value.toFixed(1)}%`;
};

// Compounding chart component
function CompoundingChart({ 
  data, 
  title,
  color = 'var(--profit)'
}: { 
  data: { year: number; value: number; contributed?: number }[];
  title: string;
  color?: string;
}) {
  const maxValue = Math.max(...data.map(d => d.value));
  
  return (
    <div className="card p-4">
      <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-4">{title}</h4>
      <div className="flex items-end gap-1 h-40">
        {data.map((point, i) => {
          const height = (point.value / maxValue) * 100;
          const contributedHeight = point.contributed ? (point.contributed / maxValue) * 100 : 0;
          return (
            <div 
              key={i} 
              className="flex-1 flex flex-col items-center group relative"
            >
              <div 
                className="w-full rounded-t transition-all hover:opacity-80 relative"
                style={{ 
                  height: `${height}%`, 
                  backgroundColor: color,
                  minHeight: '4px'
                }}
              >
                {point.contributed && (
                  <div 
                    className="absolute bottom-0 left-0 right-0 bg-[var(--text-secondary)]/30 rounded-t"
                    style={{ height: `${(contributedHeight / height) * 100}%` }}
                  />
                )}
              </div>
              <span className="text-[10px] text-[var(--text-secondary)] mt-1">Y{point.year}</span>
              
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-2 py-1 text-xs whitespace-nowrap">
                  <div className="font-medium">{formatCurrency(point.value)}</div>
                  {point.contributed && (
                    <div className="text-[var(--text-secondary)]">
                      Contributed: {formatCurrency(point.contributed)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Risk meter component
function RiskMeter({ level }: { level: RiskProfile }) {
  const colors = {
    conservative: 'bg-green-500',
    moderate: 'bg-yellow-500',
    aggressive: 'bg-red-500',
  };
  const positions = {
    conservative: 'left-[15%]',
    moderate: 'left-[50%]',
    aggressive: 'left-[85%]',
  };
  
  return (
    <div className="relative h-3 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-full">
      <div 
        className={cn(
          "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-2 border-white shadow-lg transition-all",
          colors[level],
          positions[level]
        )}
      />
    </div>
  );
}

export default function CalculatorPage() {
  // Inputs
  const [portfolioSize, setPortfolioSize] = useState<number>(100000);
  const [strategy, setStrategy] = useState<StrategyType>('ipmcc');
  const [riskProfile, setRiskProfile] = useState<RiskProfile>('moderate');
  const [yearsToProject, setYearsToProject] = useState<number>(10);
  const [monthlyContribution, setMonthlyContribution] = useState<number>(0);
  const [monthlyWithdrawal, setMonthlyWithdrawal] = useState<number>(0);
  const [taxBracket, setTaxBracket] = useState<number>(32);
  const [reinvestDividends, setReinvestDividends] = useState<boolean>(true);
  const [ignoreTaxes, setIgnoreTaxes] = useState<boolean>(false);

  // Get strategy data
  const strategyData = STRATEGY_RETURNS[strategy][riskProfile];

  // Calculate projections
  const calculations = useMemo(() => {
    const monthlyReturn = strategyData.monthlyPercent.avg / 100;
    const annualReturn = Math.pow(1 + monthlyReturn, 12) - 1;
    
    // Effective tax rate (0 if ignoring taxes)
    const effectiveFederalRate = ignoreTaxes ? 0 : (taxBracket / 100);
    const effectiveStateRate = ignoreTaxes ? 0 : TAX_RATES.stateAverage;
    const effectiveTotalRate = effectiveFederalRate + effectiveStateRate;
    
    // Monthly calculations
    const grossMonthlyIncome = portfolioSize * monthlyReturn;
    const tradingFees = grossMonthlyIncome * 0.01; // ~1% for commissions
    const netMonthlyBeforeTax = grossMonthlyIncome - tradingFees;
    
    // Tax calculations (short-term capital gains for options)
    const federalTax = netMonthlyBeforeTax * effectiveFederalRate;
    const stateTax = netMonthlyBeforeTax * effectiveStateRate;
    const totalTax = federalTax + stateTax;
    const netMonthlyAfterTax = netMonthlyBeforeTax - totalTax;
    
    // Annual calculations
    const grossAnnualIncome = grossMonthlyIncome * 12;
    const annualFees = tradingFees * 12;
    const annualTaxes = totalTax * 12;
    const netAnnualAfterTax = netMonthlyAfterTax * 12;
    
    // Compounding projection - compound monthly gains
    const yearlyProjection: { year: number; value: number; contributed: number }[] = [];
    let currentValue = portfolioSize;
    let totalContributed = portfolioSize;
    
    for (let year = 0; year <= yearsToProject; year++) {
      yearlyProjection.push({
        year,
        value: Math.round(currentValue),
        contributed: Math.round(totalContributed),
      });
      
      if (year < yearsToProject) {
        // Apply returns monthly with compounding
        for (let month = 0; month < 12; month++) {
          const monthlyGain = currentValue * monthlyReturn;
          const monthlyTaxAmount = monthlyGain * effectiveTotalRate;
          const netGain = monthlyGain - monthlyTaxAmount;
          currentValue += netGain + monthlyContribution - monthlyWithdrawal;
          totalContributed += monthlyContribution;
        }
      }
    }
    
    // Withdrawal impact projection
    const withdrawalProjection: { year: number; value: number }[] = [];
    const withdrawalAmounts = [0, 1000, 2000, 3000, 5000];
    
    withdrawalAmounts.forEach(withdrawal => {
      let value = portfolioSize;
      for (let year = 0; year < yearsToProject; year++) {
        for (let month = 0; month < 12; month++) {
          const monthlyGain = value * monthlyReturn;
          const monthlyTaxAmount = monthlyGain * effectiveTotalRate;
          value += monthlyGain - monthlyTaxAmount - withdrawal;
        }
      }
      withdrawalProjection.push({ year: withdrawal, value: Math.round(value) });
    });
    
    // Risk-adjusted returns
    const expectedLoss = portfolioSize * (strategyData.maxDrawdown / 100);
    const worstMonth = portfolioSize * (strategyData.monthlyPercent.min / 100) * -2; // 2x loss on bad month
    const bestMonth = portfolioSize * (strategyData.monthlyPercent.max / 100);
    
    // Break-even analysis
    const weeksToBreakeven = portfolioSize / (grossMonthlyIncome / 4);
    
    return {
      // Monthly
      grossMonthlyIncome,
      tradingFees,
      netMonthlyBeforeTax,
      federalTax,
      stateTax,
      totalTax,
      netMonthlyAfterTax,
      
      // Annual
      grossAnnualIncome,
      annualFees,
      annualTaxes,
      netAnnualAfterTax,
      annualReturn,
      
      // Projections
      yearlyProjection,
      withdrawalProjection,
      
      // Risk
      expectedLoss,
      worstMonth,
      bestMonth,
      weeksToBreakeven,
      
      // Final values
      finalValue: yearlyProjection[yearlyProjection.length - 1]?.value || 0,
      totalGrowth: yearlyProjection[yearlyProjection.length - 1]?.value - portfolioSize - (monthlyContribution * 12 * yearsToProject),
    };
  }, [portfolioSize, strategy, riskProfile, yearsToProject, monthlyContribution, monthlyWithdrawal, taxBracket, ignoreTaxes, strategyData]);

  const strategies: { id: StrategyType; name: string; icon: any }[] = [
    { id: 'ipmcc', name: 'Income PMCC', icon: TrendingUp },
    { id: '112-trade', name: '112 Trade', icon: Target },
    { id: 'strangles', name: 'Strangles', icon: BarChart3 },
    { id: 'credit-spreads', name: 'Credit Spreads', icon: Shield },
    { id: 'wheel', name: 'Wheel Strategy', icon: DollarSign },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)] flex items-center gap-3">
          <Calculator className="h-7 w-7 text-[var(--info)]" />
          Portfolio Calculator
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Project returns, analyze tax implications, and plan your trading strategy
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Panel */}
        <div className="space-y-6">
          {/* Portfolio Size */}
          <div className="card p-6">
            <h3 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Portfolio Size
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-[var(--text-secondary)]">Starting Capital</label>
                <div className="relative mt-1">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-secondary)]" />
                  <input
                    type="number"
                    value={portfolioSize}
                    onChange={(e) => setPortfolioSize(Math.max(0, Number(e.target.value)))}
                    className="input pl-10 w-full"
                    step="10000"
                  />
                </div>
              </div>
              
              {/* Quick presets */}
              <div className="flex flex-wrap gap-2">
                {[25000, 50000, 100000, 250000, 500000].map(amount => (
                  <button
                    key={amount}
                    onClick={() => setPortfolioSize(amount)}
                    className={cn(
                      "px-3 py-1 text-xs rounded-lg transition-colors",
                      portfolioSize === amount
                        ? "bg-[var(--info)] text-white"
                        : "bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    {formatCurrency(amount)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Strategy Selection */}
          <div className="card p-6">
            <h3 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <Target className="h-4 w-4" />
              Strategy
            </h3>
            <div className="space-y-2">
              {strategies.map(strat => {
                const Icon = strat.icon;
                return (
                  <button
                    key={strat.id}
                    onClick={() => setStrategy(strat.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg transition-colors",
                      strategy === strat.id
                        ? "bg-[var(--info)]/20 border border-[var(--info)]"
                        : "bg-[var(--surface)] hover:bg-[var(--border)]"
                    )}
                  >
                    <Icon className={cn("h-4 w-4", strategy === strat.id ? "text-[var(--info)]" : "text-[var(--text-secondary)]")} />
                    <span className={strategy === strat.id ? "text-[var(--info)] font-medium" : "text-[var(--text-primary)]"}>
                      {strat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Risk Profile */}
          <div className="card p-6">
            <h3 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Risk Profile
            </h3>
            <div className="space-y-4">
              <RiskMeter level={riskProfile} />
              <div className="grid grid-cols-3 gap-2">
                {(['conservative', 'moderate', 'aggressive'] as RiskProfile[]).map(profile => (
                  <button
                    key={profile}
                    onClick={() => setRiskProfile(profile)}
                    className={cn(
                      "px-3 py-2 text-xs rounded-lg capitalize transition-colors",
                      riskProfile === profile
                        ? profile === 'conservative' ? "bg-green-500 text-white"
                        : profile === 'moderate' ? "bg-yellow-500 text-black"
                        : "bg-red-500 text-white"
                        : "bg-[var(--surface)] text-[var(--text-secondary)]"
                    )}
                  >
                    {profile}
                  </button>
                ))}
              </div>
              <p className="text-xs text-[var(--text-secondary)]">{strategyData.description}</p>
            </div>
          </div>

          {/* Additional Settings */}
          <div className="card p-6">
            <h3 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Projection Settings
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-[var(--text-secondary)]">Years to Project</label>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={yearsToProject}
                  onChange={(e) => setYearsToProject(Number(e.target.value))}
                  className="w-full mt-2"
                />
                <div className="flex justify-between text-xs text-[var(--text-secondary)]">
                  <span>1 year</span>
                  <span className="font-medium text-[var(--text-primary)]">{yearsToProject} years</span>
                  <span>20 years</span>
                </div>
              </div>
              
              <div>
                <label className="text-sm text-[var(--text-secondary)]">Monthly Contribution</label>
                <div className="relative mt-1">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-secondary)]" />
                  <input
                    type="number"
                    value={monthlyContribution}
                    onChange={(e) => setMonthlyContribution(Math.max(0, Number(e.target.value)))}
                    className="input pl-10 w-full"
                    step="100"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm text-[var(--text-secondary)]">Monthly Withdrawal</label>
                <div className="relative mt-1">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-secondary)]" />
                  <input
                    type="number"
                    value={monthlyWithdrawal}
                    onChange={(e) => setMonthlyWithdrawal(Math.max(0, Number(e.target.value)))}
                    className="input pl-10 w-full"
                    step="100"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm text-[var(--text-secondary)]">Federal Tax Bracket (%)</label>
                <select
                  value={taxBracket}
                  onChange={(e) => setTaxBracket(Number(e.target.value))}
                  className={cn("input w-full mt-1", ignoreTaxes && "opacity-50")}
                  disabled={ignoreTaxes}
                >
                  <option value={10}>10%</option>
                  <option value={12}>12%</option>
                  <option value={22}>22%</option>
                  <option value={24}>24%</option>
                  <option value={32}>32%</option>
                  <option value={35}>35%</option>
                  <option value={37}>37%</option>
                </select>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-[var(--surface)] rounded-lg">
                <input
                  type="checkbox"
                  id="ignoreTaxes"
                  checked={ignoreTaxes}
                  onChange={(e) => setIgnoreTaxes(e.target.checked)}
                  className="w-4 h-4 rounded border-[var(--border)] text-[var(--info)] focus:ring-[var(--info)]"
                />
                <label htmlFor="ignoreTaxes" className="text-sm text-[var(--text-primary)] cursor-pointer">
                  Ignore taxes in calculations
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Strategy Performance Summary */}
          <div className="card p-6">
            <h3 className="font-semibold text-[var(--text-primary)] mb-4">Strategy Performance Profile</h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-3 bg-[var(--surface)] rounded-lg">
                <p className="text-xs text-[var(--text-secondary)]">Monthly Return</p>
                <p className="text-xl font-bold text-[var(--profit)]">
                  {strategyData.monthlyPercent.min}-{strategyData.monthlyPercent.max}%
                </p>
                <p className="text-xs text-[var(--text-secondary)]">Avg: {strategyData.monthlyPercent.avg}%</p>
              </div>
              <div className="text-center p-3 bg-[var(--surface)] rounded-lg">
                <p className="text-xs text-[var(--text-secondary)]">Win Rate</p>
                <p className="text-xl font-bold text-[var(--info)]">{strategyData.winRate}%</p>
              </div>
              <div className="text-center p-3 bg-[var(--surface)] rounded-lg">
                <p className="text-xs text-[var(--text-secondary)]">Max Drawdown</p>
                <p className="text-xl font-bold text-[var(--loss)]">-{strategyData.maxDrawdown}%</p>
              </div>
              <div className="text-center p-3 bg-[var(--surface)] rounded-lg">
                <p className="text-xs text-[var(--text-secondary)]">Annual Return</p>
                <p className="text-xl font-bold text-[var(--profit)]">{formatPercent(calculations.annualReturn * 100)}</p>
              </div>
            </div>
          </div>

          {/* Monthly Income Breakdown */}
          <div className="card p-6">
            <h3 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Monthly Income Breakdown
              {ignoreTaxes && <span className="text-xs bg-[var(--warning)]/20 text-[var(--warning)] px-2 py-0.5 rounded">Taxes Ignored</span>}
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-[var(--profit)]/10 rounded-lg">
                <span className="text-[var(--text-secondary)]">Gross Monthly Income</span>
                <span className="text-xl font-bold text-[var(--profit)]">{formatCurrency(calculations.grossMonthlyIncome)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-[var(--surface)] rounded-lg">
                <span className="text-[var(--text-secondary)]">Trading Fees (~1%)</span>
                <span className="text-[var(--loss)]">-{formatCurrency(calculations.tradingFees)}</span>
              </div>
              <div className={cn("flex justify-between items-center p-3 bg-[var(--surface)] rounded-lg", ignoreTaxes && "opacity-40")}>
                <span className={cn("text-[var(--text-secondary)]", ignoreTaxes && "line-through")}>Federal Tax ({taxBracket}%)</span>
                <span className={cn("text-[var(--loss)]", ignoreTaxes && "line-through")}>-{formatCurrency(ignoreTaxes ? 0 : calculations.federalTax)}</span>
              </div>
              <div className={cn("flex justify-between items-center p-3 bg-[var(--surface)] rounded-lg", ignoreTaxes && "opacity-40")}>
                <span className={cn("text-[var(--text-secondary)]", ignoreTaxes && "line-through")}>State Tax (~5%)</span>
                <span className={cn("text-[var(--loss)]", ignoreTaxes && "line-through")}>-{formatCurrency(ignoreTaxes ? 0 : calculations.stateTax)}</span>
              </div>
              <div className="border-t border-[var(--border)] pt-3">
                <div className="flex justify-between items-center p-3 bg-[var(--info)]/10 rounded-lg">
                  <span className="font-medium text-[var(--text-primary)]">Net Monthly Income</span>
                  <span className="text-2xl font-bold text-[var(--info)]">{formatCurrency(calculations.netMonthlyAfterTax)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Annual Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="card p-6">
              <h3 className="font-semibold text-[var(--text-primary)] mb-4">Annual Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Gross Income</span>
                  <span className="font-medium text-[var(--profit)]">{formatCurrency(calculations.grossAnnualIncome)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Total Fees</span>
                  <span className="text-[var(--loss)]">-{formatCurrency(calculations.annualFees)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Total Taxes</span>
                  <span className="text-[var(--loss)]">-{formatCurrency(calculations.annualTaxes)}</span>
                </div>
                <div className="border-t border-[var(--border)] pt-3">
                  <div className="flex justify-between">
                    <span className="font-medium">Net Annual</span>
                    <span className="text-xl font-bold text-[var(--info)]">{formatCurrency(calculations.netAnnualAfterTax)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <h3 className="font-semibold text-[var(--text-primary)] mb-4">Risk Analysis</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Max Drawdown Risk</span>
                  <span className="text-[var(--loss)]">-{formatCurrency(calculations.expectedLoss)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Worst Month (est.)</span>
                  <span className="text-[var(--loss)]">{formatCurrency(calculations.worstMonth)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Best Month (est.)</span>
                  <span className="text-[var(--profit)]">+{formatCurrency(calculations.bestMonth)}</span>
                </div>
                <div className="border-t border-[var(--border)] pt-3">
                  <div className="flex justify-between">
                    <span className="font-medium">Weeks to Breakeven</span>
                    <span className="text-xl font-bold text-[var(--text-primary)]">{Math.round(calculations.weeksToBreakeven)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Compounding Charts */}
          <div className="grid grid-cols-2 gap-4">
            <CompoundingChart 
              data={calculations.yearlyProjection}
              title={`${yearsToProject}-Year Growth Projection`}
              color="var(--profit)"
            />
            <div className="card p-4">
              <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-4">Withdrawal Impact Analysis</h4>
              <div className="space-y-2">
                {calculations.withdrawalProjection.map((wp, i) => {
                  const baseValue = calculations.withdrawalProjection[0].value;
                  const diff = wp.value - baseValue;
                  return (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <span className="text-[var(--text-secondary)]">
                        {wp.year === 0 ? 'No withdrawal' : `$${wp.year}/mo withdrawal`}
                      </span>
                      <div className="text-right">
                        <span className="font-medium text-[var(--text-primary)]">{formatCurrency(wp.value)}</span>
                        {i > 0 && (
                          <span className="text-xs text-[var(--loss)] ml-2">
                            ({formatCurrency(diff)})
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Final Summary */}
          <div className="card p-6 bg-gradient-to-r from-[var(--info)]/10 to-[var(--profit)]/10 border-[var(--info)]">
            <h3 className="font-semibold text-[var(--text-primary)] mb-4">
              {yearsToProject}-Year Projection Summary
            </h3>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <p className="text-sm text-[var(--text-secondary)]">Starting Value</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{formatCurrency(portfolioSize)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-[var(--text-secondary)]">Projected Value</p>
                <p className="text-3xl font-bold text-[var(--profit)]">{formatCurrency(calculations.finalValue)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-[var(--text-secondary)]">Total Growth</p>
                <p className="text-2xl font-bold text-[var(--info)]">+{formatCurrency(calculations.totalGrowth)}</p>
              </div>
            </div>
            <div className="mt-4 p-3 bg-[var(--surface)]/50 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-[var(--text-secondary)] mt-0.5 flex-shrink-0" />
                <p className="text-xs text-[var(--text-secondary)]">
                  These projections are estimates based on historical strategy performance. Actual results may vary significantly. 
                  Options trading involves substantial risk of loss. Past performance does not guarantee future results.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
