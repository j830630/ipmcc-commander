'use client';

import Link from 'next/link';
import {
  ArrowLeft, BookOpen, Target, Shield, AlertTriangle, CheckCircle,
  Clock, DollarSign, Activity, BarChart3, Percent, Award
} from 'lucide-react';

// ============================================================================
// MAIN PAGE - LONG TERM STRATEGIES GUIDE
// ============================================================================

export default function GuidesPage() {
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
          Complete reference for IPMCC, 112 Trade, and Strangle strategies
        </p>
      </div>
      
      {/* Content */}
      <div className="space-y-8 max-w-4xl">
        {/* Introduction */}
        <section>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            What is IPMCC?
          </h2>
          <div className="card p-5">
            <p className="mb-3">
              <strong>IPMCC (Income Poor Man&apos;s Covered Call)</strong> is a systematic approach 
              to generating consistent premium income using LEAP calls as a stock replacement,
              while selling shorter-dated calls against them.
            </p>
            <p className="text-[var(--text-secondary)]">
              The strategy involves buying deep ITM LEAP calls (0.80+ delta) and selling out-of-the-money 
              calls against them to collect premium, while using macro context and IV analysis to time entries optimally.
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
                LEAP: 0.80+ delta (deep ITM). Short calls: 0.20-0.30 delta (5-10% OTM).
              </p>
            </div>
            <div className="card p-4 border-l-4 border-purple-500">
              <h4 className="font-semibold mb-2">3. DTE Selection</h4>
              <p className="text-sm text-[var(--text-secondary)]">
                LEAP: 12+ months DTE. Short calls: 30-45 DTE for optimal theta decay. Roll at 21 DTE or 50% profit.
              </p>
            </div>
            <div className="card p-4 border-l-4 border-orange-500">
              <h4 className="font-semibold mb-2">4. Earnings Avoidance</h4>
              <p className="text-sm text-[var(--text-secondary)]">
                Never hold short calls through earnings. Close or roll to post-earnings expiration at least 1 week before.
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
                'No earnings within 2 weeks of short call expiration',
                'Stock above 200 EMA (bullish trend)',
                'Sector relative strength ≥ 0.9 (not underperforming)',
                'VIX regime not "extreme" (< 30)',
                'FOMC/CPI not within 5 days',
                'LEAP delta ≥ 0.80',
                'Short call delta 0.20-0.30, DTE 30-45',
                'Income velocity target: 1-2% weekly'
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
              It&apos;s a directional play with an embedded credit spread.
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
              <li>30-45 DTE optimal</li>
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
              <li>45 DTE optimal for theta/gamma balance</li>
            </ul>
          </div>
        </section>

        {/* Income Velocity */}
        <section>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Percent className="w-5 h-5 text-blue-500" />
            Income Velocity Targets
          </h2>
          <div className="card p-5">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-emerald-500/10 rounded-lg">
                <p className="text-2xl font-bold text-emerald-500">1-2%</p>
                <p className="text-sm text-[var(--text-secondary)]">Weekly Target</p>
              </div>
              <div className="text-center p-4 bg-blue-500/10 rounded-lg">
                <p className="text-2xl font-bold text-blue-500">4-8%</p>
                <p className="text-sm text-[var(--text-secondary)]">Monthly Target</p>
              </div>
              <div className="text-center p-4 bg-purple-500/10 rounded-lg">
                <p className="text-2xl font-bold text-purple-500">50-100%</p>
                <p className="text-sm text-[var(--text-secondary)]">Annual Target</p>
              </div>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mt-4">
              Income velocity = (Short call premium / LEAP cost) × (365 / DTE). 
              Target setups that achieve 1-2% weekly velocity consistently.
            </p>
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
                  <li>• Total portfolio risk: &lt;25% in options</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Exit Rules</h4>
                <ul className="text-sm text-[var(--text-secondary)] space-y-1">
                  <li>• Take profit at 50% of max gain</li>
                  <li>• Roll at 21 DTE if profitable</li>
                  <li>• Cut loss at 200% of credit received</li>
                  <li>• Never hold through earnings</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Roll Guidelines */}
        <section>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            Roll Guidelines
          </h2>
          <div className="card p-5">
            <div className="space-y-4">
              <div className="p-3 bg-emerald-500/10 rounded-lg">
                <h4 className="font-semibold text-emerald-500">Roll for Credit</h4>
                <p className="text-sm text-[var(--text-secondary)]">
                  When rolling, always collect additional credit. If you can&apos;t roll for credit, consider closing instead.
                </p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <h4 className="font-semibold text-blue-500">Roll Timing</h4>
                <p className="text-sm text-[var(--text-secondary)]">
                  Roll at 21 DTE or when 50% profit achieved. Don&apos;t wait until expiration week.
                </p>
              </div>
              <div className="p-3 bg-yellow-500/10 rounded-lg">
                <h4 className="font-semibold text-yellow-500">Roll Direction</h4>
                <p className="text-sm text-[var(--text-secondary)]">
                  Roll out (time), up (if bullish), or down (if bearish). Roll out and up is ideal for IPMCC.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Scanner Integration */}
        <section>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" />
            Using the Scanner
          </h2>
          <div className="card p-5">
            <p className="mb-4">
              The Long Term Scanner automatically validates all entry criteria and scores opportunities.
            </p>
            <div className="bg-primary/10 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Scanner Scores:</h4>
              <ul className="text-sm space-y-1">
                <li className="text-emerald-500">• <strong>70+:</strong> Strong setup - high confidence entry</li>
                <li className="text-blue-500">• <strong>50-69:</strong> Moderate setup - review rules carefully</li>
                <li className="text-yellow-500">• <strong>30-49:</strong> Weak setup - missing key criteria</li>
                <li className="text-red-500">• <strong>&lt;30:</strong> Avoid - fails too many checks</li>
              </ul>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mt-4">
              Click on any scanner result to see detailed rule validation and specific trade setup recommendations.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
