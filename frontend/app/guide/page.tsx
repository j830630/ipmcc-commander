'use client';

import { useState } from 'react';
import { 
  BookOpen, 
  TrendingUp, 
  Settings, 
  AlertTriangle, 
  BarChart3,
  ChevronRight,
  ChevronDown,
  Lightbulb,
  Target,
  Shield,
  Clock,
  GitBranch,
  ArrowDownUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

type StrategyType = 'ipmcc' | '112-trade' | 'strangles' | 'credit-spreads';

// Strategy configurations
const STRATEGIES = {
  ipmcc: {
    name: 'Income PMCC',
    icon: TrendingUp,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    description: 'Cash-flow-first covered call alternative using LEAPs',
    quickStats: [
      { label: 'LEAP Delta', value: '70-90Δ', icon: Shield },
      { label: 'Short Strike', value: 'ATM (50Δ)', icon: Target },
      { label: 'Short Duration', value: '7 DTE', icon: Clock },
      { label: 'Roll Threshold', value: '80%', icon: TrendingUp },
    ],
    sections: [
      {
        id: 'what-is',
        title: '1. What is Income PMCC?',
        icon: BookOpen,
        content: `
## The Income Poor Man's Covered Call

The Income PMCC is a **cash-flow-first options strategy** that prioritizes weekly extrinsic value collection over capital appreciation.

### Standard PMCC vs Income PMCC

| Aspect | Standard PMCC | Income PMCC |
|--------|---------------|-------------|
| **Short Strike** | OTM (10-30Δ) | ATM (50Δ) or ITM |
| **Objective** | Appreciation + some premium | Weekly cash flow (extrinsic) |
| **Best For** | Bull markets | Any market condition |

### The Core Mantra

> **"Extrinsic Value, Over Time"**

Think of yourself as an insurance underwriter, not a stock investor. You collect premiums (extrinsic value) from buyers seeking protection or speculation.

### Why It Works

1. **Theta decay is reliable** — Time passes no matter what the market does
2. **ATM options have maximum extrinsic** — More premium to harvest
3. **Reduced capital requirement** — LEAP costs less than 100 shares
4. **Works in any direction** — Even flat or down markets generate income
        `,
      },
      {
        id: 'setup',
        title: '2. Setting Up a Trade',
        icon: Target,
        content: `
## Trade Entry Criteria

### Market Conditions
- **Weekly uptrend**: 21 EMA > 50 EMA > 200 EMA
- **Daily RSI**: < 50 or reversing from oversold
- **Price at support**: Lower Bollinger, 50/100/200 MA, or 3-ATR band

### Underlying Selection
✅ High-quality stocks and ETFs only:
- **ETFs**: SPY, QQQ, IWM, DIA
- **Mega-caps**: AAPL, TSLA, NVDA, MSFT, AMZN
- **High IV**: MSTR, COIN (for aggressive traders)

### Long LEAP Configuration
- **Delta**: 70-90 (prefer 80)
- **DTE**: 180-600 days (sweet spot: 12-18 months)
- **Strike**: Deep in-the-money

### Short Call Configuration
- **Strike**: ATM (at-the-money) for maximum extrinsic
- **DTE**: 7 days (can range 3-14)
- **Timing**: Open Monday-Tuesday, close/roll Thursday-Friday
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
- 80-90% of extrinsic value captured
- 1-2 days before expiration
- Stock has moved significantly ITM on your short

**Roll To:**
- Same strike (if neutral) 
- Higher strike (if bullish/assigned risk)
- Lower strike (if bearish/want more protection)

### Exit Signals

🔴 **EMERGENCY EXIT** (Net loss > 30%)
- Close entire position immediately
- Don't average down
- Reassess market conditions before re-entry

🟡 **TAKE PROFIT** (50%+ total gain)
- Consider closing entire position
- Or continue if thesis unchanged

🟡 **LEAP THETA WARNING** (< 60 DTE)
- Roll LEAP to later expiration
- Or close position and restart
        `,
      },
      {
        id: 'scenarios',
        title: '4. Market Scenarios',
        icon: BarChart3,
        content: `
## How IPMCC Behaves in Different Markets

### 📈 Stock Goes Up
- Short call goes ITM → **Roll up and out** for net credit
- LEAP increases in value → Total position profits
- **Result**: Profit from both LEAP appreciation + premium collected

### 📊 Stock Stays Flat
- Short call expires worthless → **Keep all premium**
- LEAP maintains value → Minimal change
- **Result**: Pure theta profit (ideal scenario!)

### 📉 Stock Goes Down
- Short call expires worthless → **Keep premium**
- LEAP loses value → Partially offset by collected premium
- **Result**: Loss cushioned by premium income

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
- [ ] Weekly uptrend (21 > 50 > 200 EMA)
- [ ] Daily RSI < 50 or reversing
- [ ] Price at support level
- [ ] Quality underlying (SPY, QQQ, AAPL, etc.)
- [ ] LEAP: 70-90 delta, 180+ DTE
- [ ] Short: ATM, ~7 DTE

### Key Formulas

**Income Velocity™**
\`(Weekly Extrinsic / Capital) × 100\`
Target: 1.5-2.5% per week

**Weeks to Breakeven**
\`LEAP Cost / Weekly Extrinsic\`
Example: $14,300 / $485 = 29.5 weeks

### Risk Rules
- **Max position size**: 10-20% of trading capital
- **Emergency exit**: -30% net loss
- **Profit target**: +50% total return
- **LEAP minimum**: 60 DTE remaining
        `,
      },
    ],
  },
  '112-trade': {
    name: '112 Trade',
    icon: Target,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    description: 'Put ratio spread for bearish/neutral income with defined risk',
    quickStats: [
      { label: 'Structure', value: '1:1:2', icon: Target },
      { label: 'Ideal DTE', value: '14-17', icon: Clock },
      { label: 'Risk Profile', value: 'Defined', icon: Shield },
      { label: 'Best IV', value: '>35%', icon: BarChart3 },
    ],
    sections: [
      {
        id: 'what-is',
        title: '1. What is the 112 Trade?',
        icon: BookOpen,
        content: `
## The 112 Put Ratio Spread

The 112 Trade is a **defined-risk put ratio spread** that profits from time decay while providing downside protection.

### Structure
- **Buy 1** Put at higher strike (long protection)
- **Sell 1** Put at middle strike (credit)
- **Sell 2** Puts at lower strike (income)

### Example Setup
Stock at $100:
- Buy 1x $100 Put
- Sell 1x $95 Put  
- Sell 2x $90 Puts

### Why "112"?
The name comes from the ratio: **1** long, **1** short, **2** short = 1:1:2

### Profit Zones
1. **Above long strike**: Small loss/gain from initial debit/credit
2. **Between strikes**: Maximum profit zone
3. **At short strikes**: Still profitable
4. **Below short strikes**: Loss begins (but defined)

### Key Benefits
- **Defined max loss** unlike naked puts
- **Profits in flat/down markets** up to a point
- **Lower margin** than selling naked puts
- **IV expansion helps** if opened in low IV
        `,
      },
      {
        id: 'setup',
        title: '2. Setting Up the Trade',
        icon: Target,
        content: `
## Trade Entry Criteria

### Ideal Market Conditions
- **Elevated IV**: >35% (more premium to collect)
- **Neutral to slight bearish bias**
- **Clear support level below** current price
- **No major events** (earnings, FDA) before expiration

### Strike Selection

**Long Put (Protection)**
- ATM or slightly OTM
- This is your hedge

**First Short Put**
- 5-10% below current price
- At a technical support level

**Two Short Puts (Income)**
- Another 5-10% below first short
- At stronger support level
- These generate most of the credit

### DTE Selection
- **Ideal**: 14-17 days
- **Acceptable**: 10-21 days
- Avoid: <10 (gamma risk) or >30 (ties up capital)

### Example with Real Numbers
Stock at $500:
- Buy 1x $500P @ $8.00
- Sell 1x $480P @ $4.50
- Sell 2x $460P @ $2.50 each = $5.00

**Net**: -$8.00 + $4.50 + $5.00 = **$1.50 credit**
        `,
      },
      {
        id: 'managing',
        title: '3. Position Management',
        icon: Settings,
        content: `
## Managing the 112 Trade

### Profit Target
- Close at **50% of max profit**
- Don't get greedy waiting for expiration

### Adjustment Triggers

**Stock rallies strongly:**
- Position becomes small loser
- Consider closing for small loss
- Or let expire if loss is acceptable

**Stock drops to short strike zone:**
- This is your profit zone!
- Let theta work, don't panic

**Stock crashes through lower short strike:**
- Close immediately if support breaks
- Max loss is defined but painful

### The Roll Decision

**When to roll:**
- 3-5 days left, stock near short strikes
- Roll out in time for more credit

**When NOT to roll:**
- Stock broken major support
- Trend clearly changed
- Better to close and reassess

### Exit Rules
- ✅ 50% profit reached → Close
- ✅ Stock at max profit zone at expiration → Let expire
- ❌ Stock crashes through support → Close for loss
- ❌ 21+ DTE and position underwater → Manage or close
        `,
      },
      {
        id: 'scenarios',
        title: '4. P&L Scenarios',
        icon: BarChart3,
        content: `
## Profit & Loss Analysis

### Example Position
- Current price: $500
- Buy 1x $500P
- Sell 1x $480P
- Sell 2x $460P
- Net credit: $1.50

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

### Max Profit Calculation
\`Width of spread + Credit received\`
= $20 + $1.50 = **$21.50/share**

### Max Loss Calculation
\`(Lower short strike × 2) - Middle short - Long strike + Premium\`
Only reached if stock goes to $0 (unrealistic)

### Break-even Points
- Upper: Long strike + credit = $501.50
- Lower: Depends on spread widths
        `,
      },
      {
        id: 'reference',
        title: '5. Quick Reference',
        icon: Lightbulb,
        content: `
## 112 Trade Quick Reference

### Entry Checklist
- [ ] IV > 35% (elevated)
- [ ] 14-17 DTE
- [ ] Clear support levels identified
- [ ] No earnings before expiration
- [ ] Net credit or small debit

### Structure Rules
- Long put: ATM or slightly OTM
- Short puts: At support levels
- Ratio always 1:1:2
- Same expiration for all legs

### Management Rules

**Take Profit:**
- 50% of max profit → Close

**Stop Loss:**
- Stock breaks major support → Close
- Loss > initial credit × 3 → Close

### Greeks to Watch
- **Theta**: Should be positive (time helps you)
- **Delta**: Starts near zero, goes negative as stock drops
- **Vega**: Positive exposure to IV

### Common Mistakes
❌ Opening in low IV
❌ Too wide between strikes
❌ Holding through earnings
❌ Not respecting support breaks
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

A short strangle involves **selling both an OTM put and an OTM call** to collect premium from both sides.

### Structure
- **Sell 1** OTM Call (above current price)
- **Sell 1** OTM Put (below current price)
- Same expiration, different strikes

### Example Setup
Stock at $100:
- Sell 1x $105 Call @ $2.00
- Sell 1x $95 Put @ $2.00
- **Total credit**: $4.00

### The Thesis
You're betting the stock will stay **between your strikes** until expiration. As long as it does, you keep all the premium.

### Why Trade Strangles?
1. **Double premium** compared to single-leg selling
2. **Wide profit range** when strikes are far apart
3. **Benefits from IV crush** after events
4. **Theta decay from both sides**

### The Risks
⚠️ **Undefined risk** on both sides
⚠️ **Large moves** in either direction hurt
⚠️ **Assignment risk** if ITM at expiration
⚠️ **Margin intensive** in regular accounts
        `,
      },
      {
        id: 'setup',
        title: '2. Setting Up the Trade',
        icon: Target,
        content: `
## Entry Criteria

### Ideal Market Conditions
- **High IV Rank**: >30% (more premium)
- **Range-bound price action** (no clear trend)
- **Neutral RSI**: 40-60
- **Post-earnings** (IV crush opportunity)
- **Stable sector** (no major catalysts)

### Strike Selection

**Short Call (Upper bound)**
- 15-30 delta (15-30% chance of being ITM)
- Above resistance levels
- ~1 standard deviation OTM

**Short Put (Lower bound)**
- 15-30 delta
- Below support levels
- ~1 standard deviation OTM

### DTE Selection
- **Ideal**: 30-45 days
- Sweet spot for theta decay
- Time to adjust if needed

### Position Sizing
- Use only **2-5% of portfolio** per strangle
- Account for potential 2-3x losses
- Must be able to manage/roll

### Premium Targets
- Collect at least **1% of underlying price**
- Example: $500 stock → collect $5+ total
        `,
      },
      {
        id: 'managing',
        title: '3. Position Management',
        icon: Settings,
        content: `
## Managing Strangles

### Profit Taking
- Close at **50% profit** (don't get greedy)
- Or **21 DTE** whichever comes first
- Gamma risk increases near expiration

### Defending the Tested Side

**Call side tested (stock rallies):**
- Roll call up and out for credit
- Or roll entire strangle up
- Consider closing if trend changes

**Put side tested (stock drops):**
- Roll put down and out for credit
- Or roll entire strangle down
- Close if support breaks

### The "Inversion" Problem
When stock moves so much that strikes cross:
- Your 95/105 strangle becomes a "straddle"
- Losses accelerate
- May need to close or aggressively roll

### Adjustment Strategies

**Rolling for credit:**
- Only roll if you receive credit
- Extend duration (more time = more extrinsic)
- Move strike away from price

**Closing one side:**
- If one side is worthless, close it
- Reduces risk, locks in partial profit

### Never Do This
❌ Let strangle go to expiration ITM
❌ Roll for a debit
❌ Average down on a losing strangle
        `,
      },
      {
        id: 'scenarios',
        title: '4. P&L Scenarios',
        icon: BarChart3,
        content: `
## Profit & Loss Analysis

### Example Position
- Stock at $100
- Sell $105 Call @ $2.00
- Sell $95 Put @ $2.00
- Credit: $4.00

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

### Break-even Points
- Upper: $105 + $4 = **$109**
- Lower: $95 - $4 = **$91**

### Profit Zone
Stock can move **±9%** and still profit
(From $91 to $109)

### Greeks Profile
- **Delta**: Near zero (neutral)
- **Theta**: Positive (time helps)
- **Vega**: Negative (IV drop helps)
- **Gamma**: Negative (bad as stock moves)
        `,
      },
      {
        id: 'reference',
        title: '5. Quick Reference',
        icon: Lightbulb,
        content: `
## Strangle Quick Reference

### Entry Checklist
- [ ] IV Rank > 30%
- [ ] RSI 40-60 (neutral)
- [ ] 30-45 DTE
- [ ] No earnings/events in period
- [ ] Both strikes at support/resistance

### Strike Guidelines
- Call: 15-30 delta, above resistance
- Put: 15-30 delta, below support
- Roughly equal deltas = neutral bias

### Management Rules

**Take Profit:**
- 50% profit OR 21 DTE → Close

**Tested Side:**
- Roll away for credit if possible
- Close if can't roll for credit

**Both sides threatened:**
- Close position
- Do not hold through extreme moves

### Position Sizing
- Max 2-5% of portfolio per strangle
- Account for undefined risk
- Be able to withstand 2-3x loss

### Best Underlyings
- High-liquidity: SPY, QQQ, IWM
- Non-directional: Range-bound stocks
- Post-earnings: IV crush plays
        `,
      },
    ],
  },
  'credit-spreads': {
    name: 'Credit Spreads',
    icon: ArrowDownUp,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    description: 'Defined-risk directional premium selling strategy',
    quickStats: [
      { label: 'Risk', value: 'Defined', icon: Shield },
      { label: 'Ideal DTE', value: '30-45', icon: Clock },
      { label: 'Win Rate', value: '65-80%', icon: Target },
      { label: 'Reward:Risk', value: '1:2-3', icon: BarChart3 },
    ],
    sections: [
      {
        id: 'what-is',
        title: '1. What are Credit Spreads?',
        icon: BookOpen,
        content: `
## Credit Spreads Explained

A credit spread involves **selling one option and buying another** at a different strike to create a defined-risk position.

### Two Types

**Bull Put Spread (Bullish)**
- Sell higher strike put
- Buy lower strike put
- Profit if stock stays above short strike

**Bear Call Spread (Bearish)**
- Sell lower strike call
- Buy higher strike call
- Profit if stock stays below short strike

### Example: Bull Put Spread
Stock at $100:
- Sell $95 Put @ $2.00
- Buy $90 Put @ $0.50
- **Net credit**: $1.50
- **Max risk**: $5.00 - $1.50 = $3.50

### Why Trade Credit Spreads?
1. **Defined max loss** (width - credit)
2. **Lower margin** than naked options
3. **High probability** when sold OTM
4. **Time decay** works for you

### The Trade-off
- Lower profit potential than naked selling
- But much safer with defined risk
- Better risk-adjusted returns long-term
        `,
      },
      {
        id: 'setup',
        title: '2. Setting Up the Trade',
        icon: Target,
        content: `
## Entry Criteria

### Bull Put Spread (Bullish)

**When to use:**
- Bullish or neutral outlook
- Expect stock to stay above a level
- Support below current price

**Strike Selection:**
- Short put: At or below support
- Long put: 5-10 points lower
- Delta: 20-35 on short strike

### Bear Call Spread (Bearish)

**When to use:**
- Bearish or neutral outlook
- Expect stock to stay below a level
- Resistance above current price

**Strike Selection:**
- Short call: At or above resistance
- Long call: 5-10 points higher
- Delta: 20-35 on short strike

### DTE Selection
- **Ideal**: 30-45 days
- Balances theta decay with adjustment time
- Avoid <14 DTE (gamma risk)

### Width Selection
- **Narrow** ($5): Lower risk, lower reward
- **Medium** ($10): Balanced
- **Wide** ($20+): Higher reward, higher risk

### Premium Targets
- Collect **⅓ of spread width** minimum
- $5 wide spread → collect at least $1.50
- $10 wide spread → collect at least $3.00
        `,
      },
      {
        id: 'managing',
        title: '3. Position Management',
        icon: Settings,
        content: `
## Managing Credit Spreads

### Profit Taking
- Close at **50% of max profit**
- Example: Collected $1.50 → Close at $0.75
- Don't hold to expiration for extra pennies

### Defending the Position

**Short strike tested:**
- Roll entire spread further OTM
- Roll out in time for more credit
- Close if conviction gone

**Max loss approached:**
- Close immediately
- Don't hope for reversal
- Accept the loss and move on

### Rolling Rules

**Roll for credit only:**
- Must receive net credit to roll
- Extends duration, moves strikes

**Roll timing:**
- When short strike breached
- 21 DTE if still under pressure
- Not worth rolling if too deep ITM

### The "Close at 21 DTE" Rule
Even if profitable, close at 21 DTE:
- Gamma accelerates
- Risk/reward becomes unfavorable
- Open new position if still bullish/bearish

### Exit Triggers
✅ 50% profit → Close
✅ 21 DTE → Close regardless
❌ Short strike breached → Roll or close
❌ Max loss hit → Close immediately
        `,
      },
      {
        id: 'scenarios',
        title: '4. P&L Scenarios',
        icon: BarChart3,
        content: `
## Profit & Loss Analysis

### Example: Bull Put Spread
- Stock at $100
- Sell $95 Put @ $2.00
- Buy $90 Put @ $0.50
- Credit: $1.50
- Width: $5.00

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
- **Max Profit**: $1.50 (above $95)
- **Break-even**: $93.50 ($95 - $1.50)
- **Max Loss**: $3.50 (below $90)

### Probability Analysis
If short strike at 30 delta:
- ~70% chance of max profit
- But risk/reward is 1:2.3

### Risk/Reward Calculation
\`Credit / (Width - Credit)\`
$1.50 / $3.50 = **0.43:1** reward-to-risk

This is typical! You win more often but win less.
        `,
      },
      {
        id: 'reference',
        title: '5. Quick Reference',
        icon: Lightbulb,
        content: `
## Credit Spread Quick Reference

### Entry Checklist
- [ ] Clear directional bias
- [ ] 30-45 DTE
- [ ] Short strike at support/resistance
- [ ] Credit ≥ ⅓ of width
- [ ] IV not too low

### Bull Put Spread
- Bias: Bullish/neutral
- Sell put at/below support
- Buy put lower for protection

### Bear Call Spread
- Bias: Bearish/neutral
- Sell call at/above resistance
- Buy call higher for protection

### Management Rules

**Take Profit:**
- 50% profit → Close

**Time-Based:**
- 21 DTE → Close regardless

**Tested:**
- Short strike breached → Roll or close

### Position Sizing
- Risk 1-2% of portfolio per spread
- Account for full loss possibility
- Max 5-10 spreads simultaneously

### Common Mistakes
❌ Too tight stops (whipsawed out)
❌ Holding to expiration for pennies
❌ Fighting the trend
❌ Over-leveraging
        `,
      },
    ],
  },
};

// Guide section component
function GuideSection({ 
  section, 
  isOpen, 
  onToggle,
  color 
}: { 
  section: { id: string; title: string; icon: any; content: string };
  isOpen: boolean; 
  onToggle: () => void;
  color: string;
}) {
  const Icon = section.icon;
  
  // Simple markdown to HTML conversion
  const renderContent = (content: string) => {
    return content
      .replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold text-[var(--text-primary)] mt-6 mb-3 first:mt-0">$1</h2>')
      .replace(/^### (.*$)/gm, '<h3 class="text-lg font-medium text-[var(--text-primary)] mt-4 mb-2">$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-[var(--text-primary)]">$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-[var(--surface)] rounded text-sm font-mono text-[var(--info)]">$1</code>')
      .replace(/^> (.*$)/gm, '<blockquote class="border-l-4 border-[var(--info)] pl-4 italic my-4 text-[var(--text-secondary)]">$1</blockquote>')
      .replace(/^- \[ \] (.*$)/gm, '<div class="flex items-center gap-2 ml-4"><input type="checkbox" disabled class="rounded" /><span>$1</span></div>')
      .replace(/^- (.*$)/gm, '<li class="ml-4 text-[var(--text-secondary)]">• $1</li>')
      .replace(/^(\d+)\. (.*$)/gm, '<li class="ml-4 text-[var(--text-secondary)]">$1. $2</li>')
      .replace(/^(✅|❌|⚠️|🔴|🟡|📈|📊|📉|💥) (.*$)/gm, '<div class="ml-4 text-[var(--text-secondary)]">$1 $2</div>')
      .replace(/\|(.+)\|/g, (match) => {
        const cells = match.split('|').filter(c => c.trim());
        if (cells.some(c => c.includes('---'))) return '';
        const isHeader = match.includes('Stock') || match.includes('Aspect') || match.includes('Ticker');
        const tag = isHeader ? 'th' : 'td';
        const className = isHeader ? 'text-left p-2 border-b border-[var(--border)] font-medium' : 'p-2 border-b border-[var(--border)] text-[var(--text-secondary)]';
        return `<tr>${cells.map(c => `<${tag} class="${className}">${c.trim()}</${tag}>`).join('')}</tr>`;
      })
      .replace(/<tr>/g, '<table class="w-full text-sm my-4"><tbody><tr>')
      .replace(/<\/tr>(?![\s\S]*<tr>)/g, '</tr></tbody></table>')
      .replace(/\n\n/g, '<br/><br/>');
  };
  
  return (
    <div className="card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-[var(--surface)]/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", color.replace('text-', 'bg-') + '/10')}>
            <Icon className={cn("w-5 h-5", color)} />
          </div>
          <span className="font-semibold text-[var(--text-primary)]">{section.title}</span>
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
            className="prose prose-invert max-w-none mt-4 text-[var(--text-secondary)]"
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

  // Reset open sections when strategy changes
  const handleStrategyChange = (newStrategy: StrategyType) => {
    setActiveStrategy(newStrategy);
    setOpenSections(new Set(['what-is']));
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Strategy Guide</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Comprehensive guides for all supported trading strategies
        </p>
      </div>

      {/* Strategy Selector */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(STRATEGIES) as [StrategyType, typeof STRATEGIES[StrategyType]][]).map(([key, strat]) => {
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
              {activeStrategy === 'strangles' && "Always have an exit plan before entering. Know your roll points and max loss limits ahead of time."}
              {activeStrategy === 'credit-spreads' && "Take profits at 50% - the extra 50% isn't worth the gamma risk as expiration approaches."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
