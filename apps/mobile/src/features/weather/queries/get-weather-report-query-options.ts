import { useWeatherService } from '@src/bootstrap/providers/di-context';
import type { WeatherService } from '@src/features/weather/apis/weather.service';
import { isBusinessError, unwrap } from '@src/shared/errors';
import { queryOptions } from '@tanstack/react-query';

import { WEATHER_QUERY_KEYS } from '../constants/weather-query-keys';
import { useWeatherLocationRevision } from '../hooks/use-weather-location';

const REPORT_STALE_TIME_MS = 10 * 60_000;
/** 화면을 켜 둔 동안에도 분 단위 강수 안내가 어긋나지 않게 주기적으로 다시 받는다. */
const REPORT_REFETCH_INTERVAL_MS = 15 * 60_000;
/** 공급자 장애(WEATHER_1901)는 오래 기다리기보다 다시 시도 화면을 빨리 보여 준다. */
const REPORT_MAX_RETRIES = 2;

function shouldRetryReport(failureCount: number, error: unknown): boolean {
  return !isBusinessError(error) && failureCount < REPORT_MAX_RETRIES;
}

export function getWeatherReportQueryOptions(
  weatherService: WeatherService,
  { locationRevision }: { locationRevision: string },
) {
  return queryOptions({
    queryKey: WEATHER_QUERY_KEYS.report({ locationRevision }),
    queryFn: async ({ signal }) => unwrap(await weatherService.getReport(signal)),
    staleTime: REPORT_STALE_TIME_MS,
    refetchInterval: REPORT_REFETCH_INTERVAL_MS,
    retry: shouldRetryReport,
  });
}

export function useGetWeatherReportQueryOptions() {
  return getWeatherReportQueryOptions(useWeatherService(), {
    locationRevision: useWeatherLocationRevision(),
  });
}
