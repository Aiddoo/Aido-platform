import { useWeatherService } from '@src/bootstrap/providers/di-context';
import type { WeatherService } from '@src/features/weather/apis/weather.service';
import { isBusinessError, unwrap } from '@src/shared/errors';
import { type QueryClient, queryOptions } from '@tanstack/react-query';
import { pick } from 'es-toolkit';

import { WEATHER_QUERY_KEYS } from '../constants/weather-query-keys';
import type { LocationReading } from '../domains/weather-location.model';
import { type WeatherReport, WeatherReportPolicy } from '../domains/weather-report.model';
import { isLocationNotRegisteredError } from '../domains/weather.error';
import { useWeatherLocationRevision } from '../hooks/use-weather-location';

const REPORT_STALE_TIME_MS = 10 * 60_000;
/** 화면을 켜 둔 동안에도 분 단위 강수 안내가 어긋나지 않게 주기적으로 다시 받는다. */
const REPORT_REFETCH_INTERVAL_MS = 15 * 60_000;
/** 공급자 장애(WEATHER_1901)는 오래 기다리기보다 다시 시도 화면을 빨리 보여 준다. */
const REPORT_MAX_RETRIES = 2;

function shouldRetryReport(failureCount: number, error: unknown): boolean {
  return !isBusinessError(error) && failureCount < REPORT_MAX_RETRIES;
}

/**
 * 서버가 위치를 잃었다고(WEATHER_1902) 답하면 마지막으로 읽은 위치를 한 번만 다시 등록하고 다시 받는다.
 * 다시 등록도 실패하면 처음의 1902를 그대로 던져 위치 안내를 보여 준다.
 */
async function getReportWithRegistration(
  weatherService: WeatherService,
  client: QueryClient,
  signal: AbortSignal,
): Promise<WeatherReport> {
  const result = await weatherService.getReport(signal);
  if (result.ok || !isLocationNotRegisteredError(result.error)) {
    return unwrap(result);
  }
  const reading = client.getQueryData<LocationReading>(WEATHER_QUERY_KEYS.location());
  if (reading?.status !== 'located') {
    return unwrap(result);
  }
  const { latitude, longitude } = reading.registered;
  const registration = await weatherService.updateLocation({ latitude, longitude }, signal);
  if (!registration.ok) {
    return unwrap(result);
  }
  return unwrap(await weatherService.getReport(signal));
}

export function getWeatherReportQueryOptions(
  weatherService: WeatherService,
  { locationRevision }: { locationRevision: number },
) {
  return queryOptions({
    queryKey: WEATHER_QUERY_KEYS.report({ locationRevision }),
    queryFn: ({ signal, client }) => getReportWithRegistration(weatherService, client, signal),
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

/**
 * 블록마다 필요한 조각만 구독해 다른 조각이 바뀌어도 다시 그리지 않는다.
 * 모듈 수준 함수라 참조가 바뀌지 않아 TanStack이 select 결과를 재사용한다.
 */
export const WeatherReportSelect = {
  hero: (report: WeatherReport) => pick(report, ['location', 'current', 'daily', 'fetchedAt']),
  alerts: (report: WeatherReport) => pick(report, ['location', 'alerts']),
  precipitation: (report: WeatherReport) =>
    pick(report, ['location', 'nextHour', 'hourly', 'fetchedAt']),
  hourly: (report: WeatherReport) => pick(report, ['location', 'hourly']),
  briefing: (report: WeatherReport) => pick(report, ['location', 'hourly', 'fetchedAt']),
  daily: (report: WeatherReport) => pick(report, ['location', 'daily']),
  details: (report: WeatherReport) => pick(report, ['location', 'current', 'daily', 'airQuality']),
  attribution: (report: WeatherReport) => pick(report, ['location', 'attribution', 'fetchedAt']),
  scene: (report: WeatherReport) => WeatherReportPolicy.sceneInput(report.current),
} as const;
