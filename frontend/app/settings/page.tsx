'use client';

import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Bell, 
  Palette, 
  Calculator,
  Save,
  RefreshCw,
  Plug, 
  Check, 
  X, 
  ExternalLink, 
  Key,
  Shield,
  Database,
  Trash2,
  Copy
} from 'lucide-react';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface UserSettings {
  default_long_delta: number;
  default_short_dte: number;
  roll_alert_threshold: number;
  emergency_exit_threshold: number;
  profit_target_threshold: number;
  leap_dte_warning: number;
  notifications_enabled: boolean;
  daily_summary: boolean;
  theme: 'light' | 'dark' | 'system';
}

const defaultSettings: UserSettings = {
  default_long_delta: 80,
  default_short_dte: 7,
  roll_alert_threshold: 80,
  emergency_exit_threshold: 30,
  profit_target_threshold: 50,
  leap_dte_warning: 60,
  notifications_enabled: true,
  daily_summary: false,
  theme: 'dark',
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'trading' | 'schwab' | 'cache'>('trading');
  
  // Schwab state
  const [schwabStatus, setSchwabStatus] = useState<any>(null);
  const [authUrl, setAuthUrl] = useState<string>('');
  const [authCode, setAuthCode] = useState<string>('');
  const [cacheStats, setCacheStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchStatus = async () => {
    try {
      const schwabRes = await fetch(`${API_BASE}/api/v1/schwab/auth/status`);
      if (schwabRes.ok) setSchwabStatus(await schwabRes.json());

      const cacheRes = await fetch(`${API_BASE}/api/v1/schwab/cache/stats`);
      if (cacheRes.ok) setCacheStats(await cacheRes.json());
    } catch (error) {
      console.error('Failed to fetch status:', error);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    console.log('Saving settings:', settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setSettings(defaultSettings);
    setSaved(false);
  };

  // Schwab functions
  const getAuthUrl = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/schwab/auth/url`);
      const data = await res.json();
      if (res.ok) {
        setAuthUrl(data.authorization_url);
      } else {
        setMessage({ type: 'error', text: data.detail || 'Failed to get auth URL' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to connect to API' });
    }
    setLoading(false);
  };

  const submitAuthCode = async () => {
    if (!authCode.trim()) {
      setMessage({ type: 'error', text: 'Please enter the authorization code' });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/schwab/auth/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: authCode }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: 'Successfully connected to Schwab!' });
        setAuthCode('');
        setAuthUrl('');
        fetchStatus();
      } else {
        setMessage({ type: 'error', text: data.detail || 'Authentication failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to authenticate' });
    }
    setLoading(false);
  };

  const refreshToken = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/schwab/auth/refresh`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: 'Token refreshed!' });
        fetchStatus();
      } else {
        setMessage({ type: 'error', text: data.detail || 'Refresh failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to refresh token' });
    }
    setLoading(false);
  };

  const clearCache = async (namespace?: string) => {
    try {
      const url = namespace 
        ? `${API_BASE}/api/v1/schwab/cache/clear?namespace=${namespace}`
        : `${API_BASE}/api/v1/schwab/cache/clear`;
      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: `Cleared ${data.cleared} cache entries` });
        fetchStatus();
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to clear cache' });
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Settings</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Configure your IPMCC Commander experience
        </p>
      </div>

      {/* Message */}
      {message && (
        <div className={cn(
          "p-3 rounded-lg flex items-center gap-2",
          message.type === 'success' ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
        )}>
          {message.type === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--border)]">
        {[
          { id: 'trading', label: 'Trading', icon: Calculator },
          { id: 'schwab', label: 'Schwab API', icon: Plug },
          { id: 'cache', label: 'Cache', icon: Database },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === tab.id
                ? "border-[var(--info)] text-[var(--info)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Trading Settings Tab */}
      {activeTab === 'trading' && (
        <div className="space-y-6">
          {/* Trading Defaults */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <Calculator className="w-5 h-5 text-[var(--info)]" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Trading Defaults</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Default Long Delta: {settings.default_long_delta}
                </label>
                <input
                  type="range"
                  min="60"
                  max="95"
                  step="5"
                  value={settings.default_long_delta}
                  onChange={(e) => updateSetting('default_long_delta', Number(e.target.value))}
                  className="w-full accent-[var(--info)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Default Short Call DTE: {settings.default_short_dte} days
                </label>
                <input
                  type="range"
                  min="3"
                  max="21"
                  step="1"
                  value={settings.default_short_dte}
                  onChange={(e) => updateSetting('default_short_dte', Number(e.target.value))}
                  className="w-full accent-[var(--info)]"
                />
              </div>
            </div>
          </div>

          {/* Alert Thresholds */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <Bell className="w-5 h-5 text-[var(--warning)]" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Alert Thresholds</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Roll Alert: {settings.roll_alert_threshold}% extrinsic captured
                </label>
                <input
                  type="range"
                  min="60"
                  max="95"
                  step="5"
                  value={settings.roll_alert_threshold}
                  onChange={(e) => updateSetting('roll_alert_threshold', Number(e.target.value))}
                  className="w-full accent-[var(--warning)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Profit Target: {settings.profit_target_threshold}%
                </label>
                <input
                  type="range"
                  min="30"
                  max="100"
                  step="10"
                  value={settings.profit_target_threshold}
                  onChange={(e) => updateSetting('profit_target_threshold', Number(e.target.value))}
                  className="w-full accent-[var(--profit)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  LEAP DTE Warning: {settings.leap_dte_warning} days
                </label>
                <input
                  type="range"
                  min="30"
                  max="90"
                  step="10"
                  value={settings.leap_dte_warning}
                  onChange={(e) => updateSetting('leap_dte_warning', Number(e.target.value))}
                  className="w-full accent-[var(--warning)]"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button onClick={handleReset} className="btn-ghost flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Reset to Defaults
            </button>
            <button 
              onClick={handleSave} 
              className={cn(
                "btn-primary flex items-center gap-2",
                saved && "bg-[var(--profit)]"
              )}
            >
              <Save className="w-4 h-4" />
              {saved ? 'Saved!' : 'Save Settings'}
            </button>
          </div>
        </div>
      )}

      {/* Schwab API Tab */}
      {activeTab === 'schwab' && (
        <div className="card p-6 space-y-6">
          <div className="flex items-center gap-3 mb-4">
            <Plug className="w-5 h-5 text-[var(--info)]" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Charles Schwab API</h2>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between p-4 bg-[var(--surface)] rounded-lg">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-3 h-3 rounded-full",
                schwabStatus?.authenticated ? "bg-green-500" : "bg-red-500"
              )} />
              <span className="font-medium text-[var(--text-primary)]">
                {schwabStatus?.authenticated ? 'Connected' : 'Not Connected'}
              </span>
            </div>
            {schwabStatus?.authenticated && schwabStatus.token_expires_at && (
              <span className="text-sm text-[var(--text-secondary)]">
                Expires: {new Date(schwabStatus.token_expires_at).toLocaleString()}
              </span>
            )}
          </div>

          {/* Config status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 p-3 bg-[var(--surface)] rounded-lg">
              <Key className="h-4 w-4 text-[var(--text-secondary)]" />
              <span className="text-sm text-[var(--text-primary)]">App Key</span>
              {schwabStatus?.has_app_key ? (
                <Check className="h-4 w-4 text-green-500 ml-auto" />
              ) : (
                <X className="h-4 w-4 text-red-500 ml-auto" />
              )}
            </div>
            <div className="flex items-center gap-2 p-3 bg-[var(--surface)] rounded-lg">
              <Shield className="h-4 w-4 text-[var(--text-secondary)]" />
              <span className="text-sm text-[var(--text-primary)]">App Secret</span>
              {schwabStatus?.has_app_secret ? (
                <Check className="h-4 w-4 text-green-500 ml-auto" />
              ) : (
                <X className="h-4 w-4 text-red-500 ml-auto" />
              )}
            </div>
          </div>

          {/* Actions */}
          {schwabStatus?.authenticated ? (
            <button onClick={refreshToken} disabled={loading} className="btn-secondary flex items-center gap-2">
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              Refresh Token
            </button>
          ) : (
            <div className="space-y-4">
              {!authUrl && (
                <button onClick={getAuthUrl} disabled={loading} className="btn-primary flex items-center gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Get Authorization URL
                </button>
              )}

              {authUrl && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                      Step 1: Visit this URL and authorize
                    </label>
                    <div className="flex gap-2">
                      <input 
                        value={authUrl} 
                        readOnly 
                        className="input flex-1 font-mono text-xs"
                      />
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(authUrl);
                          setMessage({ type: 'success', text: 'URL copied!' });
                        }}
                        className="btn-ghost p-2"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button onClick={() => window.open(authUrl, '_blank')} className="btn-secondary">
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                      Step 2: Copy the URL from your browser (it will say "connection refused" - that's OK!)
                    </label>
                    <p className="text-xs text-[var(--text-muted)] mb-2">
                      After authorizing, your browser will try to go to https://127.0.0.1 and show an error. 
                      This is expected! Just copy the entire URL from your browser's address bar and paste it below.
                    </p>
                    <div className="flex gap-2">
                      <input
                        placeholder="Paste the full URL from browser (https://127.0.0.1/?code=...)"
                        value={authCode}
                        onChange={(e) => setAuthCode(e.target.value)}
                        className="input flex-1"
                      />
                      <button onClick={submitAuthCode} disabled={loading} className="btn-primary">
                        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Connect'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Help */}
          <div className="text-xs text-[var(--text-secondary)] p-3 bg-[var(--surface)] rounded-lg">
            <p className="font-medium mb-1">Setup Requirements:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Create a Schwab Developer account at developer.schwab.com</li>
              <li>Register an app and get your App Key and Secret</li>
              <li>Set callback URL to https://127.0.0.1</li>
              <li>Add SCHWAB_APP_KEY and SCHWAB_APP_SECRET to your .env file</li>
            </ol>
            <p className="font-medium mt-3 mb-1">Important Note:</p>
            <p>When you authorize, your browser will redirect to https://127.0.0.1 and show 
            "connection refused" - this is normal! Just copy the entire URL from your browser
            address bar (it contains the authorization code) and paste it in Step 2 above.</p>
          </div>
        </div>
      )}

      {/* Cache Tab */}
      {activeTab === 'cache' && (
        <div className="card p-6 space-y-6">
          <div className="flex items-center gap-3 mb-4">
            <Database className="w-5 h-5 text-[var(--info)]" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Cache Management</h2>
          </div>

          {cacheStats && (
            <>
              <div className="grid grid-cols-4 gap-4">
                <div className="p-3 bg-[var(--surface)] rounded-lg">
                  <p className="text-sm text-[var(--text-secondary)]">Entries</p>
                  <p className="text-2xl font-bold text-[var(--text-primary)]">{cacheStats.entries}</p>
                </div>
                <div className="p-3 bg-[var(--surface)] rounded-lg">
                  <p className="text-sm text-[var(--text-secondary)]">Hit Rate</p>
                  <p className="text-2xl font-bold text-[var(--text-primary)]">{cacheStats.hit_rate}%</p>
                </div>
                <div className="p-3 bg-[var(--surface)] rounded-lg">
                  <p className="text-sm text-[var(--text-secondary)]">Hits</p>
                  <p className="text-2xl font-bold text-green-500">{cacheStats.hits}</p>
                </div>
                <div className="p-3 bg-[var(--surface)] rounded-lg">
                  <p className="text-sm text-[var(--text-secondary)]">Misses</p>
                  <p className="text-2xl font-bold text-red-500">{cacheStats.misses}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button onClick={() => clearCache('option_chain')} className="btn-ghost text-sm">
                  Clear Option Chains
                </button>
                <button onClick={() => clearCache('quotes')} className="btn-ghost text-sm">
                  Clear Quotes
                </button>
                <button onClick={() => clearCache('account')} className="btn-ghost text-sm">
                  Clear Account Data
                </button>
                <button onClick={() => clearCache()} className="btn-ghost text-sm text-red-400 flex items-center gap-1">
                  <Trash2 className="w-3 h-3" />
                  Clear All
                </button>
              </div>
            </>
          )}

          <div className="text-xs text-[var(--text-secondary)] p-3 bg-[var(--surface)] rounded-lg">
            <p className="font-medium mb-1">Cache TTLs:</p>
            <ul className="space-y-1">
              <li>• Option Chains: 60 seconds</li>
              <li>• Quotes: 30 seconds</li>
              <li>• Account Data: 120 seconds</li>
              <li>• Sentiment Data: 300 seconds</li>
            </ul>
          </div>
        </div>
      )}

      {/* App Info */}
      <div className="card p-4">
        <div className="flex justify-between text-sm">
          <span className="text-[var(--text-secondary)]">IPMCC Commander v2.1.0</span>
          <span className="text-[var(--text-secondary)]">API: {API_BASE}</span>
        </div>
      </div>
    </div>
  );
}
