'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, BookOpen, Target, Shield, AlertTriangle, CheckCircle,
  TrendingUp, TrendingDown, Minus, Clock, DollarSign, Activity,
  Zap, Eye, Lock, BarChart3, Percent, Award, AlertOctagon, Timer
} from 'lucide-react';

type GuideTab = 'ipmcc' | '0dte';

// ============================================================================
// IPMCC GUIDE CONTENT
// ============================================================================

function IPMCCGuide() {
  return (
    <div className="space-y-8 max-w-4xl">
      {/* Introduction */}
      <section>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          What is IPMCC?
        </h2>
        <div className="card p-5">
          <p className="mb-3">
            <strong>IPMCC (Income Portfolio Management with Covered Calls)</strong> is a systematic approach 
            to generating consistent premium income from stock positions while maintaining defined risk parameters.
          </p>
          <p className="text-[var(--text-secondary)]">
            The strategy involves selling out-of-the-money calls against long stock positions to collect 
            premium, while using macro context and IV analysis to time entries optimally.
          </p>
        </div>
      </section>

      {/* Core Principles */}
      <section>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-emerald-500" />
          Core Principles
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card p-4 border-l-4 border-emerald-500">
            <h4 className="font-semibold mb-2">1. IV Rank Timing</h4>
            <p className="text-sm text-[var(--text-secondary)]">
              Enter when IV Rank is between 40-70. This ensures premium is worth the risk without extreme volatility.
            </p>
          </div>
          <div className="card p-4 border-l-4 border-blue-500">
            <h4 className="font-semibold mb-2">2. Delta Selection</h4>
            <p className="text-sm text-[var(--text-secondary)]">
              Sell calls at 0.20-0.30 delta (typically 5-10% OTM). Balances premium vs assignment probability.
            </p>
          </div>
          <div className="card p-4 border-l-4 border-purple-500">
            <h4 className="font-semibold mb-2">3. DTE Selection</h4>
            <p className="text-sm text-[var(--text-secondary)]">
              Target 30-45 DTE for optimal theta decay. Roll at 21 DTE or when 50% profit achieved.
            </p>
          </div>
          <div className="card p-4 border-l-4 border-orange-500">
            <h4 className="font-semibold mb-2">4. Earnings Avoidance</h4>
            <p className="text-sm text-[var(--text-secondary)]">
              Never hold through earnings. Close or roll to post-earnings expiration at least 1 week before.
            </p>
          </div>
        </div>
      </section>

      {/* Entry Checklist */}
      <section>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-500" />
          Entry Checklist
        </h2>
        <div className="card p-5">
          <ul className="space-y-3">
            {[
              'IV Rank ≥ 40 (optimal 40-70)',
              'No earnings within 2 weeks of expiration',
              'Sector relative strength ≥ 0.9 (not underperforming)',
              'VIX regime not "extreme" (< 30)',
              'FOMC/CPI not within 5 days',
              'Underlying trend neutral to bullish',
              'Strike selected at 0.20-0.30 delta',
              'DTE between 30-45 days'
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 112 Trade */}
      <section>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-purple-500" />
          112 Trade Structure
        </h2>
        <div className="card p-5">
          <p className="mb-4">
            The 112 is a modified ratio spread that provides defined risk with premium collection potential.
          </p>
          <div className="bg-purple-500/10 p-4 rounded-lg mb-4">
            <p className="font-mono font-bold">
              Buy 1x ATM → Sell 1x Near OTM → Sell 2x Far OTM
            </p>
            <p className="text-sm text-[var(--text-secondary)] mt-2">
              Example (Bullish): Buy 1x 500C / Sell 1x 505C / Sell 2x 515C
            </p>
          </div>
          <h4 className="font-semibold mb-2">When to Use:</h4>
          <ul className="list-disc list-inside text-sm text-[var(--text-secondary)] space-y-1">
            <li>IV Rank 35-60 with clear directional bias</li>
            <li>Want defined risk unlike naked positions</li>
            <li>Expect moderate move, not explosive</li>
          </ul>
        </div>
      </section>

      {/* Short Strangle */}
      <section>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-orange-500" />
          Short Strangle
        </h2>
        <div className="card p-5">
          <div className="bg-orange-500/10 border border-orange-500/30 p-4 rounded-lg mb-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5" />
              <p className="font-medium text-orange-400">
                ⚠️ Undefined Risk - Advanced Strategy
              </p>
            </div>
          </div>
          <p className="mb-4">
            Sell OTM put and OTM call simultaneously. Profits from time decay in range-bound markets.
          </p>
          <div className="bg-[var(--surface)] p-4 rounded-lg mb-4">
            <p className="font-mono font-bold">
              Sell 1x OTM Put + Sell 1x OTM Call
            </p>
            <p className="text-sm text-[var(--text-secondary)] mt-2">
              Example: Sell 530P + Sell 620C (SPY at 575)
            </p>
          </div>
          <h4 className="font-semibold mb-2 text-red-400">Critical Requirements:</h4>
          <ul className="list-disc list-inside text-sm space-y-1">
            <li><strong>IV Rank ≥ 50</strong> (preferably 60+)</li>
            <li>NO earnings before expiration</li>
            <li>Neutral market trend expected</li>
            <li>Position size ≤ 2-3% of portfolio</li>
            <li>VIX NOT in extreme regime</li>
          </ul>
        </div>
      </section>

      {/* Risk Management */}
      <section>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-red-500" />
          Risk Management
        </h2>
        <div className="card p-5">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Position Sizing</h4>
              <ul className="text-sm text-[var(--text-secondary)] space-y-1">
                <li>• IPMCC: 5-10% of portfolio per position</li>
                <li>• 112: 2-5% of portfolio per trade</li>
                <li>• Strangle: MAX 2-3% per position</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Exit Rules</h4>
              <ul className="text-sm text-[var(--text-secondary)] space-y-1">
                <li>• Take profit at 50% of max gain</li>
                <li>• Roll at 21 DTE if profitable</li>
                <li>• Cut loss at 200% of credit received</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// 0-DTE GUIDE CONTENT
// ============================================================================

function ZeroDTEGuide() {
  return (
    <div className="space-y-8 max-w-4xl">
      {/* Introduction */}
      <section>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Timer className="w-5 h-5 text-red-500" />
          The Desk Methodology
        </h2>
        <div className="card p-5 bg-red-500/5 border border-red-500/20">
          <p className="mb-3">
            <strong>The Desk</strong> is an institutional-grade approach to 0-DTE options trading that 
            emphasizes <span className="text-red-400">capital preservation over profit maximization</span>.
          </p>
          <p className="text-[var(--text-secondary)]">
            Unlike retail "scalping" or "lotto" approaches, The Desk uses structural market analysis 
            (GEX, Vanna, Charm) to identify high-probability, defined-risk setups.
          </p>
        </div>
      </section>

      {/* Core Rules */}
      <section>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Lock className="w-5 h-5 text-red-500" />
          The Desk Rules (Non-Negotiable)
        </h2>
        <div className="space-y-3">
          {[
            { rule: 'NO SCALPING', desc: 'Minimum hold time 15 minutes. We are not day-trading gamblers.' },
            { rule: 'NO LOTTOS', desc: 'Never buy far OTM options hoping for a miracle. Defined risk only.' },
            { rule: 'NO AVERAGING DOWN', desc: 'If wrong, exit. Do not add to losing positions.' },
            { rule: 'SIGNALS CONFLICT = NO TRADE', desc: 'If GEX and flow disagree, stand aside.' },
            { rule: 'BINARY EVENTS = NO TRADE', desc: 'FOMC, CPI, NFP within 5 days = absolute block.' },
            { rule: 'CAPITAL PRESERVATION FIRST', desc: 'It\'s okay to miss a trade. It\'s not okay to blow up.' }
          ].map((item, i) => (
            <div key={i} className="card p-4 border-l-4 border-red-500">
              <h4 className="font-bold text-red-400">{item.rule}</h4>
              <p className="text-sm text-[var(--text-secondary)]">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Market Regimes */}
      <section>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-purple-500" />
          Market Regimes
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card p-4">
            <h4 className="font-semibold text-emerald-500 mb-2">TREND DAY</h4>
            <p className="text-sm text-[var(--text-secondary)] mb-2">
              Dealers SHORT gamma + strong directional flow
            </p>
            <p className="text-xs bg-[var(--surface)] p-2 rounded">
              <strong>Trade:</strong> Follow trend with debit spreads/verticals
            </p>
          </div>
          <div className="card p-4">
            <h4 className="font-semibold text-blue-500 mb-2">MEAN REVERSION</h4>
            <p className="text-sm text-[var(--text-secondary)] mb-2">
              Dealers LONG gamma + charm pinning effect
            </p>
            <p className="text-xs bg-[var(--surface)] p-2 rounded">
              <strong>Trade:</strong> Fade extremes with butterflies/condors
            </p>
          </div>
          <div className="card p-4">
            <h4 className="font-semibold text-orange-500 mb-2">VOLATILITY BREAKOUT</h4>
            <p className="text-sm text-[var(--text-secondary)] mb-2">
              VIX expanding rapidly, uncertainty high
            </p>
            <p className="text-xs bg-[var(--surface)] p-2 rounded">
              <strong>Trade:</strong> Direction from flow, wider stops
            </p>
          </div>
          <div className="card p-4">
            <h4 className="font-semibold text-red-500 mb-2">CHOPPY FAKEOUT</h4>
            <p className="text-sm text-[var(--text-secondary)] mb-2">
              Conflicting signals, no clear direction
            </p>
            <p className="text-xs bg-red-500/10 p-2 rounded border border-red-500/30">
              <strong>NO TRADE</strong> - Stand aside
            </p>
          </div>
        </div>
      </section>

      {/* GEX Levels */}
      <section>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-purple-500" />
          GEX Level Interpretation
        </h2>
        <div className="card p-5">
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-24 font-bold text-purple-400">Zero Gamma</div>
              <div className="flex-1 text-sm">
                <p>The pivot point. Above = positive gamma territory. Below = negative gamma territory.</p>
                <p className="text-[var(--text-secondary)]">Price tends to gravitate here in mean reversion regimes.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-24 font-bold text-emerald-400">Call Wall</div>
              <div className="flex-1 text-sm">
                <p>Major resistance from dealer hedging. Heavy call open interest.</p>
                <p className="text-[var(--text-secondary)]">Target for bullish moves, resistance in range-bound.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-24 font-bold text-red-400">Put Wall</div>
              <div className="flex-1 text-sm">
                <p>Major support from dealer hedging. Heavy put open interest.</p>
                <p className="text-[var(--text-secondary)]">Target for bearish moves, support in range-bound.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-24 font-bold">Net GEX</div>
              <div className="flex-1 text-sm">
                <p><strong>Positive:</strong> Dealers long gamma → Mean reversion, dampen moves</p>
                <p><strong>Negative:</strong> Dealers short gamma → Trend days, amplify moves</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Flow Analysis */}
      <section>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Eye className="w-5 h-5 text-blue-500" />
          Flow Analysis
        </h2>
        <div className="card p-5">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3">Volume Delta</h4>
              <ul className="text-sm space-y-2">
                <li className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <span><strong>&gt; +1.5:</strong> Strong bullish flow</span>
                </li>
                <li className="flex items-center gap-2">
                  <Minus className="w-4 h-4 text-yellow-500" />
                  <span><strong>-1.0 to +1.0:</strong> Neutral/mixed</span>
                </li>
                <li className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  <span><strong>&lt; -1.5:</strong> Strong bearish flow</span>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Fakeout Detection</h4>
              <ul className="text-sm space-y-2 text-[var(--text-secondary)]">
                <li>• Price up + flow negative = Bull trap risk</li>
                <li>• Price down + flow positive = Bear trap risk</li>
                <li>• Mixed dark pool prints = No conviction</li>
                <li>• Vanna vs Delta divergence = Watch for reversal</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Structures */}
      <section>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-emerald-500" />
          Approved Structures
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="card p-4">
            <h4 className="font-semibold mb-2">Vertical Spreads</h4>
            <p className="text-sm text-[var(--text-secondary)] mb-2">
              Directional, defined risk
            </p>
            <p className="text-xs bg-[var(--surface)] p-2 rounded font-mono">
              Buy ATM / Sell OTM
            </p>
          </div>
          <div className="card p-4">
            <h4 className="font-semibold mb-2">Butterflies</h4>
            <p className="text-sm text-[var(--text-secondary)] mb-2">
              Pinning play, mean reversion
            </p>
            <p className="text-xs bg-[var(--surface)] p-2 rounded font-mono">
              Buy 1 / Sell 2 / Buy 1
            </p>
          </div>
          <div className="card p-4">
            <h4 className="font-semibold mb-2">Iron Condors</h4>
            <p className="text-sm text-[var(--text-secondary)] mb-2">
              Range-bound, premium collection
            </p>
            <p className="text-xs bg-[var(--surface)] p-2 rounded font-mono">
              Put spread + Call spread
            </p>
          </div>
        </div>
        <div className="card p-4 mt-4 bg-red-500/10 border border-red-500/30">
          <h4 className="font-semibold text-red-400 mb-2 flex items-center gap-2">
            <AlertOctagon className="w-4 h-4" />
            PROHIBITED Structures
          </h4>
          <ul className="text-sm space-y-1">
            <li>❌ Naked options (undefined risk)</li>
            <li>❌ Far OTM lottos</li>
            <li>❌ Single-leg directional bets</li>
          </ul>
        </div>
      </section>

      {/* Decision Tree */}
      <section>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          Decision Hierarchy
        </h2>
        <div className="card p-5">
          <div className="space-y-3">
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="font-bold text-red-400">TIER 1: BINARY EVENTS (Highest Priority)</p>
              <p className="text-sm">FOMC/CPI/NFP within 5 days → <strong>ABSOLUTE BLOCK</strong></p>
            </div>
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="font-bold text-yellow-400">TIER 2: REGIME VALIDATION</p>
              <p className="text-sm">Is regime clear? If "choppy fakeout" → <strong>NO TRADE</strong></p>
            </div>
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="font-bold text-blue-400">TIER 3: FLOW CONFIRMATION</p>
              <p className="text-sm">Does flow confirm direction? If divergence → <strong>NO TRADE</strong></p>
            </div>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
              <p className="font-bold text-emerald-400">TIER 4: EXECUTE</p>
              <p className="text-sm">All tiers clear → Build defined-risk structure</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function GuidesPage() {
  const [activeTab, setActiveTab] = useState<GuideTab>('ipmcc');
  
  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <Link href="/" className="text-sm text-[var(--text-secondary)] hover:text-primary flex items-center gap-1 mb-2">
          <ArrowLeft className="w-4 h-4" />Dashboard
        </Link>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-primary" />
          Strategy Guides
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Complete reference for IPMCC and 0-DTE methodologies
        </p>
      </div>
      
      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--border)] mb-6 pb-2">
        <button
          onClick={() => setActiveTab('ipmcc')}
          className={`px-6 py-3 rounded-t-lg flex items-center gap-2 font-medium transition-colors ${
            activeTab === 'ipmcc' 
              ? 'bg-primary text-white' 
              : 'hover:bg-[var(--surface)]'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          Long Term Strategies
          <span className="text-xs opacity-75">(IPMCC/112/Strangle)</span>
        </button>
        <button
          onClick={() => setActiveTab('0dte')}
          className={`px-6 py-3 rounded-t-lg flex items-center gap-2 font-medium transition-colors ${
            activeTab === '0dte' 
              ? 'bg-red-500 text-white' 
              : 'hover:bg-[var(--surface)]'
          }`}
        >
          <Timer className="w-4 h-4" />
          0-DTE (The Desk)
        </button>
      </div>
      
      {/* Content */}
      {activeTab === 'ipmcc' && <IPMCCGuide />}
      {activeTab === '0dte' && <ZeroDTEGuide />}
    </div>
  );
}
