'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Zap,
  Target,
  Shield,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  Clock,
  BarChart3,
  Flame,
  Snowflake,
  Users,
  Building2,
  Brain,
  CheckCircle,
  XCircle,
  Lightbulb,
  GraduationCap,
  AlertCircle
} from 'lucide-react';

interface Section {
  id: string;
  title: string;
  icon: React.ElementType;
  color: string;
}

const sections: Section[] = [
  { id: 'philosophy', title: 'The Institutional Edge', icon: Building2, color: 'text-blue-500' },
  { id: 'mechanics', title: 'Dealer Mechanics & GEX', icon: Activity, color: 'text-purple-500' },
  { id: 'strategy', title: 'The Dealer Pin Strategy', icon: Target, color: 'text-emerald-500' },
  { id: 'execution', title: 'Execution Framework', icon: Zap, color: 'text-yellow-500' },
  { id: 'risk', title: 'Kill Switch Protocol', icon: Shield, color: 'text-red-500' },
  { id: 'data', title: 'Professional Data Stack', icon: BarChart3, color: 'text-cyan-500' },
];

function SectionContent({ sectionId }: { sectionId: string }) {
  switch (sectionId) {
    case 'philosophy':
      return <PhilosophySection />;
    case 'mechanics':
      return <MechanicsSection />;
    case 'strategy':
      return <StrategySection />;
    case 'execution':
      return <ExecutionSection />;
    case 'risk':
      return <RiskSection />;
    case 'data':
      return <DataSection />;
    default:
      return null;
  }
}

function PhilosophySection() {
  return (
    <div className="space-y-6">
      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <h3 className="text-lg font-bold text-blue-500 mb-2 flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          The "House" vs. The Gambler
        </h3>
        <p className="text-[var(--text-secondary)] leading-relaxed">
          Retail traders look at charts and see "patterns." Institutional desks look at the market and see 
          <strong className="text-[var(--text-primary)]"> inventory</strong>. The edge is not predicting where price 
          <em> wants</em> to go - it is predicting where Dealers <em>must force</em> price to go to balance their books.
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-semibold text-lg">The Fundamental Truth</h4>
        <p className="text-[var(--text-secondary)] leading-relaxed">
          Market Makers (Dealers) are contractually obligated to provide liquidity. When you buy a Call option, 
          they must sell it to you. This makes them "Short Volatility" and "Short Gamma."
        </p>
        <p className="text-[var(--text-secondary)] leading-relaxed">
          To avoid bankruptcy, Dealers must hedge immediately by buying or selling the underlying (SPX/ES futures). 
          This hedging activity is predictable and mechanical - it follows mathematical rules, not opinions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
          <h5 className="font-semibold text-emerald-500 mb-2 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Institutional Approach
          </h5>
          <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
            <li>- Bet on dealer hedging mechanics</li>
            <li>- Use flow-based data (GEX, HIRO)</li>
            <li>- Trade market structure, not patterns</li>
            <li>- Defined risk with spreads</li>
            <li>- Exit based on rules, not emotions</li>
          </ul>
        </div>
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <h5 className="font-semibold text-red-500 mb-2 flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            Retail Approach (Avoid)
          </h5>
          <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
            <li>- Bet on price direction</li>
            <li>- Use lagging indicators (RSI, MACD)</li>
            <li>- Trade chart patterns</li>
            <li>- Naked options or undefined risk</li>
            <li>- Hold to expiration for max profit</li>
          </ul>
        </div>
      </div>

      <div className="p-4 bg-[var(--surface)] rounded-lg">
        <h5 className="font-semibold mb-2 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-yellow-500" />
          Key Insight
        </h5>
        <p className="text-[var(--text-secondary)]">
          You are not predicting the market. You are <strong className="text-primary">betting on the mechanics of market participants</strong>. 
          When Dealers must hedge, their actions are predictable. Your job is to position yourself to profit from these 
          mechanical flows.
        </p>
      </div>
    </div>
  );
}

function MechanicsSection() {
  return (
    <div className="space-y-6">
      <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
        <h3 className="text-lg font-bold text-purple-500 mb-2 flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Understanding Gamma Exposure (GEX)
        </h3>
        <p className="text-[var(--text-secondary)] leading-relaxed">
          GEX measures the total gamma exposure of Market Makers. It tells us whether dealers need to 
          <strong className="text-[var(--text-primary)]"> suppress</strong> or 
          <strong className="text-[var(--text-primary)]"> amplify</strong> price movements.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Positive Gamma */}
        <div className="p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
          <div className="flex items-center gap-3 mb-4">
            <Snowflake className="w-8 h-8 text-emerald-500" />
            <div>
              <h4 className="font-bold text-emerald-500">Positive Gamma</h4>
              <p className="text-xs text-[var(--text-secondary)]">Dealers are LONG gamma</p>
            </div>
          </div>
          
          <div className="space-y-3 text-sm">
            <p className="text-[var(--text-secondary)]">
              Dealers profit from volatility and trade <strong>against</strong> price moves:
            </p>
            <div className="p-3 bg-[var(--bg-elevated)] rounded">
              <p className="text-emerald-400">If Market Rallies: Dealers SELL futures</p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">Suppresses the rally</p>
            </div>
            <div className="p-3 bg-[var(--bg-elevated)] rounded">
              <p className="text-emerald-400">If Market Drops: Dealers BUY futures</p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">Suppresses the drop</p>
            </div>
            <p className="font-medium text-emerald-400 mt-4">
              Result: Low volatility, price "pins" to high-GEX strike
            </p>
          </div>
        </div>

        {/* Negative Gamma */}
        <div className="p-5 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="flex items-center gap-3 mb-4">
            <Flame className="w-8 h-8 text-red-500" />
            <div>
              <h4 className="font-bold text-red-500">Negative Gamma</h4>
              <p className="text-xs text-[var(--text-secondary)]">Dealers are SHORT gamma</p>
            </div>
          </div>
          
          <div className="space-y-3 text-sm">
            <p className="text-[var(--text-secondary)]">
              Dealers lose from volatility and must <strong>chase</strong> price moves:
            </p>
            <div className="p-3 bg-[var(--bg-elevated)] rounded">
              <p className="text-red-400">If Market Rallies: Dealers must BUY futures</p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">Amplifies the rally</p>
            </div>
            <div className="p-3 bg-[var(--bg-elevated)] rounded">
              <p className="text-red-400">If Market Drops: Dealers must SELL futures</p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">Amplifies the drop</p>
            </div>
            <p className="font-medium text-red-400 mt-4">
              Result: High volatility, expanded range, trend days
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 bg-[var(--surface)] rounded-lg">
        <h4 className="font-semibold mb-3">Key GEX Levels</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-2 bg-emerald-500/10 rounded">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <div>
              <span className="font-medium text-emerald-500">Call Wall</span>
              <span className="text-sm text-[var(--text-secondary)] ml-2">Strike with highest positive GEX - acts as resistance</span>
            </div>
          </div>
          <div className="flex items-center gap-3 p-2 bg-red-500/10 rounded">
            <TrendingDown className="w-4 h-4 text-red-500" />
            <div>
              <span className="font-medium text-red-500">Put Wall</span>
              <span className="text-sm text-[var(--text-secondary)] ml-2">Strike with highest negative GEX - acts as support</span>
            </div>
          </div>
          <div className="flex items-center gap-3 p-2 bg-yellow-500/10 rounded">
            <Activity className="w-4 h-4 text-yellow-500" />
            <div>
              <span className="font-medium text-yellow-500">Gamma Flip</span>
              <span className="text-sm text-[var(--text-secondary)] ml-2">Level where GEX switches from positive to negative - pivot point</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
        <h5 className="font-semibold text-yellow-500 mb-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          The Greeks That Matter for 0-DTE
        </h5>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3 text-sm">
          <div>
            <p className="font-medium">Gamma</p>
            <p className="text-[var(--text-secondary)]">Rate of delta change. Explodes near expiration.</p>
          </div>
          <div>
            <p className="font-medium">Charm (Delta Decay)</p>
            <p className="text-[var(--text-secondary)]">Delta decay over time. Accelerates into close.</p>
          </div>
          <div>
            <p className="font-medium">Vanna</p>
            <p className="text-[var(--text-secondary)]">Sensitivity to IV changes. VIX spikes impact delta.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StrategySection() {
  return (
    <div className="space-y-6">
      <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
        <h3 className="text-lg font-bold text-emerald-500 mb-2 flex items-center gap-2">
          <Target className="w-5 h-5" />
          The "Dealer Pin" Arbitrage
        </h3>
        <p className="text-[var(--text-secondary)] leading-relaxed">
          Capture premium decay (Theta) by shorting volatility when Dealer Gamma is highly positive, 
          forcing the market to "stick" to a specific price level.
        </p>
      </div>

      <div className="p-5 bg-[var(--surface)] rounded-lg">
        <h4 className="font-semibold mb-4">Strategy Structure: Iron Condor</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <h5 className="font-medium text-red-500 mb-2">Bear Call Spread (Upside)</h5>
            <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
              <li><span className="text-red-400">SELL</span> Call at Call Wall (resistance)</li>
              <li><span className="text-emerald-400">BUY</span> Call 10pts higher (protection)</li>
            </ul>
          </div>
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
            <h5 className="font-medium text-emerald-500 mb-2">Bull Put Spread (Downside)</h5>
            <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
              <li><span className="text-red-400">SELL</span> Put at Put Wall (support)</li>
              <li><span className="text-emerald-400">BUY</span> Put 10pts lower (protection)</li>
            </ul>
          </div>
        </div>

        <div className="mt-4 p-3 bg-[var(--info)]/10 border border-[var(--info)]/30 rounded-lg">
          <p className="text-sm text-[var(--text-secondary)]">
            <strong className="text-[var(--info)]">Why this works:</strong> In positive gamma, dealers suppress volatility. 
            The market tends to PIN between the Put Wall and Call Wall. You collect premium while price stays in range.
          </p>
        </div>
      </div>

      <div className="p-5 bg-[var(--surface)] rounded-lg">
        <h4 className="font-semibold mb-4">Strike Selection Rules</h4>
        
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-[var(--bg-elevated)] rounded-lg">
            <span className="text-primary font-bold">1</span>
            <div>
              <p className="font-medium">Short Strikes at GEX Walls</p>
              <p className="text-sm text-[var(--text-secondary)]">
                Sell your calls at the Call Wall (resistance) and puts at the Put Wall (support). 
                These are structural levels where dealer hedging creates friction.
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3 p-3 bg-[var(--bg-elevated)] rounded-lg">
            <span className="text-primary font-bold">2</span>
            <div>
              <p className="font-medium">Target Delta 15-20</p>
              <p className="text-sm text-[var(--text-secondary)]">
                Short strikes should have approximately 15-20 delta. This gives roughly 80-85% probability of expiring OTM.
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3 p-3 bg-[var(--bg-elevated)] rounded-lg">
            <span className="text-primary font-bold">3</span>
            <div>
              <p className="font-medium">10-Point Wing Width</p>
              <p className="text-sm text-[var(--text-secondary)]">
                Buy protection 10 points beyond your short strikes. This defines your max loss and reduces margin requirements.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
        <h4 className="font-semibold text-red-500 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          When NOT to Trade This Strategy
        </h4>
        <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
          <li className="flex items-start gap-2">
            <XCircle className="w-4 h-4 text-red-500 mt-0.5" />
            <span><strong>Negative Gamma Days:</strong> Dealers amplify moves. Short premium gets destroyed.</span>
          </li>
          <li className="flex items-start gap-2">
            <XCircle className="w-4 h-4 text-red-500 mt-0.5" />
            <span><strong>FOMC/CPI Days:</strong> Binary events create unpredictable volatility spikes.</span>
          </li>
          <li className="flex items-start gap-2">
            <XCircle className="w-4 h-4 text-red-500 mt-0.5" />
            <span><strong>VIX above 25:</strong> Elevated fear means higher probability of large moves.</span>
          </li>
          <li className="flex items-start gap-2">
            <XCircle className="w-4 h-4 text-red-500 mt-0.5" />
            <span><strong>VIX1D in Backwardation:</strong> Short-term fear elevated vs. longer-term.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

function ExecutionSection() {
  return (
    <div className="space-y-6">
      <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
        <h3 className="text-lg font-bold text-yellow-500 mb-2 flex items-center gap-2">
          <Zap className="w-5 h-5" />
          Execution Framework
        </h3>
        <p className="text-[var(--text-secondary)] leading-relaxed">
          Strict mechanical rules eliminate emotion. Every entry, exit, and adjustment is predetermined.
        </p>
      </div>

      <div className="p-5 bg-[var(--surface)] rounded-lg">
        <h4 className="font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Trading Windows (EST)
        </h4>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              <span className="font-medium">Pre-Market Analysis</span>
            </div>
            <span className="text-sm text-[var(--text-secondary)]">8:00 AM - 9:30 AM</span>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-purple-500/10 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full" />
              <span className="font-medium">Opening Range (AVOID)</span>
            </div>
            <span className="text-sm text-[var(--text-secondary)]">9:30 AM - 9:45 AM</span>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-emerald-500/20 border border-emerald-500/50 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
              <span className="font-bold text-emerald-500">OPTIMAL ENTRY WINDOW</span>
            </div>
            <span className="text-sm font-medium text-emerald-400">9:45 AM - 10:15 AM</span>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-[var(--bg-elevated)] rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-gray-500 rounded-full" />
              <span className="font-medium">Mid-Day Management</span>
            </div>
            <span className="text-sm text-[var(--text-secondary)]">10:15 AM - 2:00 PM</span>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-orange-500/10 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-orange-500 rounded-full" />
              <span className="font-medium">Power Hour (Caution)</span>
            </div>
            <span className="text-sm text-[var(--text-secondary)]">2:00 PM - 3:00 PM</span>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="font-bold text-red-500">GAMMA DANGER ZONE</span>
            </div>
            <span className="text-sm font-medium text-red-400">3:00 PM - 4:00 PM</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
          <h4 className="font-semibold text-emerald-500 mb-3 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Entry Criteria
          </h4>
          <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 font-bold">1.</span>
              <span>Net GEX is positive (above +$3B on SPX)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 font-bold">2.</span>
              <span>VIX1D lower than VIX (contango)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 font-bold">3.</span>
              <span>SPX trading between Put Wall and Call Wall</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 font-bold">4.</span>
              <span>Time is 9:45 AM - 10:15 AM EST</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 font-bold">5.</span>
              <span>No major economic events today</span>
            </li>
          </ul>
        </div>

        <div className="p-5 bg-red-500/10 border border-red-500/30 rounded-lg">
          <h4 className="font-semibold text-red-500 mb-3 flex items-center gap-2">
            <XCircle className="w-5 h-5" />
            Exit Rules
          </h4>
          <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
            <li className="flex items-start gap-2">
              <span className="text-red-500 font-bold">1.</span>
              <span><strong>Profit Target:</strong> Close at 30-40% of premium</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 font-bold">2.</span>
              <span><strong>Stop Loss:</strong> Close if loss reaches 2x credit received</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 font-bold">3.</span>
              <span><strong>Time Stop:</strong> MUST exit before 3:50 PM EST</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 font-bold">4.</span>
              <span><strong>Breach:</strong> If short strike is touched, close tested side</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="p-4 bg-[var(--surface)] rounded-lg">
        <h4 className="font-semibold mb-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-yellow-500" />
          Critical Rules
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="p-3 bg-red-500/10 rounded-lg">
            <p className="font-medium text-red-400 mb-1">NEVER hold to expiration</p>
            <p className="text-[var(--text-secondary)]">Gamma explosion in last 30 minutes can wipe you out</p>
          </div>
          <div className="p-3 bg-red-500/10 rounded-lg">
            <p className="font-medium text-red-400 mb-1">NEVER chase 100% profit</p>
            <p className="text-[var(--text-secondary)]">Take 30-40% and repeat tomorrow</p>
          </div>
          <div className="p-3 bg-red-500/10 rounded-lg">
            <p className="font-medium text-red-400 mb-1">NEVER trade negative gamma days</p>
            <p className="text-[var(--text-secondary)]">Dealers amplify moves, destroying short premium</p>
          </div>
          <div className="p-3 bg-red-500/10 rounded-lg">
            <p className="font-medium text-red-400 mb-1">NEVER risk more than 5% per trade</p>
            <p className="text-[var(--text-secondary)]">Position sizing is your first line of defense</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function RiskSection() {
  return (
    <div className="space-y-6">
      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
        <h3 className="text-lg font-bold text-red-500 mb-2 flex items-center gap-2">
          <Shield className="w-5 h-5" />
          The Kill Switch Protocol
        </h3>
        <p className="text-[var(--text-secondary)] leading-relaxed">
          The Kill Switch is your emergency exit protocol. When triggered, close ALL short volatility positions immediately. 
          No questions, no hesitation, no hoping it comes back.
        </p>
      </div>

      <div className="p-5 bg-[var(--surface)] rounded-lg">
        <h4 className="font-semibold mb-4 text-red-500">Kill Switch Triggers</h4>
        
        <div className="space-y-3">
          <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span className="font-bold text-red-400">VIX1D Spike above 10%</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              If VIX1D spikes more than 10% intraday, something is breaking. Close immediately regardless of P&L.
            </p>
          </div>

          <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <Flame className="w-5 h-5 text-red-500" />
              <span className="font-bold text-red-400">Gamma Flip Occurs</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              If dealers flip from positive to negative gamma mid-day, the suppression dynamic reverses to amplification.
            </p>
          </div>

          <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <Target className="w-5 h-5 text-red-500" />
              <span className="font-bold text-red-400">Short Strike Breached</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              If SPX trades through your short strike, close that side immediately. Do not wait for recovery.
            </p>
          </div>

          <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-red-500" />
              <span className="font-bold text-red-400">Time Past 3:50 PM</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              If you are still holding at 3:50 PM, close regardless of P&L. The last 10 minutes are lethal.
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 bg-[var(--surface)] rounded-lg">
        <h4 className="font-semibold mb-4">Why Retail Traders Fail</h4>
        
        <div className="space-y-3">
          <div className="p-3 bg-[var(--bg-elevated)] rounded-lg">
            <p className="font-medium text-red-400 mb-1">Greed: Holding for 100% profit</p>
            <p className="text-sm text-[var(--text-secondary)]">
              They hold until 3:55 PM trying to squeeze every penny. The gamma explosion in the last 10 minutes 
              often wipes them out. Take 35% and live to trade another day.
            </p>
          </div>
          
          <div className="p-3 bg-[var(--bg-elevated)] rounded-lg">
            <p className="font-medium text-red-400 mb-1">Blindness: Trading wrong regime</p>
            <p className="text-sm text-[var(--text-secondary)]">
              They run this strategy on Trend Days (Negative Gamma) when the market is designed to run in one direction. 
              You ONLY trade this in Positive Gamma regimes.
            </p>
          </div>
          
          <div className="p-3 bg-[var(--bg-elevated)] rounded-lg">
            <p className="font-medium text-red-400 mb-1">Ego: Refusing to take stops</p>
            <p className="text-sm text-[var(--text-secondary)]">
              When the trade goes against them, they average down or wait for recovery. The professional takes the stop 
              and moves on. Losses are tuition, not failure.
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
        <h4 className="font-semibold text-yellow-500 mb-2 flex items-center gap-2">
          <Lightbulb className="w-4 h-4" />
          The 3-Sigma Rule
        </h4>
        <p className="text-[var(--text-secondary)] text-sm">
          Every strategy must survive a 3-sigma move (e.g., Flash Crash, circuit breaker day). 
          With defined-risk spreads, your max loss is known. But ask yourself: 
          <strong className="text-[var(--text-primary)]"> can my account survive my max loss?</strong> 
          If not, reduce position size until it can.
        </p>
      </div>
    </div>
  );
}

function DataSection() {
  return (
    <div className="space-y-6">
      <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
        <h3 className="text-lg font-bold text-cyan-500 mb-2 flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Professional Data Stack
        </h3>
        <p className="text-[var(--text-secondary)] leading-relaxed">
          You cannot trade this strategy with a naked chart. Professionals use flow-based, structural data 
          that reveals dealer positioning and hedging activity.
        </p>
      </div>

      <div className="p-5 bg-[var(--surface)] rounded-lg">
        <h4 className="font-semibold mb-4">Required Data Points</h4>
        
        <div className="space-y-3">
          <div className="p-4 bg-[var(--bg-elevated)] rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-primary">Net GEX (Gamma Exposure)</span>
              <span className="text-xs bg-emerald-500/20 text-emerald-500 px-2 py-1 rounded">CRITICAL</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              Must be highly positive (greater than +$3B on SPX). Determines if dealers suppress or amplify volatility.
            </p>
          </div>

          <div className="p-4 bg-[var(--bg-elevated)] rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-primary">VIX1D vs VIX</span>
              <span className="text-xs bg-emerald-500/20 text-emerald-500 px-2 py-1 rounded">CRITICAL</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              VIX1D must be lower than VIX (contango). This signals short-term calm and is favorable for selling premium.
            </p>
          </div>

          <div className="p-4 bg-[var(--bg-elevated)] rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-primary">GEX Walls (Call/Put)</span>
              <span className="text-xs bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded">IMPORTANT</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              Strike prices with the largest positive (Call) and negative (Put) GEX. These are structural support/resistance.
            </p>
          </div>

          <div className="p-4 bg-[var(--bg-elevated)] rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-primary">Gamma Flip Level</span>
              <span className="text-xs bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded">IMPORTANT</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              Price level where net gamma switches from positive to negative. Key pivot point for the day.
            </p>
          </div>

          <div className="p-4 bg-[var(--bg-elevated)] rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-primary">HIRO (Hedging Impact)</span>
              <span className="text-xs bg-blue-500/20 text-blue-500 px-2 py-1 rounded">ADVANCED</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              Real-time measurement of dealer hedging activity. Shows if dealers are buying or selling to hedge.
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 bg-[var(--surface)] rounded-lg">
        <h4 className="font-semibold mb-4">Data Sources</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a 
            href="https://www.spotgamma.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="p-4 bg-[var(--bg-elevated)] rounded-lg hover:bg-[var(--border)] transition-colors"
          >
            <h5 className="font-medium text-primary mb-1">SpotGamma</h5>
            <p className="text-sm text-[var(--text-secondary)]">
              Industry standard for GEX data. Daily levels, real-time updates, HIRO indicator.
            </p>
          </a>
          
          <a 
            href="https://menthorq.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="p-4 bg-[var(--bg-elevated)] rounded-lg hover:bg-[var(--border)] transition-colors"
          >
            <h5 className="font-medium text-primary mb-1">MenthorQ</h5>
            <p className="text-sm text-[var(--text-secondary)]">
              Excellent GEX visualization, option flow data, dark pool prints.
            </p>
          </a>
          
          <a 
            href="https://tradytics.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="p-4 bg-[var(--bg-elevated)] rounded-lg hover:bg-[var(--border)] transition-colors"
          >
            <h5 className="font-medium text-primary mb-1">Tradytics</h5>
            <p className="text-sm text-[var(--text-secondary)]">
              AI-powered options flow analysis, net premium, smart money tracking.
            </p>
          </a>
          
          <a 
            href="https://unusualwhales.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="p-4 bg-[var(--bg-elevated)] rounded-lg hover:bg-[var(--border)] transition-colors"
          >
            <h5 className="font-medium text-primary mb-1">Unusual Whales</h5>
            <p className="text-sm text-[var(--text-secondary)]">
              Option flow alerts, unusual activity, congressional trading.
            </p>
          </a>
        </div>
      </div>

      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
        <h4 className="font-semibold text-red-500 mb-3 flex items-center gap-2">
          <XCircle className="w-4 h-4" />
          Retail Indicators to AVOID
        </h4>
        <p className="text-sm text-[var(--text-secondary)] mb-3">
          These are lagging indicators that tell you where price HAS been, not where it WILL go:
        </p>
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm">RSI</span>
          <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm">MACD</span>
          <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm">Bollinger Bands</span>
          <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm">Trendlines</span>
          <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm">Moving Averages</span>
          <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm">Fibonacci</span>
        </div>
      </div>
    </div>
  );
}

export default function ZeroDTEGuide() {
  const [activeSection, setActiveSection] = useState('philosophy');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['philosophy']));

  const toggleSection = (sectionId: string) => {
    setActiveSection(sectionId);
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <Link href="/zero-dte" className="text-sm text-[var(--text-secondary)] hover:text-primary flex items-center gap-1 mb-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <GraduationCap className="w-6 h-6 text-emerald-500" />
          0-DTE Institutional Trading Guide
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Learn how professional desks extract alpha from dealer hedging mechanics
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation */}
        <div className="lg:col-span-1">
          <div className="card p-4 sticky top-6">
            <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Contents</h3>
            <nav className="space-y-1">
              {sections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => toggleSection(section.id)}
                    className={`w-full flex items-center gap-2 p-2 rounded-lg text-left text-sm transition-colors ${
                      isActive 
                        ? 'bg-primary/20 text-primary' 
                        : 'hover:bg-[var(--surface)] text-[var(--text-secondary)]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : section.color}`} />
                    <span className="flex-1">{section.title}</span>
                    {expandedSections.has(section.id) ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <div className="card p-6">
            {sections.map((section) => {
              const Icon = section.icon;
              const isExpanded = expandedSections.has(section.id);
              return (
                <div key={section.id} className={section.id !== 'philosophy' ? 'mt-8 pt-8 border-t border-[var(--border)]' : ''}>
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between mb-4"
                  >
                    <h2 className={`text-xl font-bold flex items-center gap-2 ${section.color}`}>
                      <Icon className="w-6 h-6" />
                      {section.title}
                    </h2>
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-[var(--text-secondary)]" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-[var(--text-secondary)]" />
                    )}
                  </button>
                  
                  {isExpanded && <SectionContent sectionId={section.id} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
