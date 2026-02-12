'use client';

import { useEffect, useRef, useState } from 'react';

interface TradingViewChartProps {
  symbol?: string;
  interval?: string;
  theme?: 'dark' | 'light';
  height?: number;
  showToolbar?: boolean;
  showSymbolSearch?: boolean;
  onSymbolChange?: (symbol: string) => void;
}

export function TradingViewChart({
  symbol = 'SPY',
  interval = 'D',
  theme = 'dark',
  height = 400,
  showToolbar = true,
  showSymbolSearch = true,
  onSymbolChange
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentSymbol, setCurrentSymbol] = useState(symbol);
  const [inputSymbol, setInputSymbol] = useState(symbol);
  const widgetId = useRef(`tradingview_${Math.random().toString(36).substr(2, 9)}`);

  const handleSymbolChange = () => {
    const newSymbol = inputSymbol.toUpperCase().trim();
    if (newSymbol && newSymbol !== currentSymbol) {
      setCurrentSymbol(newSymbol);
      onSymbolChange?.(newSymbol);
    }
  };

  useEffect(() => {
    // Load TradingView script if not already loaded
    if (!document.getElementById('tradingview-script')) {
      const script = document.createElement('script');
      script.id = 'tradingview-script';
      script.src = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      document.head.appendChild(script);
    }

    // Wait for TradingView to load then create widget
    const initWidget = () => {
      if (containerRef.current && (window as any).TradingView) {
        // Clear previous widget
        containerRef.current.innerHTML = '';
        
        new (window as any).TradingView.widget({
          autosize: true,
          symbol: currentSymbol,
          interval: interval,
          timezone: 'America/New_York',
          theme: theme,
          style: '1', // Candles
          locale: 'en',
          toolbar_bg: theme === 'dark' ? '#1a1a2e' : '#f1f3f6',
          enable_publishing: false,
          allow_symbol_change: true,
          hide_top_toolbar: !showToolbar,
          hide_legend: false,
          save_image: false,
          container_id: widgetId.current,
          studies: [
            'MASimple@tv-basicstudies',
            'RSI@tv-basicstudies'
          ],
          disabled_features: [
            'use_localstorage_for_settings',
            'header_compare',
            'header_undo_redo',
            'header_screenshot',
            'header_fullscreen_button'
          ],
          enabled_features: [
            'hide_left_toolbar_by_default'
          ]
        });
      }
    };

    // Check if TradingView is loaded
    if ((window as any).TradingView) {
      initWidget();
    } else {
      const checkInterval = setInterval(() => {
        if ((window as any).TradingView) {
          clearInterval(checkInterval);
          initWidget();
        }
      }, 100);

      return () => clearInterval(checkInterval);
    }
  }, [currentSymbol, interval, theme, showToolbar]);

  return (
    <div className="flex flex-col gap-2">
      {showSymbolSearch && (
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={inputSymbol}
            onChange={(e) => setInputSymbol(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleSymbolChange()}
            placeholder="Enter symbol..."
            className="input flex-1 max-w-xs"
          />
          <button
            onClick={handleSymbolChange}
            className="btn-primary px-4 py-2"
          >
            Load Chart
          </button>
          <span className="text-sm text-muted-foreground">
            Current: <span className="font-mono font-bold text-foreground">{currentSymbol}</span>
          </span>
        </div>
      )}
      <div
        id={widgetId.current}
        ref={containerRef}
        style={{ height: `${height}px` }}
        className="rounded-lg overflow-hidden border border-border"
      />
    </div>
  );
}

// Mini chart widget (for dashboard cards)
export function TradingViewMiniChart({
  symbol = 'SPY',
  height = 200
}: {
  symbol: string;
  height?: number;
}) {
  const containerId = `mini_${symbol}_${Math.random().toString(36).substr(2, 9)}`;

  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="tradingview-widget-container" style="height:100%;width:100%">
        <div class="tradingview-widget-container__widget" style="height:100%;width:100%"></div>
      </div>
    `;

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol: symbol,
      width: '100%',
      height: '100%',
      locale: 'en',
      dateRange: '1D',
      colorTheme: 'dark',
      isTransparent: true,
      autosize: true,
      largeChartUrl: ''
    });

    container.querySelector('.tradingview-widget-container')?.appendChild(script);
  }, [symbol, containerId]);

  return <div id={containerId} style={{ height: `${height}px` }} />;
}

// Ticker tape widget
export function TradingViewTickerTape() {
  const containerId = useRef(`ticker_${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    const container = document.getElementById(containerId.current);
    if (!container) return;

    container.innerHTML = `
      <div class="tradingview-widget-container">
        <div class="tradingview-widget-container__widget"></div>
      </div>
    `;

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: [
        { proName: 'AMEX:SPY', title: 'S&P 500' },
        { proName: 'NASDAQ:QQQ', title: 'NASDAQ' },
        { proName: 'AMEX:DIA', title: 'Dow Jones' },
        { proName: 'AMEX:IWM', title: 'Russell 2000' },
        { proName: 'CBOE:VIX', title: 'VIX' },
        { proName: 'TVC:DXY', title: 'Dollar Index' },
        { proName: 'FX:AUDJPY', title: 'AUD/JPY' },
        { proName: 'FX:AUDUSD', title: 'AUD/USD' }
      ],
      showSymbolLogo: true,
      isTransparent: true,
      displayMode: 'adaptive',
      colorTheme: 'dark',
      locale: 'en'
    });

    container.querySelector('.tradingview-widget-container')?.appendChild(script);
  }, []);

  return <div id={containerId.current} className="w-full h-12" />;
}

// Market overview widget
export function TradingViewMarketOverview({ height = 400 }: { height?: number }) {
  const containerId = useRef(`overview_${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    const container = document.getElementById(containerId.current);
    if (!container) return;

    container.innerHTML = `
      <div class="tradingview-widget-container" style="height:100%;width:100%">
        <div class="tradingview-widget-container__widget" style="height:100%;width:100%"></div>
      </div>
    `;

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      colorTheme: 'dark',
      dateRange: '1D',
      showChart: true,
      locale: 'en',
      width: '100%',
      height: '100%',
      largeChartUrl: '',
      isTransparent: true,
      showSymbolLogo: true,
      showFloatingTooltip: true,
      plotLineColorGrowing: 'rgba(41, 98, 255, 1)',
      plotLineColorFalling: 'rgba(255, 0, 0, 1)',
      gridLineColor: 'rgba(42, 46, 57, 0)',
      scaleFontColor: 'rgba(134, 137, 147, 1)',
      belowLineFillColorGrowing: 'rgba(41, 98, 255, 0.12)',
      belowLineFillColorFalling: 'rgba(255, 0, 0, 0.12)',
      belowLineFillColorGrowingBottom: 'rgba(41, 98, 255, 0)',
      belowLineFillColorFallingBottom: 'rgba(255, 0, 0, 0)',
      symbolActiveColor: 'rgba(41, 98, 255, 0.12)',
      tabs: [
        {
          title: 'Indices',
          symbols: [
            { s: 'AMEX:SPY', d: 'S&P 500' },
            { s: 'NASDAQ:QQQ', d: 'NASDAQ 100' },
            { s: 'AMEX:DIA', d: 'Dow Jones' },
            { s: 'AMEX:IWM', d: 'Russell 2000' }
          ],
          originalTitle: 'Indices'
        },
        {
          title: 'Volatility',
          symbols: [
            { s: 'CBOE:VIX', d: 'VIX' },
            { s: 'AMEX:UVXY', d: 'UVXY' },
            { s: 'AMEX:SVXY', d: 'SVXY' }
          ],
          originalTitle: 'Volatility'
        },
        {
          title: 'Forex',
          symbols: [
            { s: 'FX:AUDJPY', d: 'AUD/JPY' },
            { s: 'FX:AUDUSD', d: 'AUD/USD' },
            { s: 'TVC:DXY', d: 'Dollar Index' },
            { s: 'FX:USDJPY', d: 'USD/JPY' }
          ],
          originalTitle: 'Forex'
        }
      ]
    });

    container.querySelector('.tradingview-widget-container')?.appendChild(script);
  }, []);

  return <div id={containerId.current} style={{ height: `${height}px` }} />;
}

// Economic calendar widget
export function TradingViewEconomicCalendar({ height = 400 }: { height?: number }) {
  const containerId = useRef(`calendar_${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    const container = document.getElementById(containerId.current);
    if (!container) return;

    container.innerHTML = `
      <div class="tradingview-widget-container" style="height:100%;width:100%">
        <div class="tradingview-widget-container__widget" style="height:100%;width:100%"></div>
      </div>
    `;

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-events.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      colorTheme: 'dark',
      isTransparent: true,
      width: '100%',
      height: '100%',
      locale: 'en',
      importanceFilter: '0,1',
      countryFilter: 'us,eu,gb,jp,au,ca'
    });

    container.querySelector('.tradingview-widget-container')?.appendChild(script);
  }, []);

  return <div id={containerId.current} style={{ height: `${height}px` }} />;
}
