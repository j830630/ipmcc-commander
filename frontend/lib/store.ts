// ============================================================================
// IPMCC Commander - Zustand Store
// ============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  PositionSummary,
  Position,
  ShortCallCycle,
  DashboardSummary,
  MarketQuote,
} from './types';

// ============================================================================
// UI STORE - Theme, sidebar, modals
// ============================================================================

interface UIState {
  theme: 'dark' | 'light' | 'system';
  sidebarCollapsed: boolean;
  
  // Modal states
  newPositionModalOpen: boolean;
  newCycleModalOpen: boolean;
  rollModalOpen: boolean;
  closePositionModalOpen: boolean;
  
  // Currently selected items for modals
  selectedPositionId: string | null;
  selectedCycleId: string | null;
  
  // Actions
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  toggleSidebar: () => void;
  openNewPositionModal: () => void;
  closeNewPositionModal: () => void;
  openNewCycleModal: (positionId: string) => void;
  closeNewCycleModal: () => void;
  openRollModal: (positionId: string, cycleId: string) => void;
  closeRollModal: () => void;
  openClosePositionModal: (positionId: string) => void;
  closeClosePositionModal: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'dark',
      sidebarCollapsed: false,
      newPositionModalOpen: false,
      newCycleModalOpen: false,
      rollModalOpen: false,
      closePositionModalOpen: false,
      selectedPositionId: null,
      selectedCycleId: null,
      
      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      
      openNewPositionModal: () => set({ newPositionModalOpen: true }),
      closeNewPositionModal: () => set({ newPositionModalOpen: false }),
      
      openNewCycleModal: (positionId) => set({ 
        newCycleModalOpen: true, 
        selectedPositionId: positionId 
      }),
      closeNewCycleModal: () => set({ 
        newCycleModalOpen: false, 
        selectedPositionId: null 
      }),
      
      openRollModal: (positionId, cycleId) => set({ 
        rollModalOpen: true, 
        selectedPositionId: positionId,
        selectedCycleId: cycleId 
      }),
      closeRollModal: () => set({ 
        rollModalOpen: false, 
        selectedPositionId: null,
        selectedCycleId: null 
      }),
      
      openClosePositionModal: (positionId) => set({ 
        closePositionModalOpen: true, 
        selectedPositionId: positionId 
      }),
      closeClosePositionModal: () => set({ 
        closePositionModalOpen: false, 
        selectedPositionId: null 
      }),
    }),
    {
      name: 'ipmcc-ui-store',
      partialize: (state) => ({ 
        theme: state.theme, 
        sidebarCollapsed: state.sidebarCollapsed 
      }),
    }
  )
);

// ============================================================================
// POSITIONS STORE - Cached position data
// ============================================================================

interface PositionsState {
  positions: PositionSummary[];
  selectedPosition: Position | null;
  cycles: ShortCallCycle[];
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;
  
  // Actions
  setPositions: (positions: PositionSummary[]) => void;
  setSelectedPosition: (position: Position | null) => void;
  setCycles: (cycles: ShortCallCycle[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updatePosition: (id: string, updates: Partial<PositionSummary>) => void;
  removePosition: (id: string) => void;
  addPosition: (position: PositionSummary) => void;
}

export const usePositionsStore = create<PositionsState>()((set, get) => ({
  positions: [],
  selectedPosition: null,
  cycles: [],
  isLoading: false,
  error: null,
  lastFetched: null,
  
  setPositions: (positions) => set({ 
    positions, 
    lastFetched: Date.now(),
    error: null 
  }),
  
  setSelectedPosition: (position) => set({ selectedPosition: position }),
  
  setCycles: (cycles) => set({ cycles }),
  
  setLoading: (isLoading) => set({ isLoading }),
  
  setError: (error) => set({ error, isLoading: false }),
  
  updatePosition: (id, updates) => set((state) => ({
    positions: state.positions.map((p) => 
      p.id === id ? { ...p, ...updates } : p
    ),
  })),
  
  removePosition: (id) => set((state) => ({
    positions: state.positions.filter((p) => p.id !== id),
  })),
  
  addPosition: (position) => set((state) => ({
    positions: [position, ...state.positions],
  })),
}));

// ============================================================================
// DASHBOARD STORE - Cached dashboard data
// ============================================================================

interface DashboardState {
  summary: DashboardSummary | null;
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;
  
  // Actions
  setSummary: (summary: DashboardSummary) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useDashboardStore = create<DashboardState>()((set) => ({
  summary: null,
  isLoading: false,
  error: null,
  lastFetched: null,
  
  setSummary: (summary) => set({ 
    summary, 
    lastFetched: Date.now(),
    error: null,
    isLoading: false 
  }),
  
  setLoading: (isLoading) => set({ isLoading }),
  
  setError: (error) => set({ error, isLoading: false }),
}));

// ============================================================================
// MARKET DATA STORE - Cached quotes and chains
// ============================================================================

interface MarketDataState {
  quotes: Record<string, MarketQuote>;
  quoteFetchTimes: Record<string, number>;
  
  // Actions
  setQuote: (ticker: string, quote: MarketQuote) => void;
  getQuote: (ticker: string) => MarketQuote | undefined;
  isQuoteStale: (ticker: string, maxAge?: number) => boolean;
}

export const useMarketDataStore = create<MarketDataState>()((set, get) => ({
  quotes: {},
  quoteFetchTimes: {},
  
  setQuote: (ticker, quote) => set((state) => ({
    quotes: { ...state.quotes, [ticker.toUpperCase()]: quote },
    quoteFetchTimes: { ...state.quoteFetchTimes, [ticker.toUpperCase()]: Date.now() },
  })),
  
  getQuote: (ticker) => get().quotes[ticker.toUpperCase()],
  
  isQuoteStale: (ticker, maxAge = 60000) => {
    const fetchTime = get().quoteFetchTimes[ticker.toUpperCase()];
    if (!fetchTime) return true;
    return Date.now() - fetchTime > maxAge;
  },
}));

// ============================================================================
// TRADE LAB STORE - Form state for trade analysis
// ============================================================================

interface TradeLabState {
  ticker: string;
  stockPrice: number | null;
  
  // Long leg
  longStrike: number | null;
  longExpiration: string;
  longDelta: number | null;
  longIV: number | null;
  
  // Short leg
  shortStrike: number | null;
  shortExpiration: string;
  shortDelta: number | null;
  shortIV: number | null;
  
  // Position
  quantity: number;
  
  // Actions
  setTicker: (ticker: string) => void;
  setStockPrice: (price: number | null) => void;
  setLongConfig: (config: Partial<{
    strike: number;
    expiration: string;
    delta: number;
    iv: number;
  }>) => void;
  setShortConfig: (config: Partial<{
    strike: number;
    expiration: string;
    delta: number;
    iv: number;
  }>) => void;
  setQuantity: (quantity: number) => void;
  reset: () => void;
}

const tradeLabInitialState = {
  ticker: '',
  stockPrice: null,
  longStrike: null,
  longExpiration: '',
  longDelta: null,
  longIV: null,
  shortStrike: null,
  shortExpiration: '',
  shortDelta: null,
  shortIV: null,
  quantity: 1,
};

export const useTradeLabStore = create<TradeLabState>()((set) => ({
  ...tradeLabInitialState,
  
  setTicker: (ticker) => set({ ticker: ticker.toUpperCase() }),
  
  setStockPrice: (stockPrice) => set({ stockPrice }),
  
  setLongConfig: (config) => set((state) => ({
    longStrike: config.strike ?? state.longStrike,
    longExpiration: config.expiration ?? state.longExpiration,
    longDelta: config.delta ?? state.longDelta,
    longIV: config.iv ?? state.longIV,
  })),
  
  setShortConfig: (config) => set((state) => ({
    shortStrike: config.strike ?? state.shortStrike,
    shortExpiration: config.expiration ?? state.shortExpiration,
    shortDelta: config.delta ?? state.shortDelta,
    shortIV: config.iv ?? state.shortIV,
  })),
  
  setQuantity: (quantity) => set({ quantity }),
  
  reset: () => set(tradeLabInitialState),
}));

// ============================================================================
// SETTINGS STORE - User preferences
// ============================================================================

interface SettingsState {
  defaultLongDelta: number;
  defaultShortDTE: number;
  rollAlertThreshold: number;
  emergencyExitThreshold: number;
  profitTargetThreshold: number;
  
  // Actions
  updateSettings: (settings: Partial<Omit<SettingsState, 'updateSettings'>>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      defaultLongDelta: 80,
      defaultShortDTE: 7,
      rollAlertThreshold: 0.20,
      emergencyExitThreshold: 0.30,
      profitTargetThreshold: 0.50,
      
      updateSettings: (settings) => set((state) => ({ ...state, ...settings })),
    }),
    {
      name: 'ipmcc-settings-store',
    }
  )
);
