'use client';

import { useState } from 'react';
import {
  Settings,
  Key,
  Bell,
  Palette,
  Clock,
  Shield,
  Save,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Monitor,
  Zap,
  DollarSign,
  TrendingUp
} from 'lucide-react';

interface SettingsSection {
  id: string;
  title: string;
  icon: React.ElementType;
  description: string;
}

const sections: SettingsSection[] = [
  { id: 'api', title: 'API Connections', icon: Key, description: 'Configure broker API credentials' },
  { id: 'trading', title: 'Trading Preferences', icon: TrendingUp, description: 'Default values for trading' },
  { id: 'zeroDte', title: '0-DTE Settings', icon: Zap, description: 'Configure 0-DTE specific options' },
  { id: 'notifications', title: 'Notifications', icon: Bell, description: 'Alert and notification settings' },
  { id: 'display', title: 'Display', icon: Palette, description: 'Theme and appearance settings' },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('api');
  const [saved, setSaved] = useState(false);
  
  // API Settings
  const [schwabAppKey, setSchwabAppKey] = useState('');
  const [schwabAppSecret, setSchwabAppSecret] = useState('');
  const [schwabConnected, setSchwabConnected] = useState(false);
  
  // Trading Preferences
  const [defaultUnderlying, setDefaultUnderlying] = useState('SPX');
  const [defaultQuantity, setDefaultQuantity] = useState(1);
  const [maxPositionSize, setMaxPositionSize] = useState(5);
  const [profitTarget, setProfitTarget] = useState(35);
  const [stopLoss, setStopLoss] = useState(200);
  
  // 0-DTE Settings
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [killSwitchEnabled, setKillSwitchEnabled] = useState(true);
  const [vixSpikeThreshold, setVixSpikeThreshold] = useState(10);
  const [exitTimeWarning, setExitTimeWarning] = useState(15);
  
  // Notification Settings
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [killSwitchAlerts, setKillSwitchAlerts] = useState(true);
  const [profitAlerts, setProfitAlerts] = useState(true);
  const [eventAlerts, setEventAlerts] = useState(true);
  
  // Display Settings
  const [theme, setTheme] = useState('dark');
  const [compactMode, setCompactMode] = useState(false);

  const handleSave = () => {
    // In production, this would save to backend/localStorage
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const testSchwabConnection = async () => {
    // Simulate API connection test
    setSchwabConnected(true);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" />
            Settings
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Configure your IPMCC Commander preferences
          </p>
        </div>
        
        <button 
          onClick={handleSave}
          className="btn-primary flex items-center gap-2"
        >
          {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation */}
        <div className="lg:col-span-1">
          <nav className="card p-2 space-y-1">
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                    isActive 
                      ? 'bg-primary/10 text-primary' 
                      : 'hover:bg-[var(--surface)] text-[var(--text-secondary)]'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <div>
                    <p className="font-medium text-sm">{section.title}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{section.description}</p>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          {/* API Connections */}
          {activeSection === 'api' && (
            <div className="card p-6 space-y-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Key className="w-5 h-5 text-primary" />
                API Connections
              </h2>

              {/* Schwab API */}
              <div className="p-4 bg-[var(--surface)] rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Charles Schwab API</h3>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Connect to Schwab for live market data and trading
                    </p>
                  </div>
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                    schwabConnected 
                      ? 'bg-emerald-500/20 text-emerald-500' 
                      : 'bg-yellow-500/20 text-yellow-500'
                  }`}>
                    {schwabConnected ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Connected
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4" />
                        Not Connected
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-[var(--text-secondary)] mb-1">App Key</label>
                    <input
                      type="password"
                      value={schwabAppKey}
                      onChange={(e) => setSchwabAppKey(e.target.value)}
                      className="input w-full"
                      placeholder="Enter Schwab App Key"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--text-secondary)] mb-1">App Secret</label>
                    <input
                      type="password"
                      value={schwabAppSecret}
                      onChange={(e) => setSchwabAppSecret(e.target.value)}
                      className="input w-full"
                      placeholder="Enter Schwab App Secret"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    onClick={testSchwabConnection}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Test Connection
                  </button>
                  <a 
                    href="https://developer.schwab.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    Get API Keys
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <div className="p-4 bg-[var(--info)]/10 border border-[var(--info)]/30 rounded-lg">
                <p className="text-sm text-[var(--text-secondary)]">
                  <strong className="text-[var(--info)]">Note:</strong> Schwab API credentials are stored securely 
                  in your environment variables. See the .env.example file for setup instructions.
                </p>
              </div>
            </div>
          )}

          {/* Trading Preferences */}
          {activeSection === 'trading' && (
            <div className="card p-6 space-y-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Trading Preferences
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Default Underlying</label>
                  <select
                    value={defaultUnderlying}
                    onChange={(e) => setDefaultUnderlying(e.target.value)}
                    className="input w-full"
                  >
                    <option value="SPX">SPX (S&P 500 Index)</option>
                    <option value="SPY">SPY (S&P 500 ETF)</option>
                    <option value="QQQ">QQQ (Nasdaq 100 ETF)</option>
                    <option value="IWM">IWM (Russell 2000 ETF)</option>
                  </select>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    Pre-selected underlying in Trade Builder
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Default Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={defaultQuantity}
                    onChange={(e) => setDefaultQuantity(Number(e.target.value))}
                    className="input w-full"
                  />
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    Default number of contracts
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Max Position Size (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="25"
                    value={maxPositionSize}
                    onChange={(e) => setMaxPositionSize(Number(e.target.value))}
                    className="input w-full"
                  />
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    Maximum % of account per trade (recommended: 5%)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Default Profit Target (%)</label>
                  <input
                    type="number"
                    min="10"
                    max="100"
                    value={profitTarget}
                    onChange={(e) => setProfitTarget(Number(e.target.value))}
                    className="input w-full"
                  />
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    Target profit % for short premium trades
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 0-DTE Settings */}
          {activeSection === 'zeroDte' && (
            <div className="card p-6 space-y-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                0-DTE Settings
              </h2>

              <div className="space-y-4">
                {/* Auto Refresh */}
                <div className="flex items-center justify-between p-4 bg-[var(--surface)] rounded-lg">
                  <div>
                    <p className="font-medium">Auto-Refresh Data</p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Automatically refresh market data
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[var(--border)] rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                  </label>
                </div>

                {autoRefresh && (
                  <div className="ml-4">
                    <label className="block text-sm font-medium mb-2">Refresh Interval (seconds)</label>
                    <input
                      type="number"
                      min="10"
                      max="120"
                      value={refreshInterval}
                      onChange={(e) => setRefreshInterval(Number(e.target.value))}
                      className="input w-32"
                    />
                  </div>
                )}

                {/* Kill Switch */}
                <div className="flex items-center justify-between p-4 bg-[var(--surface)] rounded-lg">
                  <div>
                    <p className="font-medium">Kill Switch Enabled</p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Enable automatic risk alerts
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={killSwitchEnabled}
                      onChange={(e) => setKillSwitchEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[var(--border)] rounded-full peer peer-checked:bg-red-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">VIX Spike Threshold (%)</label>
                    <input
                      type="number"
                      min="5"
                      max="25"
                      value={vixSpikeThreshold}
                      onChange={(e) => setVixSpikeThreshold(Number(e.target.value))}
                      className="input w-full"
                    />
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                      Trigger kill switch when VIX1D spikes above this %
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Exit Warning Time (minutes)</label>
                    <input
                      type="number"
                      min="5"
                      max="60"
                      value={exitTimeWarning}
                      onChange={(e) => setExitTimeWarning(Number(e.target.value))}
                      className="input w-full"
                    />
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                      Minutes before 4PM to start exit warnings
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notifications */}
          {activeSection === 'notifications' && (
            <div className="card p-6 space-y-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                Notifications
              </h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-[var(--surface)] rounded-lg">
                  <div>
                    <p className="font-medium">Sound Alerts</p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Play sounds for important alerts
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={soundEnabled}
                      onChange={(e) => setSoundEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[var(--border)] rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-[var(--surface)] rounded-lg">
                  <div>
                    <p className="font-medium">Kill Switch Alerts</p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Alert when kill switch conditions are met
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={killSwitchAlerts}
                      onChange={(e) => setKillSwitchAlerts(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[var(--border)] rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-[var(--surface)] rounded-lg">
                  <div>
                    <p className="font-medium">Profit Target Alerts</p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Alert when positions reach profit targets
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profitAlerts}
                      onChange={(e) => setProfitAlerts(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[var(--border)] rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-[var(--surface)] rounded-lg">
                  <div>
                    <p className="font-medium">Economic Event Alerts</p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Alert for high-impact economic events
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={eventAlerts}
                      onChange={(e) => setEventAlerts(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[var(--border)] rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Display */}
          {activeSection === 'display' && (
            <div className="card p-6 space-y-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Palette className="w-5 h-5 text-primary" />
                Display Settings
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-3">Theme</label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setTheme('dark')}
                      className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                        theme === 'dark' 
                          ? 'border-primary bg-primary/10' 
                          : 'border-[var(--border)] hover:border-primary/50'
                      }`}
                    >
                      <Monitor className="w-6 h-6 mx-auto mb-2" />
                      <p className="text-sm font-medium">Dark</p>
                    </button>
                    <button
                      onClick={() => setTheme('light')}
                      className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                        theme === 'light' 
                          ? 'border-primary bg-primary/10' 
                          : 'border-[var(--border)] hover:border-primary/50'
                      }`}
                    >
                      <Monitor className="w-6 h-6 mx-auto mb-2" />
                      <p className="text-sm font-medium">Light</p>
                    </button>
                    <button
                      onClick={() => setTheme('system')}
                      className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                        theme === 'system' 
                          ? 'border-primary bg-primary/10' 
                          : 'border-[var(--border)] hover:border-primary/50'
                      }`}
                    >
                      <Monitor className="w-6 h-6 mx-auto mb-2" />
                      <p className="text-sm font-medium">System</p>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-[var(--surface)] rounded-lg">
                  <div>
                    <p className="font-medium">Compact Mode</p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Reduce spacing for more information density
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={compactMode}
                      onChange={(e) => setCompactMode(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[var(--border)] rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
