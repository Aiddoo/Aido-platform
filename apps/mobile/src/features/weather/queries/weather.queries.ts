import {
  useErrorReporter,
  useLocationGateway,
  useLogger,
  useWeatherService,
} from '@src/bootstrap/providers/di-context';
import { type Logger } from '@src/core/ports/logger';
import {
  resolveLocation,
  type WeatherLocationDependencies,
} from '@src/features/weather/apis/weather-location.service';
import { type WeatherService } from '@src/features/weather/apis/weather.service';
import { PERSISTED_QUERY_OPTIONS } from '@src/shared/constants/query-persistence';
import { getErrorMessage, isBusinessError, unwrap } from '@src/shared/errors';
import {
  type Query,
  type QueryClient,
  queryOptions,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { pick } from 'es-toolkit';

import { type WeatherSceneInput } from '../components/weather-scene/weather-scene';
import { WEATHER_LOG_EVENT } from '../constants/weather-log-events';
import { WEATHER_QUERY_KEYS } from '../constants/weather-query-keys';
import { WeatherLocationPolicy } from '../domains/weather-location.model';
import { isLocationNotRegisteredError } from '../domains/weather.error';
import {
  applyDevWeatherOverride,
  type DevWeatherOverride,
  useDevWeatherOverride,
} from '../hooks/use-dev-weather-override';
import { type LocationReading } from '../schemas/weather-location.schema';
import { type WeatherReport } from '../schemas/weather-report.schema';
import { removeOutdatedWeatherReports } from './weather-cache';

const LOCATION_STALE_TIME_MS = 30 * 60_000;

/** 권한이 없던 사용자가 설정에서 돌아오면 30분을 기다리지 않고 바로 다시 확인한다. */
function refetchOnFocus(query: Query<LocationReading, Error>) {
  return query.state.data?.status === 'located' ? true : 'always';
}

/**
 * 등록을 마쳤을 때 같은 리비전의 리포트를 아직 받는 중이면 그 요청을 기다려 서버가 쓴 위치와 비교한다.
 * fetchQuery는 진행 중인 요청이 있으면 새로 보내지 않고 그 요청을 기다린다. 리포트 실패는 리포트 경계가
 * 알리므로 여기서는 비교할 위치가 없는 것으로 보고 기록만 남긴다.
 */
async function readReportLocation(client: QueryClient, logger: Logger, revision: number) {
  const queryKey = WEATHER_QUERY_KEYS.report({ locationRevision: revision });
  const state = client.getQueryState<WeatherReport>(queryKey);
  if (state?.data == null && state?.fetchStatus === 'fetching') {
    const report = await client.fetchQuery<WeatherReport>({ queryKey }).catch((error) => {
      logger.info(WEATHER_LOG_EVENT.REPORT_LOCATION_READ_FAILED, {
        error: getErrorMessage(error),
      });
      return null;
    });
    return report?.location ?? null;
  }
  return state?.data?.location ?? null;
}

/**
 * 위치 읽기·등록을 이 query 안에서 하는 이유: 피드 배지·날씨 화면·안내가 같은 key를 구독하므로
 * 동시에 열려도 위치 읽기와 PUT이 한 번만 일어난다.
 * 리포트는 이 query를 기다리지 않고 서버에 저장된 위치로 먼저 받는다.
 */
function getWeatherLocationQueryOptions(dependencies: WeatherLocationDependencies) {
  return queryOptions({
    queryKey: WEATHER_QUERY_KEYS.location(),
    queryFn: ({ signal, client, queryKey }): Promise<LocationReading> =>
      resolveLocation(dependencies, {
        previous: client.getQueryData<LocationReading>(queryKey),
        signal,
        readReportLocation: (revision) => readReportLocation(client, dependencies.logger, revision),
      }),
    ...PERSISTED_QUERY_OPTIONS,
    staleTime: LOCATION_STALE_TIME_MS,
    gcTime: Infinity,
    /** 위치 읽기는 기기 안에서 끝나므로 오프라인에서도 실행하고, 등록 실패는 저장된 위치·안내 정책으로 넘긴다. */
    networkMode: 'offlineFirst',
    retry: false,
    refetchOnWindowFocus: refetchOnFocus,
  });
}

export function useGetWeatherLocationQueryOptions() {
  return getWeatherLocationQueryOptions({
    gateway: useLocationGateway(),
    weatherService: useWeatherService(),
    logger: useLogger(),
    errorReporter: useErrorReporter(),
  });
}

/** 날씨 블록이 같은 리포트 캐시를 고르도록 위치 리비전을 돌려준다. 위치를 읽는 동안에도 0으로 바로 받는다. */
export function useWeatherLocationRevision(): number {
  const { data } = useQuery(useGetWeatherLocationQueryOptions());
  return WeatherLocationPolicy.getReadingRevision(data);
}

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
