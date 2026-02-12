'use client';

import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  Shield, 
  TrendingUp,
  Activity,
  RefreshCw,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Severity colors
const severityConfig = {
  critical: {
    bg: 'bg-red-500/20',
    border: 'border-red-500',
    text: 'text-red-400',
    badge: 'bg-red-600 text-white',
    icon: AlertCircle,
  },
  warning: {
    bg: 'bg-yellow-500/20',
    border: 'border-yellow-500',
    text: 'text-yellow-400',
    badge: 'bg-yellow-600 text-white',
    icon: AlertTriangle,
  },
  info: {
    bg: 'bg-blue-500/20',
    border: 'border-blue-500',
    text: 'text-blue-400',
    badge: 'bg-blue-600 text-white',
    icon: Info,
  },
};

interface RiskAlert {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  ticker: string;
  message: string;
  details: Record<string, any>;
  action_required?: string;
  created_at: string;
}

interface PortfolioRisk {
  total_delta: number;
  total_beta_weighted_delta: number;
  spy_equivalent_shares: number;
  total_notional: number;
  position_count: number;
  interpretation: string;
  alerts: RiskAlert[];
}

interface AlertSummary {
  total_alerts: number;
  critical_count: number;
  warning_count: number;
  info_count: number;
  critical: RiskAlert[];
  warnings: RiskAlert[];
  info: RiskAlert[];
  has_action_required: boolean;
}

export default function RiskMonitorPage() {
  const [alerts, setAlerts] = useState<AlertSummary | null>(null);
  const [portfolioRisk, setPortfolioRisk] = useState<PortfolioRisk | null>(null);
  const [thresholds, setThresholds] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  // Sample positions for demo
  const samplePositions = [
    {
      ticker: 'AAPL',
      current_price: 185.50,
      short_strike: 190,
      short_dte: 5,
      short_delta: 0.35,
      short_premium_received: 2.50,
      current_short_value: 1.80,
      long_strike: 170,
      long_dte: 180,
      beta: 1.2,
      quantity: 2,
    },
    {
      ticker: 'MSFT',
      current_price: 415.00,
      short_strike: 410,
      short_dte: 3,
      short_delta: 0.72,
      short_premium_received: 5.00,
      current_short_value: 8.50,
      long_strike: 380,
      long_dte: 240,
      beta: 1.1,
      quantity: 1,
    },
    {
      ticker: 'NVDA',
      current_price: 875.00,
      short_strike: 900,
      short_dte: 12,
      short_delta: 0.28,
      short_premium_received: 15.00,
      current_short_value: 7.00,
      long_strike: 800,
      long_dte: 300,
      beta: 1.8,
      quantity: 1,
    },
  ];

  const fetchRiskData = async () => {
    setLoading(true);
    try {
      // Fetch alerts for positions
      const alertsRes = await fetch(`${API_BASE}/api/v1/risk/analyze/portfolio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(samplePositions),
      });
      if (alertsRes.ok) {
        setAlerts(await alertsRes.json());
      }

      // Fetch portfolio beta-delta
      const betaDeltaRes = await fetch(`${API_BASE}/api/v1/risk/analyze/beta-delta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          positions: samplePositions.map(p => ({
            ticker: p.ticker,
            delta: p.short_delta * -1,
            beta: p.beta,
            price: p.current_price,
            quantity: p.quantity,
          })),
          spy_price: 500,
        }),
      });
      if (betaDeltaRes.ok) {
        setPortfolioRisk(await betaDeltaRes.json());
      }

      // Fetch thresholds
      const thresholdsRes = await fetch(`${API_BASE}/api/v1/risk/thresholds`);
      if (thresholdsRes.ok) {
        const data = await thresholdsRes.json();
        setThresholds(data.thresholds);
      }
    } catch (error) {
      console.error('Failed to fetch risk data:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRiskData();
    const interval = setInterval(fetchRiskData, 60000);
    return () => clearInterval(interval);
  }, []);

  const AlertCard = ({ alert }: { alert: RiskAlert }) => {
    const config = severityConfig[alert.severity];
    const Icon = config.icon;

    return (
      <div className={cn('p-4 rounded-lg border', config.bg, config.border, config.text, 'mb-3')}>
        <div className="flex items-start gap-3">
          <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn('px-2 py-0.5 rounded text-xs font-medium', config.badge)}>
                {alert.ticker}
              </span>
              <span className="px-2 py-0.5 rounded text-xs border border-current opacity-70">
                {alert.type.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="font-medium">{alert.message}</p>
            {alert.action_required && (
              <p className="text-sm mt-2 opacity-80">
                👉 {alert.action_required}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)] flex items-center gap-3">
            <Shield className="h-7 w-7 text-indigo-400" />
            Risk Monitor
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Real-time alerts for assignment risk, roll triggers, and portfolio exposure
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="btn-ghost flex items-center gap-2 text-sm"
          >
            <Settings className="h-4 w-4" />
            Thresholds
          </button>
          <button
            onClick={fetchRiskData}
            disabled={loading}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Alert Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className={cn('card p-4', alerts?.critical_count && 'border-red-500')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-secondary)]">Critical</p>
              <p className="text-3xl font-bold text-red-500">
                {alerts?.critical_count || 0}
              </p>
            </div>
            <AlertCircle className="h-8 w-8 text-red-500/50" />
          </div>
        </div>

        <div className={cn('card p-4', alerts?.warning_count && 'border-yellow-500')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-secondary)]">Warnings</p>
              <p className="text-3xl font-bold text-yellow-500">
                {alerts?.warning_count || 0}
              </p>
            </div>
            <AlertTriangle className="h-8 w-8 text-yellow-500/50" />
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-secondary)]">Info</p>
              <p className="text-3xl font-bold text-blue-500">
                {alerts?.info_count || 0}
              </p>
            </div>
            <Info className="h-8 w-8 text-blue-500/50" />
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-secondary)]">Positions</p>
              <p className="text-3xl font-bold text-[var(--text-primary)]">
                {portfolioRisk?.position_count || 0}
              </p>
            </div>
            <Activity className="h-8 w-8 text-[var(--text-secondary)]/50" />
          </div>
        </div>
      </div>

      {/* Portfolio Beta-Weighted Delta */}
      {portfolioRisk && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5" />
            Portfolio Exposure
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            Beta-weighted delta shows your SPY-equivalent directional exposure
          </p>

          <div className="grid grid-cols-3 gap-6 mb-4">
            <div>
              <p className="text-sm text-[var(--text-secondary)] mb-1">Total Delta</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {portfolioRisk.total_delta > 0 ? '+' : ''}
                {portfolioRisk.total_delta}
              </p>
            </div>
            <div>
              <p className="text-sm text-[var(--text-secondary)] mb-1">SPY Equivalent</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {portfolioRisk.spy_equivalent_shares > 0 ? '+' : ''}
                {portfolioRisk.spy_equivalent_shares} shares
              </p>
            </div>
            <div>
              <p className="text-sm text-[var(--text-secondary)] mb-1">Notional Value</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                ${portfolioRisk.total_notional.toLocaleString()}
              </p>
            </div>
          </div>
          
          <div className="p-3 bg-[var(--surface)] rounded-lg">
            <p className="text-sm text-[var(--text-secondary)]">{portfolioRisk.interpretation}</p>
          </div>

          {/* Delta gauge */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-[var(--text-secondary)] mb-1">
              <span>Bearish</span>
              <span>Neutral</span>
              <span>Bullish</span>
            </div>
            <div className="relative h-3 bg-[var(--surface)] rounded-full overflow-hidden">
              <div 
                className="absolute top-0 h-full w-2 bg-indigo-500 rounded-full transition-all"
                style={{ 
                  left: `${Math.min(100, Math.max(0, 50 + portfolioRisk.total_beta_weighted_delta))}%`,
                  transform: 'translateX(-50%)'
                }}
              />
              <div className="absolute left-1/2 top-0 h-full w-0.5 bg-[var(--text-secondary)]/30" />
            </div>
          </div>
        </div>
      )}

      {/* Thresholds Settings */}
      {showSettings && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Alert Thresholds</h2>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(thresholds).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between p-3 bg-[var(--surface)] rounded-lg">
                <span className="text-sm text-[var(--text-secondary)]">{key.replace(/_/g, ' ')}</span>
                <span className="px-2 py-1 rounded text-xs bg-[var(--bg-elevated)] text-[var(--text-primary)]">
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alerts List */}
      <div className="grid grid-cols-2 gap-6">
        {/* Critical & Warnings */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-red-500 flex items-center gap-2 mb-4">
            <AlertCircle className="h-5 w-5" />
            Action Required
          </h2>
          {alerts?.critical.map((alert, i) => (
            <AlertCard key={`critical-${i}`} alert={alert} />
          ))}
          {alerts?.warnings.map((alert, i) => (
            <AlertCard key={`warning-${i}`} alert={alert} />
          ))}
          {(!alerts?.critical.length && !alerts?.warnings.length) && (
            <div className="text-center py-8 text-[var(--text-secondary)]">
              <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No action required - all positions look healthy!</p>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-blue-500 flex items-center gap-2 mb-4">
            <Info className="h-5 w-5" />
            Information
          </h2>
          {alerts?.info.map((alert, i) => (
            <AlertCard key={`info-${i}`} alert={alert} />
          ))}
          {!alerts?.info.length && (
            <div className="text-center py-8 text-[var(--text-secondary)]">
              <Info className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No informational alerts</p>
            </div>
          )}
        </div>
      </div>

      {/* Position Details Table */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Position Risk Details</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-2 text-[var(--text-secondary)]">Ticker</th>
                <th className="text-right py-2 text-[var(--text-secondary)]">Price</th>
                <th className="text-right py-2 text-[var(--text-secondary)]">Short Strike</th>
                <th className="text-right py-2 text-[var(--text-secondary)]">Distance</th>
                <th className="text-right py-2 text-[var(--text-secondary)]">DTE</th>
                <th className="text-right py-2 text-[var(--text-secondary)]">Delta</th>
                <th className="text-right py-2 text-[var(--text-secondary)]">P&L %</th>
                <th className="text-center py-2 text-[var(--text-secondary)]">Status</th>
              </tr>
            </thead>
            <tbody>
              {samplePositions.map((pos) => {
                const distance = ((pos.short_strike - pos.current_price) / pos.current_price) * 100;
                const pnl = ((pos.short_premium_received - pos.current_short_value) / pos.short_premium_received) * 100;
                const isITM = pos.current_price >= pos.short_strike;
                const needsRoll = pos.short_dte <= 7 || pos.short_delta >= 0.70;
                
                return (
                  <tr key={pos.ticker} className="border-b border-[var(--border)]">
                    <td className="py-3 font-medium text-[var(--text-primary)]">{pos.ticker}</td>
                    <td className="text-right text-[var(--text-primary)]">${pos.current_price.toFixed(2)}</td>
                    <td className="text-right text-[var(--text-primary)]">${pos.short_strike}</td>
                    <td className={cn(
                      'text-right',
                      distance < 2 && 'text-yellow-500',
                      isITM && 'text-red-500'
                    )}>
                      {distance.toFixed(1)}%
                    </td>
                    <td className={cn('text-right', pos.short_dte <= 7 && 'text-yellow-500')}>
                      {pos.short_dte}d
                    </td>
                    <td className={cn('text-right', pos.short_delta >= 0.70 && 'text-yellow-500')}>
                      {pos.short_delta.toFixed(2)}
                    </td>
                    <td className={cn('text-right', pnl > 0 ? 'text-green-500' : 'text-red-500')}>
                      {pnl.toFixed(0)}%
                    </td>
                    <td className="text-center">
                      {isITM ? (
                        <span className="px-2 py-1 rounded text-xs bg-red-600 text-white">ITM</span>
                      ) : needsRoll ? (
                        <span className="px-2 py-1 rounded text-xs bg-yellow-600 text-white">Roll</span>
                      ) : (
                        <span className="px-2 py-1 rounded text-xs border border-green-500 text-green-500">OK</span>
                      )}
                    </td>
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
