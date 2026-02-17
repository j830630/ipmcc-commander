'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Shield,
  AlertTriangle,
  ArrowLeft,
  Activity,
  Zap,
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign,
  Target,
  RefreshCw,
  Bell,
  BellOff,
  XCircle,
  CheckCircle,
  AlertCircle,
  Gauge,
  Flame,
  Snowflake,
  Volume2,
  VolumeX,
  Eye,
  Power
} from 'lucide-react';

interface Position {
  id: string;
  underlying: string;
  type: 'iron_condor' | 'call_spread' | 'put_spread';
  shortCallStrike: number;
  longCallStrike: number;
  shortPutStrike: number;
  longPutStrike: number;
  creditReceived: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
  status: 'safe' | 'warning' | 'danger' | 'breached';
  entryTime: string;
}

interface MarketAlert {
  id: string;
  type: 'vix_spike' | 'gamma_flip' | 'breach' | 'time_warning' | 'profit_target';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

interface MarketConditions {
  spxPrice: number;
  spxChange: number;
  spxChangePercent: number;
  vix: number;
  vix1d: number;
  vixChange: number;
  gammaRegime: 'positive' | 'negative' | 'neutral';
  callWall: number;
  putWall: number;
  flipLevel: number;
}

// Simulated data generators
const generateMarketConditions = (): MarketConditions => {
  const spxPrice = 5850 + (Math.random() - 0.5) * 20;
  return {
    spxPrice: Number(spxPrice.toFixed(2)),
    spxChange: Number((Math.random() * 20 - 10).toFixed(2)),
    spxChangePercent: Number((Math.random() * 0.5 - 0.25).toFixed(2)),
    vix: Number((14 + Math.random() * 4).toFixed(2)),
    vix1d: Number((13 + Math.random() * 4).toFixed(2)),
    vixChange: Number((Math.random() * 8 - 4).toFixed(2)),
    gammaRegime: Math.random() > 0.3 ? 'positive' : Math.random() > 0.5 ? 'negative' : 'neutral',
    callWall: 5900,
    putWall: 5800,
    flipLevel: 5850
  };
};

const generatePositions = (): Position[] => {
  return [
    {
      id: '1',
      underlying: 'SPX',
      type: 'iron_condor',
      shortCallStrike: 5900,
      longCallStrike: 5910,
      shortPutStrike: 5800,
      longPutStrike: 5790,
      creditReceived: 320,
      currentValue: 180,
      pnl: 140,
      pnlPercent: 43.75,
      status: 'safe',
      entryTime: '09:52 AM'
    }
  ];
};

function KillSwitchStatus({ conditions, positions }: { conditions: MarketConditions; positions: Position[] }) {
  const [killSwitchArmed, setKillSwitchArmed] = useState(true);
  
  // Determine overall threat level
  const getThreatLevel = () => {
    if (conditions.vixChange > 10) return 'critical';
    if (conditions.gammaRegime === 'negative') return 'elevated';
    if (positions.some(p => p.status === 'breached')) return 'critical';
    if (positions.some(p => p.status === 'danger')) return 'elevated';
    if (conditions.vixChange > 5) return 'elevated';
    return 'normal';
  };

  const threatLevel = getThreatLevel();

  const getThreatColor = () => {
    switch (threatLevel) {
      case 'critical': return 'bg-red-500';
      case 'elevated': return 'bg-orange-500';
      default: return 'bg-emerald-500';
    }
  };

  const getThreatBg = () => {
    switch (threatLevel) {
      case 'critical': return 'bg-red-500/20 border-red-500';
      case 'elevated': return 'bg-orange-500/20 border-orange-500';
      default: return 'bg-emerald-500/20 border-emerald-500';
    }
  };

  return (
    <div className={`card p-6 border-2 ${getThreatBg()}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-4 h-4 rounded-full ${getThreatColor()} animate-pulse`} />
          <h2 className="text-xl font-bold uppercase">
            Threat Level: {threatLevel}
          </h2>
        </div>
        
        <button
          onClick={() => setKillSwitchArmed(!killSwitchArmed)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            killSwitchArmed 
              ? 'bg-red-500 text-white hover:bg-red-600' 
              : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--border)]'
          }`}
        >
          <Power className="w-4 h-4" />
          Kill Switch {killSwitchArmed ? 'ARMED' : 'DISARMED'}
        </button>
      </div>

      {threatLevel === 'critical' && (
        <div className="p-4 bg-red-500/30 rounded-lg mb-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <div>
              <p className="font-bold text-red-400">IMMEDIATE ACTION REQUIRED</p>
              <p className="text-sm text-red-300">
                {conditions.vixChange > 10 
                  ? `VIX1D has spiked ${conditions.vixChange.toFixed(1)}% - Close all short vol positions NOW`
                  : 'Position breach detected - Execute emergency exit protocol'}
              </p>
            </div>
          </div>
          {killSwitchArmed && (
            <button className="mt-3 w-full btn-primary bg-red-500 hover:bg-red-600 flex items-center justify-center gap-2">
              <XCircle className="w-5 h-5" />
              EXECUTE KILL SWITCH - Close All Positions
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-4 gap-4 text-center">
        <div className="p-3 bg-[var(--surface)] rounded-lg">
          <p className="text-xs text-[var(--text-secondary)]">VIX Change</p>
          <p className={`text-lg font-bold ${conditions.vixChange > 5 ? 'text-red-500' : 'text-emerald-500'}`}>
            {conditions.vixChange > 0 ? '+' : ''}{conditions.vixChange.toFixed(1)}%
          </p>
        </div>
        <div className="p-3 bg-[var(--surface)] rounded-lg">
          <p className="text-xs text-[var(--text-secondary)]">Gamma Regime</p>
          <p className={`text-lg font-bold ${
            conditions.gammaRegime === 'positive' ? 'text-emerald-500' : 
            conditions.gammaRegime === 'negative' ? 'text-red-500' : 'text-yellow-500'
          }`}>
            {conditions.gammaRegime.toUpperCase()}
          </p>
        </div>
        <div className="p-3 bg-[var(--surface)] rounded-lg">
          <p className="text-xs text-[var(--text-secondary)]">Open Positions</p>
          <p className="text-lg font-bold">{positions.length}</p>
        </div>
        <div className="p-3 bg-[var(--surface)] rounded-lg">
          <p className="text-xs text-[var(--text-secondary)]">Time to Close</p>
          <p className="text-lg font-bold text-orange-500">
            {getTimeToClose()}
          </p>
        </div>
      </div>
    </div>
  );
}

function getTimeToClose(): string {
  const now = new Date();
  const marketClose = new Date();
  marketClose.setHours(15, 50, 0, 0); // 3:50 PM
  
  if (now > marketClose) return 'CLOSED';
  
  const diff = marketClose.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours === 0 && minutes <= 30) return `${minutes}m (DANGER)`;
  return `${hours}h ${minutes}m`;
}

function MarketDataPanel({ conditions }: { conditions: MarketConditions }) {
  return (
    <div className="card p-6">
      <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4 flex items-center gap-2">
        <Activity className="w-4 h-4" />
        Live Market Data
      </h3>

      <div className="space-y-4">
        {/* SPX Price */}
        <div className="p-4 bg-[var(--surface)] rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--text-secondary)]">SPX</span>
            <div className="flex items-center gap-2">
              {conditions.spxChange >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500" />
              )}
              <span className={`text-sm ${conditions.spxChange >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {conditions.spxChange >= 0 ? '+' : ''}{conditions.spxChange.toFixed(2)} ({conditions.spxChangePercent}%)
              </span>
            </div>
          </div>
          <p className="text-2xl font-bold mt-1">{conditions.spxPrice.toFixed(2)}</p>
        </div>

        {/* VIX Data */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-[var(--surface)] rounded-lg">
            <p className="text-xs text-[var(--text-secondary)]">VIX (30D)</p>
            <p className="text-xl font-bold">{conditions.vix}</p>
          </div>
          <div className="p-3 bg-[var(--surface)] rounded-lg">
            <p className="text-xs text-[var(--text-secondary)]">VIX1D</p>
            <p className="text-xl font-bold">{conditions.vix1d}</p>
          </div>
        </div>

        {/* VIX Change Alert */}
        <div className={`p-3 rounded-lg ${
          conditions.vixChange > 8 ? 'bg-red-500/20 border border-red-500' :
          conditions.vixChange > 5 ? 'bg-orange-500/20 border border-orange-500' :
          'bg-emerald-500/20 border border-emerald-500'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-sm">VIX1D Intraday Change</span>
            <span className={`font-bold ${
              conditions.vixChange > 8 ? 'text-red-500' :
              conditions.vixChange > 5 ? 'text-orange-500' :
              'text-emerald-500'
            }`}>
              {conditions.vixChange > 0 ? '+' : ''}{conditions.vixChange.toFixed(1)}%
            </span>
          </div>
          {conditions.vixChange > 8 && (
            <p className="text-xs text-red-400 mt-1">KILL SWITCH THRESHOLD EXCEEDED</p>
          )}
        </div>

        {/* Key Levels */}
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2 bg-emerald-500/10 rounded">
            <span className="text-sm">Call Wall</span>
            <span className="font-medium text-emerald-500">{conditions.callWall}</span>
          </div>
          <div className="flex items-center justify-between p-2 bg-yellow-500/10 rounded">
            <span className="text-sm">Gamma Flip</span>
            <span className="font-medium text-yellow-500">{conditions.flipLevel}</span>
          </div>
          <div className="flex items-center justify-between p-2 bg-red-500/10 rounded">
            <span className="text-sm">Put Wall</span>
            <span className="font-medium text-red-500">{conditions.putWall}</span>
          </div>
        </div>

        {/* Gamma Regime */}
        <div className={`p-4 rounded-lg ${
          conditions.gammaRegime === 'positive' ? 'bg-emerald-500/20' :
          conditions.gammaRegime === 'negative' ? 'bg-red-500/20' :
          'bg-yellow-500/20'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            {conditions.gammaRegime === 'positive' ? (
              <Snowflake className="w-5 h-5 text-emerald-500" />
            ) : conditions.gammaRegime === 'negative' ? (
              <Flame className="w-5 h-5 text-red-500" />
            ) : (
              <Activity className="w-5 h-5 text-yellow-500" />
            )}
            <span className="font-medium">
              {conditions.gammaRegime === 'positive' ? 'Positive Gamma' :
               conditions.gammaRegime === 'negative' ? 'Negative Gamma' :
               'Neutral Gamma'}
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            {conditions.gammaRegime === 'positive' 
              ? 'Dealers suppress volatility. Iron Condors favorable.'
              : conditions.gammaRegime === 'negative'
              ? 'WARNING: Dealers amplify moves. Avoid short vol!'
              : 'No strong dealer positioning. Reduce size.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function PositionsPanel({ positions }: { positions: Position[] }) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(value);
  };

  const getStatusColor = (status: Position['status']) => {
    switch (status) {
      case 'safe': return 'text-emerald-500 bg-emerald-500/20';
      case 'warning': return 'text-yellow-500 bg-yellow-500/20';
      case 'danger': return 'text-orange-500 bg-orange-500/20';
      case 'breached': return 'text-red-500 bg-red-500/20';
    }
  };

  const getStatusIcon = (status: Position['status']) => {
    switch (status) {
      case 'safe': return <CheckCircle className="w-4 h-4" />;
      case 'warning': return <AlertCircle className="w-4 h-4" />;
      case 'danger': return <AlertTriangle className="w-4 h-4" />;
      case 'breached': return <XCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className="card p-6">
      <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4 flex items-center gap-2">
        <Target className="w-4 h-4" />
        Active Positions
      </h3>

      {positions.length === 0 ? (
        <div className="text-center py-8 text-[var(--text-secondary)]">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No active positions</p>
        </div>
      ) : (
        <div className="space-y-4">
          {positions.map((position) => (
            <div key={position.id} className="p-4 bg-[var(--surface)] rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{position.underlying}</span>
                  <span className="text-xs text-[var(--text-secondary)] bg-[var(--border)] px-2 py-0.5 rounded">
                    Iron Condor
                  </span>
                </div>
                <div className={`flex items-center gap-1 px-2 py-1 rounded ${getStatusColor(position.status)}`}>
                  {getStatusIcon(position.status)}
                  <span className="text-xs font-medium uppercase">{position.status}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                <div>
                  <p className="text-xs text-[var(--text-secondary)]">Short Strikes</p>
                  <p className="font-medium">{position.shortPutStrike}P / {position.shortCallStrike}C</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-secondary)]">Entry</p>
                  <p className="font-medium">{position.entryTime}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-2 bg-[var(--bg-elevated)] rounded">
                  <p className="text-xs text-[var(--text-secondary)]">Credit</p>
                  <p className="font-medium">{formatCurrency(position.creditReceived)}</p>
                </div>
                <div className="p-2 bg-[var(--bg-elevated)] rounded">
                  <p className="text-xs text-[var(--text-secondary)]">Current</p>
                  <p className="font-medium">{formatCurrency(position.currentValue)}</p>
                </div>
                <div className={`p-2 rounded ${position.pnl >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                  <p className="text-xs text-[var(--text-secondary)]">P&L</p>
                  <p className={`font-bold ${position.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {position.pnl >= 0 ? '+' : ''}{formatCurrency(position.pnl)} ({position.pnlPercent.toFixed(1)}%)
                  </p>
                </div>
              </div>

              {/* Progress to profit target */}
              <div className="mt-3">
                <div className="flex justify-between text-xs text-[var(--text-secondary)] mb-1">
                  <span>Progress to 35% Target</span>
                  <span>{Math.min(100, (position.pnlPercent / 35 * 100)).toFixed(0)}%</span>
                </div>
                <div className="w-full h-2 bg-[var(--border)] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${Math.min(100, position.pnlPercent / 35 * 100)}%` }}
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 mt-3">
                {position.pnlPercent >= 30 && (
                  <button className="flex-1 btn-primary bg-emerald-500 hover:bg-emerald-600 text-sm py-2">
                    Take Profit
                  </button>
                )}
                <button className="flex-1 btn-secondary text-sm py-2">
                  Close Position
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AlertsPanel({ alerts, onAcknowledge }: { alerts: MarketAlert[]; onAcknowledge: (id: string) => void }) {
  const getSeverityColor = (severity: MarketAlert['severity']) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/20 border-red-500';
      case 'warning': return 'bg-orange-500/20 border-orange-500';
      default: return 'bg-blue-500/20 border-blue-500';
    }
  };

  const getSeverityIcon = (severity: MarketAlert['severity']) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-orange-500" />;
      default: return <Bell className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="card p-6">
      <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4 flex items-center gap-2">
        <Bell className="w-4 h-4" />
        Active Alerts ({alerts.filter(a => !a.acknowledged).length})
      </h3>

      {alerts.length === 0 ? (
        <div className="text-center py-8 text-[var(--text-secondary)]">
          <BellOff className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No active alerts</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {alerts.map((alert) => (
            <div 
              key={alert.id}
              className={`p-3 rounded-lg border ${getSeverityColor(alert.severity)} ${
                alert.acknowledged ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-start gap-2">
                {getSeverityIcon(alert.severity)}
                <div className="flex-1">
                  <p className="text-sm">{alert.message}</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    {alert.timestamp.toLocaleTimeString()}
                  </p>
                </div>
                {!alert.acknowledged && (
                  <button 
                    onClick={() => onAcknowledge(alert.id)}
                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    Dismiss
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RulesChecklist() {
  const rules = [
    { rule: 'Entry between 9:45 AM - 10:15 AM', checked: true },
    { rule: 'Positive Gamma regime confirmed', checked: true },
    { rule: 'VIX1D in contango with VIX', checked: true },
    { rule: 'Short strikes at GEX walls', checked: true },
    { rule: 'Position size < 5% of account', checked: true },
    { rule: 'Profit target set at 35%', checked: true },
    { rule: 'Stop loss set at 2x credit', checked: true },
    { rule: 'Exit before 3:50 PM', checked: false }
  ];

  return (
    <div className="card p-6">
      <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4 flex items-center gap-2">
        <CheckCircle className="w-4 h-4" />
        Execution Checklist
      </h3>

      <div className="space-y-2">
        {rules.map((item, i) => (
          <div 
            key={i}
            className={`flex items-center gap-2 p-2 rounded ${
              item.checked ? 'bg-emerald-500/10' : 'bg-[var(--surface)]'
            }`}
          >
            {item.checked ? (
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            ) : (
              <div className="w-4 h-4 border-2 border-[var(--border)] rounded" />
            )}
            <span className={`text-sm ${item.checked ? 'text-emerald-400' : 'text-[var(--text-secondary)]'}`}>
              {item.rule}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function KillSwitchMonitor() {
  const [conditions, setConditions] = useState<MarketConditions>(generateMarketConditions());
  const [positions, setPositions] = useState<Position[]>(generatePositions());
  const [alerts, setAlerts] = useState<MarketAlert[]>([
    {
      id: '1',
      type: 'profit_target',
      severity: 'info',
      message: 'SPX Iron Condor approaching 35% profit target',
      timestamp: new Date(),
      acknowledged: false
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const refreshData = () => {
    setLoading(true);
    setTimeout(() => {
      const newConditions = generateMarketConditions();
      setConditions(newConditions);
      
      // Generate alerts based on conditions
      if (newConditions.vixChange > 8 && !alerts.some(a => a.type === 'vix_spike' && !a.acknowledged)) {
        setAlerts(prev => [...prev, {
          id: Date.now().toString(),
          type: 'vix_spike',
          severity: 'critical',
          message: `KILL SWITCH: VIX1D spiked ${newConditions.vixChange.toFixed(1)}%`,
          timestamp: new Date(),
          acknowledged: false
        }]);
      }
      
      if (newConditions.gammaRegime === 'negative' && !alerts.some(a => a.type === 'gamma_flip' && !a.acknowledged)) {
        setAlerts(prev => [...prev, {
          id: Date.now().toString(),
          type: 'gamma_flip',
          severity: 'warning',
          message: 'Gamma Flip detected - Consider closing short vol positions',
          timestamp: new Date(),
          acknowledged: false
        }]);
      }
      
      setLoading(false);
    }, 500);
  };

  useEffect(() => {
    const interval = setInterval(refreshData, 30000);
    return () => clearInterval(interval);
  }, []);

  const acknowledgeAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/zero-dte" className="text-sm text-[var(--text-secondary)] hover:text-primary flex items-center gap-1 mb-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Shield className="w-6 h-6 text-orange-500" />
            Kill Switch Monitor
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Real-time risk monitoring and emergency position management
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="btn-secondary p-2"
            title={soundEnabled ? 'Mute alerts' : 'Enable alerts'}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
          <button 
            onClick={refreshData}
            disabled={loading}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Kill Switch Status */}
      <KillSwitchStatus conditions={conditions} positions={positions} />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <MarketDataPanel conditions={conditions} />
        <PositionsPanel positions={positions} />
        <div className="space-y-6">
          <AlertsPanel alerts={alerts} onAcknowledge={acknowledgeAlert} />
          <RulesChecklist />
        </div>
      </div>
    </div>
  );
}
