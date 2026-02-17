// ============================================================================
// IPMCC Commander - API Client
// ============================================================================

import type {
  Position,
  PositionSummary,
  PositionCreate,
  PositionClose,
  ShortCallCycle,
  CycleCreate,
  CycleClose,
  RollCycleRequest,
  MarketQuote,
  OptionsChain,
  TechnicalIndicators,
  ValidationResponse,
  IPMCCGreeks,
  DashboardSummary,
  ScenarioAnalysis,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

// Generic fetch wrapper with error handling
async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// ============================================================================
// POSITIONS API
// ============================================================================

export const positionsAPI = {
  list: async (status?: string, ticker?: string): Promise<PositionSummary[]> => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (ticker) params.set('ticker', ticker);
    const query = params.toString() ? `?${params.toString()}` : '';
    return fetchAPI<PositionSummary[]>(`/positions${query}`);
  },
  
  get: async (id: string): Promise<Position> => {
    return fetchAPI<Position>(`/positions/${id}`);
  },
  
  create: async (data: PositionCreate): Promise<Position> => {
    return fetchAPI<Position>('/positions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  update: async (id: string, data: Partial<Position>): Promise<Position> => {
    return fetchAPI<Position>(`/positions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  
  close: async (id: string, data: PositionClose): Promise<Position> => {
    return fetchAPI<Position>(`/positions/${id}/close`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  delete: async (id: string): Promise<{ deleted: boolean; id: string }> => {
    return fetchAPI(`/positions/${id}`, {
      method: 'DELETE',
    });
  },
};

// ============================================================================
// CYCLES API
// ============================================================================

export const cyclesAPI = {
  listForPosition: async (positionId: string, includeClosed = true): Promise<ShortCallCycle[]> => {
    const params = new URLSearchParams();
    params.set('include_closed', String(includeClosed));
    return fetchAPI<ShortCallCycle[]>(`/cycles/position/${positionId}?${params.toString()}`);
  },
  
  get: async (id: string): Promise<ShortCallCycle> => {
    return fetchAPI<ShortCallCycle>(`/cycles/${id}`);
  },
  
  create: async (data: CycleCreate): Promise<ShortCallCycle> => {
    return fetchAPI<ShortCallCycle>('/cycles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  update: async (id: string, data: Partial<ShortCallCycle>): Promise<ShortCallCycle> => {
    return fetchAPI<ShortCallCycle>(`/cycles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  
  close: async (id: string, data: CycleClose): Promise<ShortCallCycle> => {
    return fetchAPI<ShortCallCycle>(`/cycles/${id}/close`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  roll: async (id: string, data: RollCycleRequest): Promise<{
    success: boolean;
    closed_cycle: ShortCallCycle;
    new_cycle: ShortCallCycle;
    roll_summary: {
      close_cost: number;
      new_credit: number;
      net_credit: number;
      old_cycle_pnl: number;
    };
  }> => {
    return fetchAPI(`/cycles/${id}/roll`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  delete: async (id: string): Promise<{ deleted: boolean; id: string }> => {
    return fetchAPI(`/cycles/${id}`, {
      method: 'DELETE',
    });
  },
};

// ============================================================================
// MARKET DATA API
// ============================================================================

export const marketAPI = {
  getQuote: async (ticker: string): Promise<MarketQuote> => {
    return fetchAPI<MarketQuote>(`/market/quote/${ticker}`);
  },
  
  getOptionsChain: async (ticker: string, expiration?: string): Promise<OptionsChain> => {
    const params = expiration ? `?expiration=${expiration}` : '';
    return fetchAPI<OptionsChain>(`/market/chain/${ticker}${params}`);
  },
  
  getExpirations: async (ticker: string): Promise<{ ticker: string; expirations: string[]; count: number }> => {
    return fetchAPI(`/market/expirations/${ticker}`);
  },
  
  getHistory: async (ticker: string, period = '1y'): Promise<{
    ticker: string;
    period: string;
    data_points: number;
    data: Array<{
      date: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>;
  }> => {
    return fetchAPI(`/market/history/${ticker}?period=${period}`);
  },
  
  getTechnicals: async (ticker: string): Promise<TechnicalIndicators> => {
    return fetchAPI<TechnicalIndicators>(`/market/technicals/${ticker}`);
  },
  
  getLeapOptions: async (ticker: string): Promise<{
    ticker: string;
    current_price: number;
    leap_expirations: string[];
    sample_chain: OptionsChain;
  }> => {
    return fetchAPI(`/market/leaps/${ticker}`);
  },
  
  getWeeklyOptions: async (ticker: string): Promise<{
    ticker: string;
    current_price: number;
    weekly_expirations: string[];
    sample_chain: OptionsChain;
  }> => {
    return fetchAPI(`/market/weekly/${ticker}`);
  },
};

// ============================================================================
// ANALYSIS API
// ============================================================================

export const analyzeAPI = {
  validate: async (params: {
    ticker: string;
    long_strike: number;
    long_expiration: string;
    short_strike: number;
    short_expiration: string;
    quantity?: number;
  }): Promise<ValidationResponse> => {
    return fetchAPI<ValidationResponse>('/analyze/validate', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },
  
  calculateGreeks: async (params: {
    stock_price: number;
    strike: number;
    expiration: string;
    volatility: number;
    option_type?: string;
  }): Promise<{ greeks: any; error?: string }> => {
    return fetchAPI('/analyze/greeks', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },
  
  calculateIPMCCGreeks: async (params: {
    stock_price: number;
    long_strike: number;
    long_expiration: string;
    long_iv: number;
    short_strike: number;
    short_expiration: string;
    short_iv: number;
    quantity?: number;
  }): Promise<IPMCCGreeks> => {
    return fetchAPI<IPMCCGreeks>('/analyze/ipmcc-greeks', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },
  
  getScenario: async (params: {
    ticker: string;
    long_strike: number;
    long_expiration: string;
    short_strike: number;
    short_expiration: string;
    quantity?: number;
  }): Promise<ScenarioAnalysis> => {
    const query = new URLSearchParams({
      long_strike: String(params.long_strike),
      long_expiration: params.long_expiration,
      short_strike: String(params.short_strike),
      short_expiration: params.short_expiration,
      quantity: String(params.quantity || 1),
    });
    return fetchAPI<ScenarioAnalysis>(`/analyze/scenario/${params.ticker}?${query.toString()}`);
  },
  
  checkSignals: async (params: {
    position_id: string;
    long_value: number;
    long_entry_price: number;
    short_extrinsic_remaining: number;
    short_entry_extrinsic: number;
    long_dte: number;
    cumulative_short_pnl?: number;
  }): Promise<{
    position_id: string;
    signals: Array<{
      type: string;
      priority: string;
      message: string;
      action: string;
    }>;
    signal_count: number;
    has_critical: boolean;
    has_high: boolean;
  }> => {
    const query = new URLSearchParams({
      long_value: String(params.long_value),
      long_entry_price: String(params.long_entry_price),
      short_extrinsic_remaining: String(params.short_extrinsic_remaining),
      short_entry_extrinsic: String(params.short_entry_extrinsic),
      long_dte: String(params.long_dte),
      cumulative_short_pnl: String(params.cumulative_short_pnl || 0),
    });
    return fetchAPI(`/analyze/signals/${params.position_id}?${query.toString()}`);
  },
};

// ============================================================================
// DASHBOARD API
// ============================================================================

export const dashboardAPI = {
  getSummary: async (): Promise<DashboardSummary> => {
    return fetchAPI<DashboardSummary>('/dashboard/summary');
  },
  
  getGreeks: async (): Promise<any> => {
    return fetchAPI('/dashboard/greeks');
  },
  
  getAlerts: async (): Promise<{
    items: Array<any>;
    count: number;
    has_critical: boolean;
  }> => {
    return fetchAPI('/dashboard/alerts');
  },
  
  getVelocity: async (): Promise<any> => {
    return fetchAPI('/dashboard/velocity');
  },
};

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

export const api = {
  positions: positionsAPI,
  cycles: cyclesAPI,
  market: marketAPI,
  analyze: analyzeAPI,
  dashboard: dashboardAPI,
};

export default api;
