import { queryOptions } from '@tanstack/react-query';

import type { LocationReading } from '../domains/weather-location.model';
import type { WeatherReport } from '../domains/weather-report.model';
import type { WeatherReportQueryKey } from '../schemas/weather-report-query-key.schema';

export const WEATHER_QUERY_KEYS = {
  all: ['weather'] as const,
  reports: () => [...WEATHER_QUERY_KEYS.all, 'report'] as const,
  report: (params: WeatherReportQueryKey) =>
    queryOptions<WeatherReport>({ queryKey: [...WEATHER_QUERY_KEYS.reports(), params] }).queryKey,
  location: () =>
    queryOptions<LocationReading>({ queryKey: [...WEATHER_QUERY_KEYS.all, 'location'] }).queryKey,
} as const;
