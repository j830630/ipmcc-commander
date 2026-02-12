'use client';

import { useState, useEffect } from 'react';
import { 
  Calendar, 
  RefreshCw, 
  AlertTriangle, 
  Globe,
  Clock,
  Filter,
  ChevronDown,
  ChevronRight,
  Flame
} from 'lucide-react';
import { TradingViewEconomicCalendar } from '@/components/tradingview-widgets';

interface EconomicEvent {
  id?: string;
  time: string;
  country: string;
  event: string;
  impact: 'high' | 'medium' | 'low';
  impact_color: string;
  actual?: number | string;
  estimate?: number | string;
  previous?: number | string;
  unit?: string;
  currency: string;
}

interface CalendarData {
  events: EconomicEvent[];
  grouped_by_date: Record<string, EconomicEvent[]>;
  total_count: number;
  high_impact_count: number;
  from_date: string;
  to_date: string;
  timestamp: string;
  error?: string;
}

const COUNTRIES = [
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'EU', name: 'Eurozone', flag: '🇪🇺' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
];

function ImpactBadge({ impact }: { impact: string }) {
  const colors = {
    high: 'bg-red-500',
    medium: 'bg-orange-500',
    low: 'bg-yellow-500'
  };
  
  return (
    <div className="flex items-center gap-1">
      <div className={`w-2 h-2 rounded-full ${colors[impact as keyof typeof colors] || 'bg-gray-500'}`} />
      <span className="text-xs capitalize">{impact}</span>
    </div>
  );
}

function EventRow({ event }: { event: EconomicEvent }) {
  const timeStr = event.time ? new Date(event.time).toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  }) : '--:--';

  const country = COUNTRIES.find(c => c.code === event.country);

  return (
    <tr className="border-b border-border hover:bg-muted/50 transition-colors">
      <td className="py-3 px-4 text-sm font-mono">{timeStr}</td>
      <td className="py-3 px-4">
        <span className="text-lg" title={country?.name || event.country}>
          {country?.flag || '🌐'}
        </span>
      </td>
      <td className="py-3 px-4">
        <ImpactBadge impact={event.impact} />
      </td>
      <td className="py-3 px-4">
        <div>
          <p className="font-medium">{event.event}</p>
          {event.unit && <p className="text-xs text-muted-foreground">{event.unit}</p>}
        </div>
      </td>
      <td className="py-3 px-4 text-center font-mono">
        {event.actual !== null && event.actual !== undefined ? (
          <span className="font-bold text-foreground">{event.actual}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </td>
      <td className="py-3 px-4 text-center font-mono text-muted-foreground">
        {event.estimate !== null && event.estimate !== undefined ? event.estimate : '-'}
      </td>
      <td className="py-3 px-4 text-center font-mono text-muted-foreground">
        {event.previous !== null && event.previous !== undefined ? event.previous : '-'}
      </td>
    </tr>
  );
}

function DateGroup({ date, events }: { date: string; events: EconomicEvent[] }) {
  const [expanded, setExpanded] = useState(true);
  
  const dateObj = new Date(date);
  const isToday = new Date().toDateString() === dateObj.toDateString();
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  
  const highImpactCount = events.filter(e => e.impact === 'high').length;

  return (
    <div className="mb-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
          isToday ? 'bg-primary/10 border border-primary/30' : 'bg-muted/50 hover:bg-muted'
        }`}
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold">{dayName}</span>
          <span className="text-muted-foreground">{dateStr}</span>
          {isToday && <span className="px-2 py-0.5 bg-primary text-white text-xs rounded-full">Today</span>}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">{events.length} events</span>
          {highImpactCount > 0 && (
            <span className="flex items-center gap-1 text-red-500">
              <Flame className="w-4 h-4" />
              {highImpactCount} high impact
            </span>
          )}
        </div>
      </button>

      {expanded && events.length > 0 && (
        <div className="mt-2 rounded-lg border border-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="py-2 px-4 text-left text-xs font-medium text-muted-foreground">Time</th>
                <th className="py-2 px-4 text-left text-xs font-medium text-muted-foreground">Country</th>
                <th className="py-2 px-4 text-left text-xs font-medium text-muted-foreground">Impact</th>
                <th className="py-2 px-4 text-left text-xs font-medium text-muted-foreground">Event</th>
                <th className="py-2 px-4 text-center text-xs font-medium text-muted-foreground">Actual</th>
                <th className="py-2 px-4 text-center text-xs font-medium text-muted-foreground">Forecast</th>
                <th className="py-2 px-4 text-center text-xs font-medium text-muted-foreground">Previous</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event, i) => (
                <EventRow key={i} event={event} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function CalendarPage() {
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'high'>('all');
  const [countryFilter, setCountryFilter] = useState<string>('');
  const [useWidget, setUseWidget] = useState(true);  // Default to TradingView widget

  const fetchCalendar = async () => {
    setLoading(true);
    try {
      let url = filter === 'high' ? '/api/v1/calendar/high-impact' : '/api/v1/calendar/events';
      if (countryFilter) {
        url += `?country=${countryFilter}`;
      }
      const response = await fetch(url);
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching calendar:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCalendar();
  }, [filter, countryFilter]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Calendar className="w-6 h-6 text-primary" />
            Economic Calendar
          </h1>
          <p className="text-muted-foreground mt-1">
            Track market-moving economic events and data releases
          </p>
        </div>
        <button 
          onClick={fetchCalendar}
          disabled={loading}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters:</span>
          </div>

          {/* Impact Filter */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-sm ${filter === 'all' ? 'bg-primary text-white' : 'bg-transparent'}`}
            >
              All Events
            </button>
            <button
              onClick={() => setFilter('high')}
              className={`px-3 py-1.5 text-sm flex items-center gap-1 ${filter === 'high' ? 'bg-primary text-white' : 'bg-transparent'}`}
            >
              <Flame className="w-3 h-3" />
              High Impact
            </button>
          </div>

          {/* Country Filter */}
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="input text-sm"
          >
            <option value="">All Countries</option>
            {COUNTRIES.map(c => (
              <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
            ))}
          </select>

          {/* View Toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden ml-auto">
            <button
              onClick={() => setUseWidget(false)}
              className={`px-3 py-1.5 text-sm ${!useWidget ? 'bg-primary text-white' : 'bg-transparent'}`}
            >
              List View
            </button>
            <button
              onClick={() => setUseWidget(true)}
              className={`px-3 py-1.5 text-sm ${useWidget ? 'bg-primary text-white' : 'bg-transparent'}`}
            >
              Widget
            </button>
          </div>
        </div>
      </div>

      {/* Important Events Note */}
      <div className="card p-4 bg-yellow-500/10 border-yellow-500/30">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-yellow-500">Key Events to Watch</h3>
            <p className="text-sm text-muted-foreground mt-1">
              High-impact events like FOMC, NFP, CPI, and GDP releases can cause significant market volatility.
              Avoid opening new positions 30 minutes before major releases.
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      {useWidget ? (
        <div className="card overflow-hidden">
          <TradingViewEconomicCalendar height={600} />
        </div>
      ) : loading ? (
        <div className="card p-8 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading calendar...</p>
        </div>
      ) : data?.error ? (
        <div className="card p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium">Error loading calendar</h3>
          <p className="text-muted-foreground mt-2">{data.error}</p>
          <p className="text-sm text-muted-foreground mt-4">
            Note: The free Finnhub API requires an API key. Set FINNHUB_API_KEY environment variable
            or use the TradingView widget view.
          </p>
        </div>
      ) : data?.grouped_by_date && Object.keys(data.grouped_by_date).length > 0 ? (
        <div>
          {/* Stats */}
          <div className="flex gap-4 mb-4 text-sm text-muted-foreground">
            <span>{data.total_count} total events</span>
            <span>•</span>
            <span className="text-red-500">{data.high_impact_count} high impact</span>
            <span>•</span>
            <span>{data.from_date} to {data.to_date}</span>
          </div>

          {/* Events by date */}
          {Object.entries(data.grouped_by_date)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, events]) => (
              <DateGroup key={date} date={date} events={events} />
            ))
          }
        </div>
      ) : (
        <div className="card p-8 text-center">
          <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">No events found</h3>
          <p className="text-muted-foreground mt-2">
            Try adjusting your filters or check back later.
          </p>
        </div>
      )}
    </div>
  );
}
