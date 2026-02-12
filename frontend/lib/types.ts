// ============================================================================
// IPMCC Commander - TypeScript Types
// ============================================================================

// Position types
export interface Position {
  id: string;
  ticker: string;
  long_strike: number;
  long_expiration: string;
  entry_date: string;
  entry_price: number;
  entry_delta?: number;
  quantity: number;
  status: 'active' | 'closed' | 'expired';
  current_value?: number;
  current_delta?: number;
  close_date?: string;
  close_price?: number;
  close_reason?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  
  // Computed fields
  dte_remaining: number;
  capital_at_risk: number;
  leap_pnl: number;
  leap_pnl_percent: number;
  total_cycles: number;
  cumulative_premium: number;
  cumulative_short_pnl: number;
  net_pnl: number;
  net_pnl_percent: number;
  active_cycle?: CycleSummary;
}

export interface PositionSummary {
  id: string;
  ticker: string;
  long_strike: number;
  long_expiration: string;
  status: string;
  entry_price: number;
  entry_date: string;
  quantity?: number;
  current_value?: number;
  dte_remaining?: number;
  total_cycles: number;
  cumulative_premium: number;
  cumulative_short_pnl?: number;
  leap_pnl?: number;
  net_pnl: number;
  net_pnl_percent: number;
  active_short_strike?: number;
  active_short_expiration?: string;
  active_extrinsic?: number;
}

export interface PositionCreate {
  ticker: string;
  long_strike: number;
  long_expiration: string;
  entry_date: string;
  entry_price: number;
  entry_delta?: number;
  quantity?: number;
  notes?: string;
}

export interface PositionClose {
  close_date: string;
  close_price: number;
  close_reason: string;
}

// Cycle types
export interface ShortCallCycle {
  id: string;
  position_id: string;
  cycle_number: number;
  short_strike: number;
  short_expiration: string;
  entry_date: string;
  entry_premium: number;
  entry_extrinsic: number;
  stock_price_at_entry?: number;
  close_date?: string;
  close_price?: number;
  realized_pnl?: number;
  close_reason?: string;
  stock_price_at_close?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  
  // Computed
  dte_remaining: number;
  is_open: boolean;
  is_profitable?: boolean;
  premium_captured_percent?: number;
}

export interface CycleSummary {
  id: string;
  cycle_number: number;
  short_strike: number;
  short_expiration: string;
  entry_premium: number;
  realized_pnl?: number;
  is_open: boolean;
}

export interface CycleCreate {
  position_id: string;
  short_strike: number;
  short_expiration: string;
  entry_date: string;
  entry_premium: number;
  entry_extrinsic: number;
  stock_price_at_entry?: number;
  notes?: string;
}

export interface CycleClose {
  close_date: string;
  close_price: number;
  close_reason: string;
  stock_price_at_close?: number;
}

export interface RollCycleRequest {
  close_price: number;
  close_date: string;
  stock_price_at_close?: number;
  new_short_strike: number;
  new_short_expiration: string;
  new_entry_premium: number;
  new_entry_extrinsic: number;
  stock_price_at_entry?: number;
  notes?: string;
}

// Market data types
export interface MarketQuote {
  ticker: string;
  price?: number;
  change?: number;
  change_percent?: number;
  volume?: number;
  market_cap?: number;
  name?: string;
  timestamp: string;
  error?: string;
}

export interface OptionContract {
  strike: number;
  last_price?: number;
  bid?: number;
  ask?: number;
  volume?: number;
  open_interest?: number;
  implied_volatility: number;
  in_the_money: boolean;
  contract_symbol?: string;
  option_type: string;
  intrinsic?: number;
  extrinsic?: number;
}

export interface OptionsChain {
  ticker: string;
  expiration: string;
  expirations_available: string[];
  underlying_price?: number;
  calls: OptionContract[];
  puts: OptionContract[];
  timestamp: string;
  error?: string;
}

export interface TechnicalIndicators {
  ticker: string;
  price: number;
  rsi_14: number;
  ema_21: number;
  ema_50: number;
  ema_200?: number;
  bb_upper: number;
  bb_lower: number;
  bb_middle: number;
  above_ema_21: boolean;
  above_ema_50: boolean;
  weekly_uptrend: boolean;
  timestamp: string;
  error?: string;
}

// Greeks types
export interface OptionGreeks {
  price: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  intrinsic: number;
  extrinsic: number;
  dte: number;
  iv: number;
}

export interface IPMCCGreeks {
  long: OptionGreeks;
  short: OptionGreeks;
  net: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
  };
  metrics: {
    capital_required: number;
    weekly_extrinsic: number;
    weeks_to_breakeven: number;
    theoretical_annual_roi: number;
    downside_vs_stock_percent: number;
    extrinsic_yield_percent: number;
  };
  error?: string;
}

// Validation types
export interface ValidationCheck {
  rule: string;
  passed: boolean;
  value?: number;
  target?: string;
  message: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  severity: 'warning' | 'info';
}

export interface ValidationMetrics {
  capital_required: number;
  weekly_extrinsic: number;
  weeks_to_payback: number;
  theoretical_annual_roi: number;
  breakeven_price: number;
  max_weekly_profit: number;
  downside_vs_stock: number;
  net_theta_daily: number;
  net_delta: number;
}

export interface ValidationResponse {
  valid: boolean;
  score: number;
  checks: Array<{
    name: string;
    passed: boolean;
    message: string;
    value?: number;
    target?: string;
  }>;
  warnings: string[];
  metrics: {
    capital_required: number;
    weekly_extrinsic: number;
    weeks_to_breakeven?: number;
    theoretical_annual_roi?: number;
    breakeven_price?: number;
    max_weekly_profit?: number;
    downside_vs_stock_percent?: number;
    net_theta?: number;
    net_delta?: number;
    extrinsic_yield_percent?: number;
  };
  error?: string;
}

// Dashboard types
export interface PortfolioGreeks {
  net_delta: number;
  total_theta: number;
  total_vega: number;
  vega_theta_ratio: number;
  position_count: number;
}

export interface IncomeVelocity {
  current_weekly: number;
  rolling_4_week: number;
  total_capital_deployed: number;
  weekly_extrinsic_target: number;
}

export interface ActionItem {
  priority: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  position_id: string;
  ticker: string;
  message: string;
  detail?: string;
}

export interface DashboardSummary {
  greeks: PortfolioGreeks;
  income_velocity: IncomeVelocity;
  action_items: ActionItem[];
  pnl_today: number;
  pnl_week: number;
  pnl_mtd: number;
  pnl_ytd: number;
  cumulative_extrinsic: number;
  active_positions: number;
  total_positions: number;
}

// Scenario analysis
export interface ScenarioPoint {
  stock_price: number;
  long_value: number;
  short_value: number;
  long_pnl: number;
  short_pnl: number;
  total_pnl: number;
}

export interface ScenarioAnalysis {
  ticker: string;
  current_price: number;
  entry_cost_per_share: number;
  entry_cost_total: number;
  breakeven: number;
  max_profit_at_expiry: number;
  scenarios: ScenarioPoint[];
}
