import { queryOptions } from '@tanstack/react-query';

import type { LocationReading } from '../domains/weather-location.model';
import type { WeatherReportQueryKey } from '../schemas/weather-report-query-key.schema';

export const WEATHER_QUERY_KEYS = {
  all: ['weather'] as const,
  reports: () => [...WEATHER_QUERY_KEYS.all, 'report'] as const,
  report: (params: WeatherReportQueryKey) => [...WEATHER_QUERY_KEYS.reports(), params] as const,
  // 캐시를 직접 읽고 쓰는 키는 데이터 타입을 붙여 getQueryData·setQueryData가 타입을 안다
  location: () =>
    queryOptions<LocationReading>({ queryKey: [...WEATHER_QUERY_KEYS.all, 'location'] }).queryKey,
} as const;
