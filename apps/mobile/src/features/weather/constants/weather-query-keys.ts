import type { CurrentWeather } from '../domains/weather-report.model';

export const WEATHER_QUERY_KEYS = {
  all: ['weather'] as const,
  reports: () => [...WEATHER_QUERY_KEYS.all, 'report'] as const,
  report: (params: {
    locationRevision: number;
    devOverride?: Pick<CurrentWeather, 'condition' | 'isDaylight'>;
  }) => [...WEATHER_QUERY_KEYS.reports(), params] as const,
  location: () => [...WEATHER_QUERY_KEYS.all, 'location'] as const,
} as const;
