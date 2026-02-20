'use client';

import Link from 'next/link';
import { ArrowLeft, Clock, Zap, CheckCircle, Star, AlertTriangle, Wrench } from 'lucide-react';

interface ChangelogEntry {
  version: string;
  date: string;
  type: 'major' | 'minor' | 'patch';
  highlights: string[];
  changes: {
    category: 'added' | 'changed' | 'fixed' | 'removed';
    items: string[];
  }[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: '3.0.0',
    date: '2026-02-18',
    type: 'major',
    highlights: [
      'Long Term Scanner optimized (120 → 80 tickers)',
      'Minimum score filter to remove weak setups',
      'Enhanced detail modal with live trade setups'
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Min Score filter (default 50) - filters out low-quality trade setups during scan',
          'Enhanced Detail Modal fetches live data from /api/v1/scanner/enhanced/single/{strategy}/{symbol}',
          'Rule validation panel showing pass/fail for each strategy check with point weights',
          'Live metrics display: Score, Current IV %, RSI, Data Source indicator',
          'IPMCC setup details: LEAP strike/delta/DTE, Short Call strike/extrinsic, Income Velocity %',
          '112/Strangle setup details: Complete leg structure with strikes and deltas',
          'Quick Trade button pre-fills position form with recommended strikes from scanner'
        ]
      },
      {
        category: 'changed',
        items: [
          'Ticker universe reduced from 120 to 80 for ~33% faster scans',
          'Mega caps: 50 → 30 (top by options liquidity)',
          'Large caps: 50 → 30 (high-growth with good options volume)',
          'ETFs: 20 unchanged',
          'Results stats now show "Results (≥50)" indicating min score filter',
          'Scan button shows both ticker count and min score threshold'
        ]
      },
      {
        category: 'fixed',
        items: [
          'Scanner no longer returns excessive low-quality results',
          'Detail modal now shows meaningful trade data instead of just basic metrics'
        ]
      }
    ]
  },
  {
    version: '2.9.3',
    date: '2026-02-16',
    type: 'minor',
    highlights: [
      'Major UI consolidation and simplification',
      'Combined 0-DTE Command Center with Trade Scanner',
      'New Long Term Scanner with 120+ tickers',
      'Unified Positions & Trade Journal page'
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Long Term Scanner: Auto-scan 120+ tickers (50+ mega caps, 50+ large caps, 20+ ETFs)',
          'Dashboard: Market Sentiment panel now displayed first',
          'Trade Lab: Pull existing positions for analysis',
          'Trade Lab: Auto-populate options chain with strikes, expirations, and premiums',
          'Strategy Guides: Combined IPMCC and 0-DTE guides with tabs',
          'Clear separation between Long Term (IPMCC/112/Strangle) and 0-DTE sections'
        ]
      },
      {
        category: 'changed',
        items: [
          '0-DTE Command Center: Now combines Scanner + Self-Audit + Simulator + Journal in tabs',
          'Positions page: Now includes Trade Journal with History and Analytics views',
          'Dashboard: Strategy Command Center reorganized with clear Long Term vs 0-DTE sections',
          'Scanner: Renamed to "Long Term Scanner" - focuses only on swing strategies',
          'Simplified navigation with fewer but more comprehensive pages'
        ]
      },
      {
        category: 'fixed',
        items: [
          'Removed duplicate functionality between Scanner and 0-DTE pages',
          'Trade Journal now unified (previously split between Command Center localStorage and DB)',
          'Strategy tagging on trades now includes both category (swing/0dte) and specific strategy'
        ]
      }
    ]
  },
  {
    version: '2.9.2',
    date: '2026-02-16',
    type: 'minor',
    highlights: [
      'Multi-Horizon Macro Validation implemented',
      'Decision hierarchy for trade signals',
      'Event horizon tracking with FOMC/CPI/NFP'
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Macro Analysis Engine with decision hierarchy',
          'TIER 1: Binary event detection (FOMC/CPI within 5 days = absolute block)',
          'TIER 2: Macro trend validation (VIX regime, sector rotation)',
          'TIER 3: Technical confirmation with macro adjustment',
          'Event Horizon Service for 0-DTE event checking',
          'Position Event Service for earnings vs expiration checking',
          'Sector relative strength analysis for individual stocks'
        ]
      },
      {
        category: 'fixed',
        items: [
          'AsyncSession errors in trades_router.py and analytics_router.py',
          'Converted SQLAlchemy 1.x syntax to async 2.0 syntax',
          'CacheService import errors - added singleton instance',
          'Added @cached decorator and cache_cleanup_task exports'
        ]
      }
    ]
  },
  {
    version: '2.9.1',
    date: '2026-02-15',
    type: 'patch',
    highlights: [
      'Backend infrastructure improvements',
      'Async SQLAlchemy migration'
    ],
    changes: [
      {
        category: 'changed',
        items: [
          'Migrated database operations to async SQLAlchemy 2.0',
          'Updated all router endpoints for async/await pattern',
          'Improved error handling in API endpoints'
        ]
      },
      {
        category: 'fixed',
        items: [
          'Database session management issues',
          'Query timeout problems with large datasets'
        ]
      }
    ]
  },
  {
    version: '2.9.0',
    date: '2026-02-14',
    type: 'major',
    highlights: [
      'The Desk Methodology fully implemented',
      'Self-Audit system with 25 rules',
      'Regime Simulator for testing',
      'Fakeout detection engine'
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Complete Desk methodology implementation',
          'Market regime detection (trend day, mean reversion, volatility breakout, choppy, gamma squeeze)',
          'Fakeout detection for bull/bear traps',
          'Self-Audit checklist with 25 rules across 6 categories',
          'Regime Simulator with 5 preset scenarios',
          'Trade Journal for 0-DTE trades',
          'GEX level analysis integration',
          'Flow confirmation requirements'
        ]
      },
      {
        category: 'changed',
        items: [
          'Analysis engine now requires flow confirmation',
          'Added structural thesis to trade recommendations',
          'Enhanced confidence scoring with fakeout risk adjustment'
        ]
      }
    ]
  },
  {
    version: '2.8.0',
    date: '2026-02-10',
    type: 'major',
    highlights: [
      'Trade Scanner with auto-analysis',
      'IV Rank integration',
      'Earnings calendar integration'
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Trade Scanner for IPMCC/112/Strangle opportunities',
          'Automatic IV Rank fetching',
          'Earnings date checking to avoid positions through earnings',
          'Strategy-specific scoring algorithms',
          'Signal classification (Strong Buy → Strong Avoid)'
        ]
      }
    ]
  },
  {
    version: '2.7.0',
    date: '2026-02-05',
    type: 'major',
    highlights: [
      'Schwab API integration',
      'Real-time market data',
      'Position tracking'
    ],
    changes: [
      {
        category: 'added',
        items: [
          'Schwab API authentication and token management',
          'Real-time quote fetching',
          'Options chain data retrieval',
          'Position sync from brokerage',
          'Trade execution preparation (review mode)'
        ]
      }
    ]
  }
];

export default function ChangelogPage() {
  const categoryColors = {
    added: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', icon: CheckCircle },
    changed: { bg: 'bg-blue-500/10', text: 'text-blue-500', icon: Zap },
    fixed: { bg: 'bg-yellow-500/10', text: 'text-yellow-500', icon: Wrench },
    removed: { bg: 'bg-red-500/10', text: 'text-red-500', icon: AlertTriangle }
  };
  
  const typeColors = {
    major: 'bg-purple-500',
    minor: 'bg-blue-500',
    patch: 'bg-gray-500'
  };
  
  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link href="/" className="text-sm text-[var(--text-secondary)] hover:text-primary flex items-center gap-1 mb-2">
          <ArrowLeft className="w-4 h-4" />Dashboard
        </Link>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Clock className="w-6 h-6 text-primary" />
          Changelog
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          IPMCC Commander version history and updates
        </p>
      </div>
      
      {/* Entries */}
      <div className="space-y-8">
        {CHANGELOG.map((entry, i) => (
          <div key={entry.version} className="card overflow-hidden">
            {/* Header */}
            <div className={`${i === 0 ? 'bg-primary/10 border-b border-primary/30' : 'bg-[var(--surface)]'} px-6 py-4`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold">v{entry.version}</span>
                  <span className={`${typeColors[entry.type]} text-white text-xs px-2 py-0.5 rounded uppercase`}>
                    {entry.type}
                  </span>
                  {i === 0 && (
                    <span className="bg-emerald-500 text-white text-xs px-2 py-0.5 rounded flex items-center gap-1">
                      <Star className="w-3 h-3" />Latest
                    </span>
                  )}
                </div>
                <span className="text-sm text-[var(--text-secondary)]">{entry.date}</span>
              </div>
              
              {/* Highlights */}
              {entry.highlights.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {entry.highlights.map((h, j) => (
                    <li key={j} className="text-sm flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      {h}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            
            {/* Changes */}
            <div className="p-6 space-y-4">
              {entry.changes.map((change, j) => {
                const { bg, text, icon: Icon } = categoryColors[change.category];
                return (
                  <div key={j}>
                    <h4 className={`font-semibold mb-2 flex items-center gap-2 ${text}`}>
                      <Icon className="w-4 h-4" />
                      {change.category.charAt(0).toUpperCase() + change.category.slice(1)}
                    </h4>
                    <ul className={`${bg} rounded-lg p-4 space-y-2`}>
                      {change.items.map((item, k) => (
                        <li key={k} className="text-sm flex items-start gap-2">
                          <span className={`${text} mt-1`}>•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
