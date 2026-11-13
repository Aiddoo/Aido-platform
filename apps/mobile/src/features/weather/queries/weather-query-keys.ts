import { queryOptions } from '@tanstack/react-query';

import type { LocationReading } from '../domains/weather-location.model';
import type { WeatherReport } from '../domains/weather-report.model';
import type { WeatherReportQueryKey } from '../schemas/weather-report-query-key.schema';

export const WEATHER_QUERY_KEYS = {
  all: ['weather'] as const,
  reports: () => [...WEATHER_QUERY_KEYS.all, 'report'] as const,
  report: (params: WeatherReportQueryKey) =>
    queryOptions<WeatherReport>({ queryKey: [...WEATHER_QUERY_KEYS.reports(), params] }).queryKey,
  /** 기기 위치는 OS 상태라 `['device', …]` 루트에 둬 날씨 무효화에 휩쓸려 위치를 다시 읽지 않는다 */
  location: () => queryOptions<LocationReading>({ queryKey: ['device', 'location'] }).queryKey,
} as const;
