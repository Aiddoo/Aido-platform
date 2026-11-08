import {
  useLogger,
  useWeatherLocationService,
  useWeatherService,
} from '@src/bootstrap/providers/di-context';
import { type Logger } from '@src/core/ports/logger';
import { PERSISTED_QUERY_OPTIONS } from '@src/shared/constants/query-persistence';
import { MINUTE_MS } from '@src/shared/constants/time-units';
import { getErrorMessage, isCodedError, unwrap } from '@src/shared/errors';
import {
  type Query,
  type QueryClient,
  queryOptions,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { pick } from 'es-toolkit';

import { WEATHER_LOG_EVENT } from '../constants/weather-log-events';
import { WEATHER_QUERY_KEYS } from '../constants/weather-query-keys';
import { WeatherLocationPolicy } from '../domains/weather-location.model';
import { type LocationReading } from '../domains/weather-location.model';
import { WeatherReportPolicy } from '../domains/weather-report.model';
import { type WeatherReport } from '../domains/weather-report.model';
import { withDevWeatherOverride, useDevWeatherOverride } from '../hooks/use-dev-weather-override';
import { type WeatherSceneInput } from '../utils/weather-scene.view-model';
import { removeOutdatedWeatherReports } from './weather-cache';

const LOCATION_STALE_TIME_MS = 30 * MINUTE_MS;

/** 권한이 없던 사용자가 설정에서 돌아오면 30분을 기다리지 않고 바로 다시 확인한다. */
function refetchOnFocus(query: Query<LocationReading, Error>) {
  return query.state.data?.status === 'located' ? true : 'always';
}

/**
 * 등록을 마쳤을 때 같은 리비전의 리포트를 아직 받는 중이면 그 요청을 기다려 서버가 쓴 위치와 비교한다.
 * fetchQuery는 진행 중인 요청이 있으면 새로 보내지 않고 그 요청을 기다린다. 리포트 실패는 리포트 경계가
 * 알리므로 여기서는 비교할 위치가 없는 것으로 보고 기록만 남긴다.
 */
async function findReportLocation(client: QueryClient, logger: Logger, revision: number) {
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
export function useGetWeatherLocationQueryOptions() {
  const weatherLocationService = useWeatherLocationService();
  const logger = useLogger();

  return queryOptions({
    queryKey: WEATHER_QUERY_KEYS.location(),
    queryFn: async ({ signal, client, queryKey }): Promise<LocationReading> =>
      unwrap(
        await weatherLocationService.resolveLocation({
          previous: client.getQueryData<LocationReading>(queryKey),
          signal,
          findReportLocation: (revision) => findReportLocation(client, logger, revision),
        }),
      ),
    ...PERSISTED_QUERY_OPTIONS,
    staleTime: LOCATION_STALE_TIME_MS,
    gcTime: Infinity,
    /** 위치 읽기는 기기 안에서 끝나므로 오프라인에서도 실행하고, 등록 실패는 저장된 위치·안내 정책으로 넘긴다. */
    networkMode: 'offlineFirst',
    retry: false,
    refetchOnWindowFocus: refetchOnFocus,
  });
}

/** 날씨 블록이 같은 리포트 캐시를 고르도록 위치 리비전을 돌려준다. 위치를 읽는 동안에도 0으로 바로 받는다. */
export function useWeatherLocationRevision(): number {
  const { data } = useQuery(useGetWeatherLocationQueryOptions());
  return WeatherLocationPolicy.getReadingRevision(data);
}

const REPORT_STALE_TIME_MS = 10 * MINUTE_MS;
/** 화면을 켜 둔 동안에도 분 단위 강수 안내가 어긋나지 않게 주기적으로 다시 받는다. */
const REPORT_REFETCH_INTERVAL_MS = 15 * MINUTE_MS;
/** 공급자 장애(WEATHER_1901)는 오래 기다리기보다 다시 시도 화면을 빨리 보여 준다. */
const REPORT_MAX_RETRIES = 2;

function shouldRetryReport(failureCount: number, error: unknown): boolean {
  return !isCodedError(error) && failureCount < REPORT_MAX_RETRIES;
}

/**
 * 개발 QA의 날씨 덮어쓰기는 실제 리포트 캐시에서 만들어 새로 요청하지 않고, 실제 리포트와 키를 나누며
 * 기기에 저장하지 않는다. 실제 리포트가 이미 있으면 처음부터 그 값으로 그려 화면이 로딩으로 돌아가지 않는다.
 */
export function useGetWeatherReportQueryOptions() {
  const weatherService = useWeatherService();
  const locationRevision = useWeatherLocationRevision();
  const client = useQueryClient();
  const [devOverride] = useDevWeatherOverride();

  const reportOptions = queryOptions({
    queryKey: WEATHER_QUERY_KEYS.report({ locationRevision }),
    queryFn: async ({ signal, client: queryClient }) => {
      // 새 위치의 리포트를 받기 시작하면 화면은 이미 이 리비전을 보므로 이전 위치의 리포트는 기기 캐시에 남기지 않는다
      removeOutdatedWeatherReports(queryClient, { locationRevision });
      const reading = queryClient.getQueryData<LocationReading>(WEATHER_QUERY_KEYS.location());
      return unwrap(
        await weatherService.getReportWithReregistration({
          lastRegistered:
            reading?.status === 'located'
              ? pick(reading.registered, ['latitude', 'longitude'])
              : null,
          signal,
        }),
      );
    },
    staleTime: REPORT_STALE_TIME_MS,
    refetchInterval: REPORT_REFETCH_INTERVAL_MS,
    retry: shouldRetryReport,
    ...PERSISTED_QUERY_OPTIONS,
  });
  if (devOverride == null) {
    return reportOptions;
  }

  const cached = client.getQueryData(reportOptions.queryKey);
  return queryOptions({
    queryKey: WEATHER_QUERY_KEYS.report({ locationRevision, devOverride }),
    queryFn: async ({ client: queryClient }) =>
      withDevWeatherOverride(await queryClient.ensureQueryData(reportOptions), devOverride),
    initialData: cached == null ? undefined : withDevWeatherOverride(cached, devOverride),
    staleTime: REPORT_STALE_TIME_MS,
    retry: shouldRetryReport,
  });
}

function selectHero(report: WeatherReport) {
  return pick(report, ['location', 'current', 'daily', 'fetchedAt']);
}

function selectAlerts(report: WeatherReport) {
  return pick(report, ['location', 'alerts']);
}

function selectPrecipitation(report: WeatherReport) {
  return pick(report, ['location', 'nextHour', 'hourly', 'fetchedAt']);
}

function selectHourly(report: WeatherReport) {
  return pick(report, ['location', 'current', 'hourly', 'daily']);
}

function selectBriefing(report: WeatherReport) {
  return pick(report, ['location', 'hourly', 'daily', 'fetchedAt']);
}

function selectDaily(report: WeatherReport) {
  return pick(report, ['location', 'daily', 'current']);
}

function selectDetails(report: WeatherReport) {
  return pick(report, ['location', 'current', 'hourly']);
}

function selectSunMoon(report: WeatherReport) {
  return pick(report, ['location', 'current', 'daily']);
}

function selectAirQuality(report: WeatherReport) {
  return report.airQuality;
}

function selectAttribution(report: WeatherReport) {
  return pick(report, ['location', 'attribution', 'fetchedAt']);
}

function selectScene(report: WeatherReport): WeatherSceneInput {
  return {
    ...pick(report.current, [
      'condition',
      'isDaylight',
      'precipitationIntensity',
      'cloudCover',
      'windSpeed',
    ]),
    // 해·달 카드와 같은 서버 위상을 쓴다. 받은 시각의 오늘(그 위치 시간대)이다
    moonPhase:
      WeatherReportPolicy.findTodayOrFirstForecast(report, report.fetchedAt)?.moonPhase ?? null,
    latitude: report.location.latitude,
  };
}

/**
 * 블록마다 필요한 조각만 구독해 다른 조각이 바뀌어도 다시 그리지 않는다.
 * 모듈 수준 함수라 참조가 바뀌지 않아 TanStack이 select 결과를 재사용한다.
 */
export const WeatherReportSelect = {
  hero: selectHero,
  alerts: selectAlerts,
  precipitation: selectPrecipitation,
  hourly: selectHourly,
  briefing: selectBriefing,
  daily: selectDaily,
  details: selectDetails,
  sunMoon: selectSunMoon,
  airQuality: selectAirQuality,
  attribution: selectAttribution,
  scene: selectScene,
} as const;
