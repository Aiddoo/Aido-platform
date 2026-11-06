import { useWeatherService } from '@src/bootstrap/providers/di-context';
import type { WeatherService } from '@src/features/weather/apis/weather.service';
import { PERSISTED_QUERY_OPTIONS } from '@src/shared/constants/query-persistence';
import { isBusinessError, unwrap } from '@src/shared/errors';
import { type QueryClient, queryOptions, useQueryClient } from '@tanstack/react-query';
import { pick } from 'es-toolkit';

import type { WeatherSceneInput } from '../components/weather-scene/weather-scene';
import { WEATHER_QUERY_KEYS } from '../constants/weather-query-keys';
import { isLocationNotRegisteredError } from '../domains/weather.error';
import {
  applyDevWeatherOverride,
  type DevWeatherOverride,
  useDevWeatherOverride,
} from '../hooks/use-dev-weather-override';
import type { LocationReading } from '../schemas/weather-location.schema';
import type { WeatherReport } from '../schemas/weather-report.schema';
import { useWeatherLocationRevision } from './get-weather-location-query-options';
import { removeOutdatedWeatherReports } from './weather-cache';

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
    queryFn: ({ signal, client }) => {
      // 새 위치의 리포트를 받기 시작하면 화면은 이미 이 리비전을 보므로 이전 위치의 리포트는 기기 캐시에 남기지 않는다
      removeOutdatedWeatherReports(client, { locationRevision });
      return getReportWithRegistration(weatherService, client, signal);
    },
    staleTime: REPORT_STALE_TIME_MS,
    refetchInterval: REPORT_REFETCH_INTERVAL_MS,
    retry: shouldRetryReport,
    ...PERSISTED_QUERY_OPTIONS,
  });
}

/**
 * 개발 QA용으로 날씨만 바꾼 리포트. 실제 리포트 캐시에서 만들어 새로 요청하지 않고, 실제 리포트와 키를 나누며
 * 기기에 저장하지 않는다. 실제 리포트가 이미 있으면 처음부터 그 값으로 그려 화면이 로딩으로 돌아가지 않는다.
 */
function getDevWeatherReportQueryOptions(
  weatherService: WeatherService,
  client: QueryClient,
  { locationRevision, devOverride }: { locationRevision: number; devOverride: DevWeatherOverride },
) {
  const reportOptions = getWeatherReportQueryOptions(weatherService, { locationRevision });
  const cached = client.getQueryData(reportOptions.queryKey);
  return queryOptions({
    queryKey: WEATHER_QUERY_KEYS.report({ locationRevision, devOverride }),
    queryFn: async ({ client: queryClient }) =>
      applyDevWeatherOverride(await queryClient.ensureQueryData(reportOptions), devOverride),
    initialData: cached == null ? undefined : applyDevWeatherOverride(cached, devOverride),
    staleTime: REPORT_STALE_TIME_MS,
    retry: shouldRetryReport,
  });
}

export function useGetWeatherReportQueryOptions() {
  const weatherService = useWeatherService();
  const locationRevision = useWeatherLocationRevision();
  const client = useQueryClient();
  const devOverride = useDevWeatherOverride();
  return devOverride == null
    ? getWeatherReportQueryOptions(weatherService, { locationRevision })
    : getDevWeatherReportQueryOptions(weatherService, client, { locationRevision, devOverride });
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
  hourly: (report: WeatherReport) => pick(report, ['location', 'current', 'hourly', 'daily']),
  briefing: (report: WeatherReport) => pick(report, ['location', 'hourly', 'daily', 'fetchedAt']),
  daily: (report: WeatherReport) => pick(report, ['location', 'daily', 'current']),
  details: (report: WeatherReport) => pick(report, ['location', 'current', 'hourly']),
  sunMoon: (report: WeatherReport) => pick(report, ['location', 'current', 'daily']),
  airQuality: (report: WeatherReport) => report.airQuality,
  attribution: (report: WeatherReport) => pick(report, ['location', 'attribution', 'fetchedAt']),
  scene: (report: WeatherReport): WeatherSceneInput => ({
    ...pick(report.current, [
      'condition',
      'isDaylight',
      'precipitationIntensity',
      'cloudCover',
      'windSpeed',
    ]),
    observedAt: report.fetchedAt,
    latitude: report.location.latitude,
  }),
} as const;
