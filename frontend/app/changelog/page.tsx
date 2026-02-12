'use client';

import { useState, useEffect } from 'react';
import { 
  FileText, 
  Calendar, 
  CheckCircle, 
  Star,
  Tag,
  RefreshCw
} from 'lucide-react';

interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export default function ChangelogPage() {
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChangelog = async () => {
      try {
        const response = await fetch('/api/v1/changelog');
        const data = await response.json();
        setChangelog(data.changelog || []);
      } catch (error) {
        console.error('Error fetching changelog:', error);
        // Fallback data
        setChangelog([
          {
            version: "2.0.0",
            date: "2026-02-08",
            changes: [
              "Added Market Sentiment Dashboard (Fear/Greed, VIX, Forex pairs)",
              "Added Economic Calendar with ForexFactory-style data",
              "Added Strategy Scanner for IPMCC, 112 Trade, Strangles",
              "Added TradingView chart integration with ticker selection",
              "Added Strategy Command Center on dashboard",
              "Integrated free data APIs (Yahoo Finance, Finnhub, CNN)"
            ]
          },
          {
            version: "1.1.0",
            date: "2026-02-07",
            changes: [
              "Fixed validation engine null reference errors",
              "Added manual price input to Trade Lab",
              "Fixed Next.js font compatibility issues",
              "Improved Greeks calculation with pure Python Black-Scholes"
            ]
          },
          {
            version: "1.0.0",
            date: "2026-02-06",
            changes: [
              "Initial release of IPMCC Commander",
              "Trade Lab for validating IPMCC setups",
              "Position tracking and journal",
              "Greeks engine with Black-Scholes calculations",
              "Market data integration via yfinance"
            ]
          }
        ]);
      }
      setLoading(false);
    };

    fetchChangelog();
  }, []);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getVersionBadgeColor = (version: string) => {
    if (version.startsWith('2.')) return 'bg-primary text-white';
    if (version.startsWith('1.')) return 'bg-blue-500 text-white';
    return 'bg-gray-500 text-white';
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <FileText className="w-6 h-6 text-primary" />
          Changelog
        </h1>
        <p className="text-muted-foreground mt-1">
          Track all updates and improvements to IPMCC Commander
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <Tag className="w-6 h-6 text-primary mx-auto mb-2" />
          <p className="text-2xl font-bold">{changelog.length}</p>
          <p className="text-sm text-muted-foreground">Releases</p>
        </div>
        <div className="card p-4 text-center">
          <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-bold">
            {changelog.reduce((acc, entry) => acc + entry.changes.length, 0)}
          </p>
          <p className="text-sm text-muted-foreground">Total Changes</p>
        </div>
        <div className="card p-4 text-center">
          <Star className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
          <p className="text-2xl font-bold">{changelog[0]?.version || '-'}</p>
          <p className="text-sm text-muted-foreground">Latest Version</p>
        </div>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="card p-8 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading changelog...</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

          {changelog.map((entry, index) => (
            <div key={entry.version} className="relative pl-12 pb-8">
              {/* Timeline dot */}
              <div className={`absolute left-2 w-5 h-5 rounded-full border-4 border-background ${
                index === 0 ? 'bg-primary' : 'bg-muted'
              }`} />

              {/* Content */}
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-mono font-bold ${getVersionBadgeColor(entry.version)}`}>
                      v{entry.version}
                    </span>
                    {index === 0 && (
                      <span className="px-2 py-0.5 bg-green-500/20 text-green-500 text-xs rounded-full">
                        Latest
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    {formatDate(entry.date)}
                  </div>
                </div>

                <ul className="space-y-2">
                  {entry.changes.map((change, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{change}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Future Plans */}
      <div className="card p-6 bg-primary/5 border-primary/20">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Star className="w-5 h-5 text-primary" />
          Upcoming Features
        </h2>
        <ul className="space-y-2">
          <li className="flex items-start gap-2 text-sm">
            <span className="text-primary">→</span>
            Portfolio analytics with P&L tracking
          </li>
          <li className="flex items-start gap-2 text-sm">
            <span className="text-primary">→</span>
            Automated position roll suggestions
          </li>
          <li className="flex items-start gap-2 text-sm">
            <span className="text-primary">→</span>
            Earnings calendar integration
          </li>
          <li className="flex items-start gap-2 text-sm">
            <span className="text-primary">→</span>
            Mobile-responsive design improvements
          </li>
          <li className="flex items-start gap-2 text-sm">
            <span className="text-primary">→</span>
            Broker integration (Alpaca, TD Ameritrade)
          </li>
        </ul>
      </div>
    </div>
  );
}
