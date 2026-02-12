// ============================================================================
// IPMCC Commander - Utility Functions
// ============================================================================

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Tailwind class merger
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================================================
// NUMBER FORMATTING
// ============================================================================

export function formatCurrency(value: number, decimals = 2): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  
  if (absValue >= 1_000_000) {
    return `${sign}$${(absValue / 1_000_000).toFixed(1)}M`;
  }
  if (absValue >= 1_000) {
    return `${sign}$${(absValue / 1_000).toFixed(1)}K`;
  }
  return `${sign}$${absValue.toFixed(decimals)}`;
}

export function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number, decimals = 1): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatNumber(value: number, decimals = 2): string {
  return value.toFixed(decimals);
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

// ============================================================================
// DATE FORMATTING
// ============================================================================

export function formatDate(dateStr: string, format?: string): string {
  const date = new Date(dateStr);
  
  // Support custom format strings
  if (format) {
    const options: Intl.DateTimeFormatOptions = {};
    
    if (format.includes('MMMM')) {
      options.month = 'long';
    } else if (format.includes('MMM')) {
      options.month = 'short';
    } else if (format.includes('M')) {
      options.month = 'numeric';
    }
    
    if (format.includes('d') || format.includes('D')) {
      options.day = 'numeric';
    }
    
    if (format.includes('yyyy')) {
      options.year = 'numeric';
    } else if (format.includes('yy')) {
      options.year = '2-digit';
    }
    
    return date.toLocaleDateString('en-US', options);
  }
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function formatExpiration(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: '2-digit',
  });
}

export function daysFromNow(dateStr: string): number {
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diff = target.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function formatDTE(dte: number): string {
  if (dte === 0) return 'Expiring today';
  if (dte === 1) return '1 day';
  if (dte < 7) return `${dte} days`;
  if (dte < 30) return `${Math.floor(dte / 7)} weeks`;
  if (dte < 365) return `${Math.floor(dte / 30)} months`;
  return `${(dte / 365).toFixed(1)} years`;
}

export function getDTEStatus(dte: number): 'critical' | 'warning' | 'healthy' {
  if (dte <= 7) return 'critical';
  if (dte <= 30) return 'warning';
  return 'healthy';
}

// ============================================================================
// PNL HELPERS
// ============================================================================

export function getPnLClass(value: number): string {
  if (value > 0) return 'pnl-positive';
  if (value < 0) return 'pnl-negative';
  return 'pnl-neutral';
}

export function getPnLBadgeClass(value: number): string {
  if (value > 0) return 'badge-profit';
  if (value < 0) return 'badge-loss';
  return 'badge-neutral';
}

export function formatPnL(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatCurrencyFull(value)}`;
}

// ============================================================================
// STATUS HELPERS
// ============================================================================

export type PositionStatusType = 'active' | 'closed' | 'expired' | 'roll_due' | 'at_risk';

export function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'active':
      return 'badge-profit';
    case 'closed':
      return 'badge-neutral';
    case 'expired':
      return 'badge-warning';
    case 'roll_due':
      return 'badge-warning';
    case 'at_risk':
      return 'badge-loss';
    default:
      return 'badge-neutral';
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'closed':
      return 'Closed';
    case 'expired':
      return 'Expired';
    case 'roll_due':
      return 'Roll Due';
    case 'at_risk':
      return 'At Risk';
    default:
      return status;
  }
}

export function getPriorityBadgeClass(priority: string): string {
  switch (priority) {
    case 'critical':
      return 'priority-critical';
    case 'high':
      return 'priority-high';
    case 'medium':
      return 'priority-medium';
    case 'low':
      return 'priority-low';
    default:
      return 'badge-neutral';
  }
}

// ============================================================================
// OPTION FORMATTING
// ============================================================================

export function formatStrike(strike: number): string {
  if (strike >= 100) {
    return `$${Math.round(strike)}`;
  }
  return `$${strike.toFixed(1)}`;
}

export function formatOptionLeg(strike: number, expiration: string, type: 'call' | 'put' = 'call'): string {
  const exp = formatExpiration(expiration);
  return `${formatStrike(strike)}${type === 'call' ? 'c' : 'p'} ${exp}`;
}

export function formatDelta(delta: number): string {
  return `${Math.round(delta)}Δ`;
}

// ============================================================================
// GREEKS HELPERS
// ============================================================================

export function getGreeksHealthStatus(greeks: {
  net_delta: number;
  total_theta: number;
  vega_theta_ratio: number;
}): {
  delta: 'healthy' | 'warning' | 'danger';
  theta: 'healthy' | 'warning' | 'danger';
  vegaRatio: 'healthy' | 'warning' | 'danger';
} {
  // Delta: healthy if absolute value < 500
  const deltaAbs = Math.abs(greeks.net_delta);
  const deltaStatus = deltaAbs < 300 ? 'healthy' : deltaAbs < 600 ? 'warning' : 'danger';
  
  // Theta: healthy if positive (collecting theta)
  const thetaStatus = greeks.total_theta > 0 ? 'healthy' : greeks.total_theta > -50 ? 'warning' : 'danger';
  
  // Vega/Theta ratio: healthy if < 0.5
  const vegaStatus = greeks.vega_theta_ratio < 0.3 ? 'healthy' : greeks.vega_theta_ratio < 0.6 ? 'warning' : 'danger';
  
  return {
    delta: deltaStatus,
    theta: thetaStatus,
    vegaRatio: vegaStatus,
  };
}

// ============================================================================
// INCOME VELOCITY HELPERS
// ============================================================================

export function getVelocityStatus(velocity: number): 'low' | 'target' | 'high' {
  if (velocity < 1.5) return 'low';
  if (velocity <= 2.5) return 'target';
  return 'high';
}

export function getVelocityColor(velocity: number): string {
  const status = getVelocityStatus(velocity);
  switch (status) {
    case 'low':
      return 'var(--warning)';
    case 'target':
      return 'var(--profit)';
    case 'high':
      return 'var(--info)';
  }
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export function getScoreColor(score: number): string {
  if (score >= 80) return 'var(--profit)';
  if (score >= 60) return 'var(--warning)';
  return 'var(--loss)';
}

export function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Poor';
}

// ============================================================================
// LOCAL STORAGE HELPERS
// ============================================================================

export function getLocalStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function setLocalStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    console.error('Failed to save to localStorage');
  }
}
