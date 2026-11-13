import {
  useErrorReporter,
  useLogger,
  useWeatherLocationService,
  useWeatherApi,
} from '@src/bootstrap/providers/di-context';
import { type AppLogger } from '@src/core/ports/app-logger';
import { useGetDailyCompletionsQueryOptions } from '@src/features/planning/todo/queries/todo.queries';
import { PERSISTED_QUERY_OPTIONS } from '@src/shared/constants/query-persistence';
import { HOUR_MS, MINUTE_MS } from '@src/shared/constants/time-units';
import { addDaysToDateKey } from '@src/shared/date/date-key';
import { type Instant, toEpochMs } from '@src/shared/date/instant';
import { getErrorMessage, toError, unwrap } from '@src/shared/errors';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { shouldRetryQuery } from '@src/shared/query/query-retry';
import {
  type Query,
  type QueryClient,
  queryOptions,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { orderBy, pick } from 'es-toolkit';
import { match } from 'ts-pattern';

import { WEATHER_LOG_EVENT } from '../constants/weather-log-events';
import { FORECAST_DAYS } from '../constants/weather.constants';
import { getHourlySummary } from '../domains/weather-hourly.model';
import { WeatherLocationPolicy } from '../domains/weather-location.model';
import { type LocationReading } from '../domains/weather-location.model';
import {
  findTodayOrFirstForecast,
  type HourlyForecastEntry,
  WeatherReportPolicy,
} from '../domains/weather-report.model';
import { type WeatherReport } from '../domains/weather-report.model';
import { WEATHER_ERROR_CODE } from '../domains/weather.error';
import { useDevWeatherOverride } from '../hooks/use-dev-weather-override';
import { type UnexpectedLocationFailure } from '../services/weather-location.service';
import { withDevWeatherOverride } from '../utils/weather-dev-override.view-model';
import { type WeatherSceneInput } from '../utils/weather-scene.view-model';
import {
  findCachedReportLocation,
  getCachedWeatherLocation,
  getCachedWeatherReport,
  queryCachedWeatherReport,
  removeOutdatedWeatherReports,
} from './weather-cache';
import { WEATHER_QUERY_KEYS } from './weather-query-keys';

const LOCATION_STALE_TIME_MS = 30 * MINUTE_MS;

/** 권한이 없던 사용자가 설정에서 돌아오면 30분을 기다리지 않고 바로 다시 확인한다. */
function refetchOnFocus(query: Query<LocationReading, Error>) {
  return query.state.data?.status === 'located' ? true : 'always';
}

/** 리포트 실패는 리포트 경계가 알리므로 여기서는 비교할 위치가 없는 것으로 보고 기록만 남긴다 */
function findReportLocation(client: QueryClient, logger: AppLogger, locationRevision: number) {
  return findCachedReportLocation(client, {
    locationRevision,
    onReadFailed: (error) =>
      logger.info(WEATHER_LOG_EVENT.REPORT_LOCATION_READ_FAILED, {
        error: getErrorMessage(error),
      }),
  });
}

/** 피드 배지·날씨 화면·안내가 같은 key를 구독하므로 위치 읽기와 PUT을 여기서 해 한 번만 일어나게 한다 */
export function useGetWeatherLocationQueryOptions() {
  const weatherLocationService = useWeatherLocationService();
  const logger = useLogger();
  const errorReporter = useErrorReporter();

  const reportUnexpectedFailure = ({ step, error }: UnexpectedLocationFailure) =>
    errorReporter.captureException(
      toError(error),
      match(step)
        .with('read', () => ({
          feature: 'weather_location' as const,
          errorCode: WEATHER_ERROR_CODE.LOCATION_UNAVAILABLE,
        }))
        .with('register', () => ({ feature: 'weather_location' as const }))
        .exhaustive(),
    );

  return queryOptions({
    queryKey: WEATHER_QUERY_KEYS.location(),
    queryFn: async ({ signal, client }): Promise<LocationReading> =>
      unwrap(
        await weatherLocationService.resolveLocation({
          previous: getCachedWeatherLocation(client),
          signal,
          findReportLocation: (revision) => findReportLocation(client, logger, revision),
          onUnexpectedFailure: reportUnexpectedFailure,
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
  const { data: reading } = useQuery(useGetWeatherLocationQueryOptions());
  return WeatherLocationPolicy.getReadingRevision(reading);
}

const REPORT_STALE_TIME_MS = 10 * MINUTE_MS;
/** 화면을 켜 둔 동안에도 분 단위 강수 안내가 어긋나지 않게 주기적으로 다시 받는다. */
const REPORT_REFETCH_INTERVAL_MS = 15 * MINUTE_MS;
/** 공급자 장애(WEATHER_1901)는 오래 기다리기보다 다시 시도 화면을 빨리 보여 준다. */
const REPORT_MAX_RETRIES = 2;

function shouldRetryReport(failureCount: number, error: unknown): boolean {
  return failureCount < REPORT_MAX_RETRIES && shouldRetryQuery(failureCount, error);
}

/** 개발 QA 덮어쓰기는 실제 리포트 캐시로 만들어 새로 요청하지 않고, 키를 나눠 기기에 저장하지 않는다 */
export function useGetWeatherReportQueryOptions() {
  const weatherApi = useWeatherApi();
  const locationRevision = useWeatherLocationRevision();
  const client = useQueryClient();
  const [devOverride] = useDevWeatherOverride();

  const reportOptions = queryOptions({
    queryKey: WEATHER_QUERY_KEYS.report({ locationRevision }),
    queryFn: async ({ signal, client: queryClient }) => {
      // 새 위치의 리포트를 받기 시작하면 화면은 이미 이 리비전을 보므로 이전 위치의 리포트는 기기 캐시에 남기지 않는다
      removeOutdatedWeatherReports(queryClient, { locationRevision });
      const reading = getCachedWeatherLocation(queryClient);
      return unwrap(
        await weatherApi.getReportWithReregistration({
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

  const cached = getCachedWeatherReport(client, { locationRevision });
  return queryOptions({
    queryKey: WEATHER_QUERY_KEYS.report({ locationRevision, devOverride }),
    queryFn: async ({ client: queryClient }) =>
      withDevWeatherOverride(
        await queryCachedWeatherReport(queryClient, reportOptions),
        devOverride,
      ),
    initialData: cached == null ? undefined : withDevWeatherOverride(cached, devOverride),
    staleTime: REPORT_STALE_TIME_MS,
    retry: shouldRetryReport,
  });
}

/** 10일 예보에 할 일 점을 찍을 완료 기록. 화면의 prefetch와 예보 카드가 같은 키를 쓰게 범위를 한 곳에서 정한다 */
export function useGetForecastCompletionsQueryOptions() {
  const todayKey = useTodayKey();
  return useGetDailyCompletionsQueryOptions({
    startDate: todayKey,
    endDate: addDaysToDateKey(todayKey, FORECAST_DAYS - 1),
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

export type HourlyTimelineItem =
  | { kind: 'hour'; hour: HourlyForecastEntry; isNow: boolean }
  | { kind: 'sunrise' | 'sunset'; at: Instant };

function getTimelineTime(item: HourlyTimelineItem): number {
  return item.kind === 'hour' ? toEpochMs(item.hour.startsAt) : toEpochMs(item.at);
}

/** 남은 시간별 예보 사이에 그 범위 안의 일출·일몰 칸을 시각 순서로 끼워 넣는다. */
function toHourlyTimeline(
  report: Pick<WeatherReport, 'hourly' | 'daily'>,
  now: Instant,
): HourlyTimelineItem[] {
  const hours = WeatherReportPolicy.getUpcomingHours(report.hourly, now);
  const last = hours.at(-1);
  if (last == null) {
    return [];
  }
  const rangeEnd = toEpochMs(last.startsAt) + HOUR_MS;
  const isInRange = (date: Instant) =>
    toEpochMs(now) < toEpochMs(date) && toEpochMs(date) < rangeEnd;

  const hourItems = hours.map((hour, index): HourlyTimelineItem => ({
    kind: 'hour',
    hour,
    isNow: index === 0,
  }));
  const sunItems = report.daily.flatMap((day): HourlyTimelineItem[] => [
    ...(day.sunrise != null && isInRange(day.sunrise)
      ? [{ kind: 'sunrise' as const, at: day.sunrise }]
      : []),
    ...(day.sunset != null && isInRange(day.sunset)
      ? [{ kind: 'sunset' as const, at: day.sunset }]
      : []),
  ]);
  return orderBy([...hourItems, ...sunItems], [getTimelineTime], ['asc']);
}

/** 분마다 다시 골라도 칸이 같으면 구조 공유가 앞의 참조를 돌려준다 */
function selectHourly(report: WeatherReport, now: Instant) {
  return {
    location: report.location,
    timeline: toHourlyTimeline(report, now),
    summary: getHourlySummary(report, now),
  };
}

function selectBriefing(report: WeatherReport) {
  return pick(report, ['location', 'hourly', 'daily', 'fetchedAt', 'briefing']);
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
    moonPhase: findTodayOrFirstForecast(report, report.fetchedAt)?.moonPhase ?? null,
    latitude: report.location.latitude,
  };
}

/** 모듈 수준 함수라 참조가 바뀌지 않아 TanStack이 select 결과를 재사용한다 */
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
