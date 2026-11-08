import type { WeatherReportQueryKey } from '../schemas/weather-report-query-key.schema';

export const WEATHER_QUERY_KEYS = {
  all: ['weather'] as const,
  reports: () => [...WEATHER_QUERY_KEYS.all, 'report'] as const,
  report: (params: WeatherReportQueryKey) => [...WEATHER_QUERY_KEYS.reports(), params] as const,
  location: () => [...WEATHER_QUERY_KEYS.all, 'location'] as const,
} as const;
