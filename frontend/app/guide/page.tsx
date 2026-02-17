'use client';

import { useState } from 'react';
import {
  BookOpen,
  TrendingUp,
  Target,
  GitBranch,
  DollarSign,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  Settings,
  Lightbulb,
  Shield,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

type StrategyType = 'ipmcc' | '112-trade' | 'strangles' | 'credit-spreads';

interface QuickStat {
  label: string;
  value: string;
  icon: React.ElementType;
}

interface Section {
  id: string;
  title: string;
  icon: React.ElementType;
  content: string;
}

interface Strategy {
  name: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
  quickStats: QuickStat[];
  sections: Section[];
}

const STRATEGIES: Record<StrategyType, Strategy> = {
  'ipmcc': {
    name: 'Income PMCC',
    icon: TrendingUp,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    description: 'Cash-flow-first strategy prioritizing weekly premium collection over capital appreciation',
    quickStats: [
      { label: 'Market View', value: 'Bullish', icon: TrendingUp },
      { label: 'Ideal DTE', value: '7 / 180+', icon: Clock },
      { label: 'Target Delta', value: '70-90', icon: Target },
      { label: 'Risk', value: 'Defined', icon: Shield },
    ],
    sections: [
      {
        id: 'what-is',
        title: '1. What is Income PMCC?',
        icon: BookOpen,
        content: `
## The Income PMCC Strategy

Income PMCC (Poor Man's Covered Call) is a cash-flow-first options strategy that prioritizes weekly extrinsic value collection over capital appreciation.

**The Mantra:** "Extrinsic Value, Over Time"

### How It Works

**Long Leg (LEAP Call):**
Acts as a stock substitute with 70-90 delta exposure.
Typically 180+ DTE for maximum leverage and time decay protection.
Deep ITM to maximize delta and minimize extrinsic paid.

**Short Leg (Weekly Call):**
Sold ATM or slightly ITM to maximize weekly extrinsic capture.
7 DTE is the sweet spot for theta decay.
Rolled weekly for consistent income.

### Why It Works

The strategy exploits the difference in theta decay rates. The short weekly decays rapidly while the long LEAP holds value. This creates a positive theta position that profits from time passing.

### Capital Efficiency

Instead of buying 100 shares at $500 each ($50,000), you control the same exposure with a LEAP costing $5,000-$10,000. This frees up capital and improves ROI.
        `,
      },
      {
        id: 'setup',
        title: '2. Setting Up the Trade',
        icon: Target,
        content: `
## Entry Criteria Checklist

### Technical Requirements

**Weekly Chart Uptrend:**
The 21 EMA should be above the 50 EMA.
This confirms the underlying trend supports a bullish position.

**Daily RSI Positioning:**
RSI below 50 or reversing from oversold.
Avoid entering when RSI is above 70 (overbought).

**Price at Support:**
Look for entries near the lower Bollinger Band, 50 EMA, or key moving averages (100/200).
Support levels provide natural stop-loss points.

### Long Leg Selection

**Delta:** Target 70-90 delta (80 is ideal).
**DTE:** Minimum 180 days, prefer 365+.
**Strike:** Deep ITM to minimize extrinsic paid.
**Example:** Stock at $600 → Buy $500 strike LEAP.

### Short Leg Selection

**Strike:** ATM (at-the-money) or slightly ITM.
**DTE:** 7 days (can go 3-14 based on conditions).
**Premium Target:** Maximum weekly extrinsic available.

### Quality Filters

Trade only high-quality, stable growth stocks and ETFs.
Avoid earnings announcements within short call DTE.
Ensure liquid options market (tight bid-ask spreads).
        `,
      },
      {
        id: 'managing',
        title: '3. Position Management',
        icon: Settings,
        content: `
## Position Management Rules

### Short Call Management

**Roll When:**
When 80-90% of extrinsic value is captured.
1-2 days before expiration.
When stock has moved significantly ITM on your short.

**Roll To:**
Same strike if neutral outlook.
Higher strike if bullish or assignment risk.
Lower strike if bearish or want more protection.

### Exit Signals

**EMERGENCY EXIT** (Net loss exceeds 30%):
Close entire position immediately.
Do not average down.
Reassess market conditions before re-entry.

**TAKE PROFIT** (50%+ total gain):
Consider closing entire position.
Or continue if thesis unchanged and position healthy.

**LEAP THETA WARNING** (Less than 60 DTE remaining):
Roll LEAP to later expiration.
Or close position and restart fresh.
        `,
      },
      {
        id: 'scenarios',
        title: '4. Market Scenarios',
        icon: BarChart3,
        content: `
## How IPMCC Behaves in Different Markets

### Stock Goes Up

Short call goes ITM → Roll up and out for net credit.
LEAP increases in value → Total position profits.
**Result:** Profit from both LEAP appreciation and premium collected.

### Stock Stays Flat

Short call expires worthless → Keep all premium.
LEAP maintains value → Minimal change.
**Result:** Pure theta profit (ideal scenario!).

### Stock Goes Down

Short call expires worthless → Keep premium.
LEAP loses value → Partially offset by collected premium.
**Result:** Loss cushioned by premium income.

### Real Performance Examples

| Ticker | Stock Return | IPMCC Return | Period |
|--------|-------------|--------------|--------|
| SPY | +7% | +51% | 207 days |
| QQQ | +25% | +51% | 136 days |
| MSTR | -12% | +19% | 90 days |
        `,
      },
      {
        id: 'reference',
        title: '5. Quick Reference',
        icon: Lightbulb,
        content: `
## Quick Reference Card

### Entry Checklist

Weekly uptrend confirmed (21 EMA above 50 EMA).
Daily RSI below 50 or reversing.
Price at or near support level.
Quality underlying (SPY, QQQ, AAPL, etc.).

### Ideal Setup Parameters

**Long Call:** 80Δ, 180+ DTE, Deep ITM strike.
**Short Call:** ATM, 7 DTE, Maximum extrinsic.

### Management Rules

**Roll short when:** Extrinsic less than 20% remaining.
**Take profit at:** 50%+ total gain.
**Emergency exit at:** 30% net loss.
**Roll LEAP when:** DTE falls below 60.

### Greeks to Monitor

**Positive Theta:** Time is your friend.
**Positive Delta:** You profit when stock rises.
**Negative Vega:** IV drop helps (usually).

### Common Mistakes to Avoid

Selling short calls too far OTM (leaving premium on the table).
Ignoring the LEAP theta as it ages.
Not rolling when extrinsic is exhausted.
Averaging down on a losing position.
        `,
      },
    ],
  },
  '112-trade': {
    name: '112 Trade',
    icon: Target,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    description: 'Defined risk put ratio spread for elevated IV environments',
    quickStats: [
      { label: 'Market View', value: 'Neutral/Bullish', icon: Target },
      { label: 'Ideal DTE', value: '14-21', icon: Clock },
      { label: 'Ideal IV', value: '>35%', icon: BarChart3 },
      { label: 'Risk', value: 'Defined', icon: Shield },
    ],
    sections: [
      {
        id: 'what-is',
        title: '1. What is the 112 Trade?',
        icon: BookOpen,
        content: `
## The 112 Trade Structure

The 112 Trade is a put ratio spread consisting of:

**1x Long Put** (ATM or slightly OTM).
**1x Short Put** (lower strike, at first support).
**2x Short Puts** (even lower, at major support).

### Why 1:1:2?

This creates an asymmetric P&L profile. You profit if the stock stays flat, goes up, or drops to your short strikes. Maximum profit occurs at the middle short strike.

### Ideal Conditions

Enter when IV is elevated (above 35%).
Clear support levels visible on the chart.
No earnings or major events before expiration.

### Risk Profile

Max profit is achieved at the short put strikes.
Limited risk above the long put.
Increased risk if stock crashes through all strikes.
        `,
      },
      {
        id: 'setup',
        title: '2. Setting Up the Trade',
        icon: Target,
        content: `
## Entry Criteria

### IV Requirements

IV Rank should be above 35%.
Higher IV means more premium collected.
Avoid entering in low IV environments.

### Strike Selection

**Long Put:** ATM or slightly OTM.
**First Short Put:** At first support level (10-20 points below).
**Second Short Puts (2x):** At major support (20-40 points below).

### DTE Selection

Target 14-21 DTE.
Allows theta decay while having time to manage.
Avoid less than 14 DTE (gamma risk too high).

### Premium Targets

Trade should be opened for a net credit or small debit.
If paying debit, ensure max profit justifies the cost.
        `,
      },
      {
        id: 'managing',
        title: '3. Position Management',
        icon: Settings,
        content: `
## Managing the 112 Trade

### Profit Taking

Close at 50% of max profit.
Don't get greedy waiting for full profit.

### Defending the Position

**If stock approaches first short strike:**
Consider rolling the entire position down.
Or close if support breaks.

**If stock crashes through strikes:**
Close immediately if loss exceeds 3x initial credit.
Do not hope for a bounce.

### Rolling Rules

Only roll for a credit.
Roll to same structure at lower strikes.
If unable to roll for credit, close the position.

### Exit Triggers

50% profit achieved → Close.
Major support broken → Close.
Loss exceeds risk tolerance → Close.
        `,
      },
      {
        id: 'scenarios',
        title: '4. P&L Scenarios',
        icon: BarChart3,
        content: `
## Profit & Loss Analysis

### Example Position

Current price: $500.
Buy 1x $500P.
Sell 1x $480P.
Sell 2x $460P.
Net credit: $1.50.

### At Expiration

| Stock Price | P&L per Share | Notes |
|-------------|---------------|-------|
| $520 | +$1.50 | All expire worthless, keep credit |
| $500 | +$1.50 | All expire worthless |
| $480 | +$21.50 | Long = $20, shorts worthless |
| $470 | +$21.50 | Maximum profit zone |
| $460 | +$21.50 | Max profit at this level |
| $450 | +$1.50 | Short puts start hurting |
| $440 | -$18.50 | Significant loss |
| $420 | -$58.50 | Near max loss |

### Key Levels

**Max Profit:** Width of spread + Credit = $20 + $1.50 = $21.50/share.
**Break-even Points:** Depend on spread widths and credit received.
        `,
      },
      {
        id: 'reference',
        title: '5. Quick Reference',
        icon: Lightbulb,
        content: `
## 112 Trade Quick Reference

### Entry Checklist

IV above 35% (elevated).
14-17 DTE target.
Clear support levels identified.
No earnings before expiration.
Net credit or small debit.

### Structure Rules

Long put: ATM or slightly OTM.
Short puts: At support levels.
Ratio always 1:1:2.
Same expiration for all legs.

### Management Rules

**Take Profit:** 50% of max profit.
**Stop Loss:** Stock breaks major support, or loss exceeds 3x initial credit.

### Greeks to Watch

**Theta:** Should be positive (time helps you).
**Delta:** Starts near zero, goes negative as stock drops.
**Vega:** Positive exposure to IV.

### Common Mistakes

Opening in low IV.
Strikes too wide apart.
Holding through earnings.
Not respecting support breaks.
        `,
      },
    ],
  },
  'strangles': {
    name: 'Strangles',
    icon: GitBranch,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    description: 'Neutral strategy selling both puts and calls for premium',
    quickStats: [
      { label: 'Market View', value: 'Neutral', icon: Target },
      { label: 'Ideal DTE', value: '30-45', icon: Clock },
      { label: 'Ideal IV', value: '>30%', icon: BarChart3 },
      { label: 'Risk', value: 'Undefined', icon: AlertTriangle },
    ],
    sections: [
      {
        id: 'what-is',
        title: '1. What is a Short Strangle?',
        icon: BookOpen,
        content: `
## The Short Strangle

A short strangle involves selling both an OTM put and an OTM call to collect premium from both sides.

### Structure

**Short Call:** Above current price (resistance level).
**Short Put:** Below current price (support level).
Both same expiration, typically 30-45 DTE.

### Why It Works

You profit if the stock stays within a range.
Time decay works in your favor on both sides.
Premium collected on both legs.

### Risk Profile

**Undefined risk** on both sides.
Profit limited to premium collected.
Loss can be substantial if stock makes big move.
        `,
      },
      {
        id: 'setup',
        title: '2. Setting Up the Trade',
        icon: Target,
        content: `
## Entry Criteria

### IV Requirements

IV Rank above 30% (higher is better).
Elevated IV means more premium.

### Strike Selection

**Short Call:** At or above resistance (16-20 delta).
**Short Put:** At or below support (16-20 delta).
Use technical levels for strike placement.

### DTE Selection

30-45 DTE is optimal.
Balances theta decay with adjustment time.

### Premium Targets

Collect enough premium to justify the risk.
Minimum 2% of buying power requirement.
        `,
      },
      {
        id: 'managing',
        title: '3. Position Management',
        icon: Settings,
        content: `
## Managing Strangles

### Profit Taking

Close at 50% profit (don't get greedy).
Or at 21 DTE whichever comes first.
Gamma risk increases near expiration.

### Defending the Tested Side

**Call side tested (stock rallies):**
Roll call up and out for credit.
Or roll entire strangle up.
Consider closing if trend changes.

**Put side tested (stock drops):**
Roll put down and out for credit.
Or roll entire strangle down.
Close if support breaks.

### The "Inversion" Problem

When stock moves so much that strikes cross.
Your strangle becomes a "straddle".
Losses accelerate.
May need to close or aggressively roll.

### Never Do This

Let strangle go to expiration ITM.
Roll for a debit.
Average down on a losing strangle.
        `,
      },
      {
        id: 'scenarios',
        title: '4. P&L Scenarios',
        icon: BarChart3,
        content: `
## Profit & Loss Analysis

### Example Position

Stock at $100.
Sell $105 Call @ $2.00.
Sell $95 Put @ $2.00.
Credit: $4.00.

### At Expiration

| Stock Price | Call P&L | Put P&L | Total |
|-------------|----------|---------|-------|
| $115 | -$8.00 | +$2.00 | -$6.00 |
| $110 | -$3.00 | +$2.00 | -$1.00 |
| $105 | +$2.00 | +$2.00 | +$4.00 |
| $100 | +$2.00 | +$2.00 | +$4.00 |
| $95 | +$2.00 | +$2.00 | +$4.00 |
| $90 | +$2.00 | -$3.00 | -$1.00 |
| $85 | +$2.00 | -$8.00 | -$6.00 |

### Key Levels

**Upper Break-even:** $105 + $4 = $109.
**Lower Break-even:** $95 - $4 = $91.
**Profit Zone:** Stock can move ±9% and still profit.
        `,
      },
      {
        id: 'reference',
        title: '5. Quick Reference',
        icon: Lightbulb,
        content: `
## Strangle Quick Reference

### Entry Checklist

IV Rank above 30%.
Neutral RSI (40-60).
30-45 DTE.
Clear support and resistance levels.

### Strike Selection

16-20 delta on each side.
Place at technical levels.

### Management Rules

**Take Profit:** 50% of max profit.
**Time Stop:** Close at 21 DTE.
**Tested:** Roll the tested side.

### Greeks Profile

**Delta:** Near zero (neutral).
**Theta:** Positive (time helps).
**Vega:** Negative (IV drop helps).
**Gamma:** Negative (bad as stock moves).

### Common Mistakes

Not taking profit early.
Holding through big moves.
Wrong position sizing.
Ignoring IV crush.
        `,
      },
    ],
  },
  'credit-spreads': {
    name: 'Credit Spreads',
    icon: DollarSign,
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30',
    description: 'Defined risk directional trades collecting premium',
    quickStats: [
      { label: 'Market View', value: 'Directional', icon: TrendingUp },
      { label: 'Ideal DTE', value: '30-45', icon: Clock },
      { label: 'Win Rate', value: '60-70%', icon: Target },
      { label: 'Risk', value: 'Defined', icon: Shield },
    ],
    sections: [
      {
        id: 'what-is',
        title: '1. What is a Credit Spread?',
        icon: BookOpen,
        content: `
## Credit Spreads Explained

A credit spread is a vertical options strategy where you sell an option and buy a further OTM option for protection.

### Two Types

**Bull Put Spread (Bullish):**
Sell put at higher strike.
Buy put at lower strike.
Profit if stock stays above short strike.

**Bear Call Spread (Bearish):**
Sell call at lower strike.
Buy call at higher strike.
Profit if stock stays below short strike.

### Why Use Credit Spreads?

Defined max loss (width minus credit).
Lower margin than naked options.
High probability when sold OTM.
Time decay works for you.

### The Trade-off

Lower profit potential than naked selling.
But much safer with defined risk.
Better risk-adjusted returns long-term.
        `,
      },
      {
        id: 'setup',
        title: '2. Setting Up the Trade',
        icon: Target,
        content: `
## Entry Criteria

### Bull Put Spread (Bullish)

**When to use:** Bullish or neutral outlook, expect stock to stay above a level.
**Strike Selection:** Short put at or below support, long put 5-10 points lower.
**Delta:** 20-35 on short strike.

### Bear Call Spread (Bearish)

**When to use:** Bearish or neutral outlook, expect stock to stay below a level.
**Strike Selection:** Short call at or above resistance, long call 5-10 points higher.
**Delta:** 20-35 on short strike.

### DTE Selection

Ideal: 30-45 days.
Balances theta decay with adjustment time.
Avoid less than 14 DTE (gamma risk).

### Width Selection

Narrow ($5): Lower risk, lower reward.
Medium ($10): Balanced approach.
Wide ($20+): Higher reward, higher risk.

### Premium Targets

Collect minimum 1/3 of spread width.
$5 wide spread → collect at least $1.50.
$10 wide spread → collect at least $3.00.
        `,
      },
      {
        id: 'managing',
        title: '3. Position Management',
        icon: Settings,
        content: `
## Managing Credit Spreads

### Profit Taking

Close at 50% of max profit.
Example: Collected $1.50 → Close at $0.75.
Don't hold to expiration for extra pennies.

### Defending the Position

**Short strike tested:**
Roll entire spread further OTM.
Roll out in time for more credit.
Close if conviction gone.

**Max loss approached:**
Close immediately.
Don't hope for reversal.
Accept the loss and move on.

### Rolling Rules

**Roll for credit only:** Must receive net credit to roll.
**Roll timing:** When short strike breached or at 21 DTE if still under pressure.
**Not worth rolling:** If too deep ITM.

### The "Close at 21 DTE" Rule

Even if profitable, close at 21 DTE.
Gamma accelerates.
Risk/reward becomes unfavorable.
Open new position if still bullish/bearish.
        `,
      },
      {
        id: 'scenarios',
        title: '4. P&L Scenarios',
        icon: BarChart3,
        content: `
## Profit & Loss Analysis

### Example: Bull Put Spread

Stock at $100.
Sell $95 Put @ $2.00.
Buy $90 Put @ $0.50.
Credit: $1.50.
Width: $5.00.

### At Expiration

| Stock Price | P&L | % of Max |
|-------------|-----|----------|
| $100+ | +$1.50 | +100% (max profit) |
| $97 | +$1.50 | +100% |
| $95 | +$1.50 | +100% |
| $94 | +$0.50 | +33% |
| $93.50 | $0.00 | Break-even |
| $93 | -$0.50 | -14% |
| $91 | -$2.50 | -71% |
| $90 | -$3.50 | -100% (max loss) |

### Key Levels

**Max Profit:** $1.50 (above $95).
**Break-even:** $93.50 ($95 - $1.50).
**Max Loss:** $3.50 (below $90).

### Risk/Reward Calculation

Credit / (Width - Credit) = $1.50 / $3.50 = 0.43:1 reward-to-risk.
This is typical! You win more often but win less per trade.
        `,
      },
      {
        id: 'reference',
        title: '5. Quick Reference',
        icon: Lightbulb,
        content: `
## Credit Spread Quick Reference

### Entry Checklist

Clear directional bias.
30-45 DTE.
Short strike at support/resistance.
Credit at least 1/3 of width.
IV not too low.

### Bull Put Spread

Bias: Bullish/neutral.
Sell put at/below support.
Buy put lower for protection.

### Bear Call Spread

Bias: Bearish/neutral.
Sell call at/above resistance.
Buy call higher for protection.

### Management Rules

**Take Profit:** 50% profit → Close.
**Time-Based:** 21 DTE → Close regardless.
**Tested:** Short strike breached → Roll or close.

### Position Sizing

Risk 1-2% of portfolio per spread.
Account for full loss possibility.
Max 5-10 spreads simultaneously.

### Common Mistakes

Too tight stops (whipsawed out).
Holding to expiration for pennies.
Fighting the trend.
Over-leveraging.
        `,
      },
    ],
  },
};

function GuideSection({ 
  section, 
  isOpen, 
  onToggle,
  color 
}: { 
  section: Section;
  isOpen: boolean; 
  onToggle: () => void;
  color: string;
}) {
  const Icon = section.icon;
  
  const renderContent = (content: string) => {
    return content
      .replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold text-[var(--text-primary)] mt-6 mb-3 first:mt-0">$1</h2>')
      .replace(/^### (.*$)/gm, '<h3 class="text-lg font-medium text-[var(--text-primary)] mt-5 mb-2">$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-[var(--text-primary)]">$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-[var(--surface)] rounded text-sm font-mono text-[var(--info)]">$1</code>')
      .replace(/^> (.*$)/gm, '<blockquote class="border-l-4 border-[var(--info)] pl-4 italic my-4 text-[var(--text-secondary)]">$1</blockquote>')
      .replace(/\| (.*) \|/g, (match) => {
        const cells = match.split('|').filter(c => c.trim());
        const isHeader = cells.some(c => c.includes('---'));
        if (isHeader) return '';
        const cellClass = 'px-3 py-2 border border-[var(--border)]';
        return `<tr>${cells.map(c => `<td class="${cellClass}">${c.trim()}</td>`).join('')}</tr>`;
      })
      .replace(/(<tr>.*<\/tr>\n?)+/g, (match) => {
        return `<table class="w-full border-collapse my-4 text-sm"><tbody>${match}</tbody></table>`;
      })
      .replace(/^\n/gm, '<div class="h-3"></div>')
      .split('\n')
      .map(line => {
        if (line.startsWith('<') || line.trim() === '') return line;
        return `<p class="text-[var(--text-secondary)] leading-relaxed mb-2">${line}</p>`;
      })
      .join('');
  };
  
  return (
    <div className="card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-[var(--surface)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", `${color.replace('text-', 'bg-')}/20`)}>
            <Icon className={cn("w-4 h-4", color)} />
          </div>
          <span className="font-medium text-[var(--text-primary)]">{section.title}</span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-5 h-5 text-[var(--text-secondary)]" />
        ) : (
          <ChevronRight className="w-5 h-5 text-[var(--text-secondary)]" />
        )}
      </button>
      
      {isOpen && (
        <div className="px-6 pb-6 border-t border-[var(--border)]">
          <div 
            className="prose prose-invert max-w-none mt-4"
            dangerouslySetInnerHTML={{ __html: renderContent(section.content) }}
          />
        </div>
      )}
    </div>
  );
}

export default function GuidePage() {
  const [activeStrategy, setActiveStrategy] = useState<StrategyType>('ipmcc');
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['what-is']));

  const strategy = STRATEGIES[activeStrategy];

  const toggleSection = (id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setOpenSections(new Set(strategy.sections.map(s => s.id)));
  };

  const collapseAll = () => {
    setOpenSections(new Set());
  };

  const handleStrategyChange = (newStrategy: StrategyType) => {
    setActiveStrategy(newStrategy);
    setOpenSections(new Set(['what-is']));
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Strategy Guide</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Comprehensive guides for all supported trading strategies
        </p>
      </div>

      {/* Strategy Selector */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(STRATEGIES) as [StrategyType, Strategy][]).map(([key, strat]) => {
          const Icon = strat.icon;
          const isActive = activeStrategy === key;
          return (
            <button
              key={key}
              onClick={() => handleStrategyChange(key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all",
                isActive 
                  ? cn(strat.bgColor, strat.borderColor, strat.color, "border-2")
                  : "bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-2 border-transparent"
              )}
            >
              <Icon className="w-4 h-4" />
              {strat.name}
            </button>
          );
        })}
      </div>

      {/* Strategy Header */}
      <div className={cn("card p-6", strategy.bgColor, strategy.borderColor, "border")}>
        <div className="flex items-center gap-4">
          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", strategy.bgColor)}>
            <strategy.icon className={cn("w-6 h-6", strategy.color)} />
          </div>
          <div>
            <h2 className={cn("text-xl font-bold", strategy.color)}>{strategy.name}</h2>
            <p className="text-[var(--text-secondary)]">{strategy.description}</p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {strategy.quickStats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="card p-4 text-center">
              <Icon className={cn("w-6 h-6 mx-auto mb-2", strategy.color)} />
              <p className="text-2xl font-semibold text-[var(--text-primary)]">{stat.value}</p>
              <p className="text-xs text-[var(--text-secondary)]">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex justify-end gap-2">
        <button onClick={expandAll} className="btn-ghost text-sm">
          Expand All
        </button>
        <button onClick={collapseAll} className="btn-ghost text-sm">
          Collapse All
        </button>
      </div>

      {/* Guide Sections */}
      <div className="space-y-4">
        {strategy.sections.map(section => (
          <GuideSection
            key={section.id}
            section={section}
            isOpen={openSections.has(section.id)}
            onToggle={() => toggleSection(section.id)}
            color={strategy.color}
          />
        ))}
      </div>

      {/* Footer Tip */}
      <div className={cn("card p-6", strategy.bgColor, strategy.borderColor, "border")}>
        <div className="flex items-start gap-4">
          <Lightbulb className={cn("w-6 h-6 flex-shrink-0 mt-1", strategy.color)} />
          <div>
            <h3 className="font-semibold text-[var(--text-primary)]">Pro Tip</h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {activeStrategy === 'ipmcc' && "The key to success with IPMCC is consistency. Collect premium week after week, regardless of market direction."}
              {activeStrategy === '112-trade' && "Only enter 112 trades when IV is elevated. In low IV environments, the risk/reward is unfavorable."}
              {activeStrategy === 'strangles' && "Position sizing is everything with strangles. Never risk more than 2-3% of your account on any single strangle."}
              {activeStrategy === 'credit-spreads' && "Focus on high-probability setups with credit spreads. A 70% win rate with proper position sizing beats chasing home runs."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
