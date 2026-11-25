import {
  useErrorReporter,
  useLogger,
  useWeatherLocationService,
  useWeatherApi,
} from '@src/bootstrap/providers/di-context';
import { type AppLogger } from '@src/core/ports/app-logger';
import {
  useGetDailyCompletionsInRangeQueriesOptions,
  usePrefetchDailyCompletionsInRange,
} from '@src/features/planning/todo/queries/todo.queries';
import { PERSISTED_QUERY_OPTIONS } from '@src/shared/constants/query-persistence';
import { DAY_MS, HOUR_MS, MINUTE_MS } from '@src/shared/constants/time-units';
import { getNowInstant } from '@src/shared/date/clock';
import { addDaysToDateKey, type DateKey } from '@src/shared/date/date-key';
import { fromEpochMs, type Instant, toEpochMs } from '@src/shared/date/instant';
import { getErrorMessage, reportUnexpectedError, toError, unwrap } from '@src/shared/errors';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useTodayKey } from '@src/shared/hooks/use-today-key';
import { shouldRetryQuery } from '@src/shared/query/query-retry';
import {
  type Query,
  type QueryClient,
  queryOptions,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { clamp, orderBy, pick } from 'es-toolkit';
import { match } from 'ts-pattern';

import { WEATHER_LOG_EVENT } from '../constants/weather-log-events';
import { FORECAST_DAYS } from '../constants/weather.constants';
import { type ForecastHour } from '../domains/forecast-hour.model';
import { type LocationReading, LocationReadingPolicy } from '../domains/location-reading.model';
import { type WeatherBriefingTodo } from '../domains/weather-briefing.model';
import { type WeatherReport, WeatherReportPolicy } from '../domains/weather-report.model';
import { WEATHER_ERROR_CODE } from '../domains/weather.error';
import { weatherDevParamsSchema } from '../schemas/weather-dev-params.schema';
import { type WeatherDevOverride } from '../schemas/weather-report-query-key.schema';
import { type WeatherRescheduleParams } from '../schemas/weather-reschedule-params.schema';
import { type UnexpectedLocationFailure } from '../services/weather-location.service';
import { type WeatherSceneInput, type WeatherSkyInput } from '../utils/weather-scene.view-model';
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
function refetchOnFocus(query: Query<LocationReading>) {
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

  // 위치 등록(PUT)은 4xx·연결 끊김도 올 수 있어 분류를 보고기에 맡긴다. 예상한 오류는 breadcrumb로 남는다
  const reportUnexpectedFailure = ({ step, error }: UnexpectedLocationFailure) =>
    match(step)
      .with('read', () =>
        reportUnexpectedError(errorReporter, error, 'weather_location', {
          errorCode: WEATHER_ERROR_CODE.LOCATION_UNAVAILABLE,
        }),
      )
      .with('register', () =>
        errorReporter.captureException(toError(error), { feature: 'weather_location' }),
      )
      .exhaustive();

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
  return LocationReadingPolicy.getRevision(reading);
}

/**
 * 리포트를 다시 묻기까지 기다리는 시간의 한도. 서버가 리포트를 다시 받기 시작하는 순간(expiresAt)까지 기다리되,
 * 만료가 지난 리포트는 1분 뒤에(서버도 공급자 실패를 1분 기억한다), 공급자 장애로 받은 마지막 리포트(만료 없음)는
 * 모든 기기가 1분마다 묻지 않게 5분 뒤에 묻는다. 먼 만료는 타이머 최대치(2^31-1ms)를 넘지 않게 하루로 줄인다
 */
const REPORT_REFRESH_LIMIT_MS = {
  expired: MINUTE_MS,
  withoutExpiry: 5 * MINUTE_MS,
  longest: DAY_MS,
} as const;

function getReportRefreshMs(report: WeatherReport, at: Instant): number {
  const shortestMs =
    report.expiresAt == null
      ? REPORT_REFRESH_LIMIT_MS.withoutExpiry
      : REPORT_REFRESH_LIMIT_MS.expired;
  return clamp(
    WeatherReportPolicy.getFreshForMs(report, at),
    shortestMs,
    REPORT_REFRESH_LIMIT_MS.longest,
  );
}

/** 받은 때부터 만료까지는 같은 리포트라 묻지 않는다. 리포트가 없으면 0이다 */
export function getReportStaleTimeMs(
  report: WeatherReport | undefined,
  dataUpdatedAt: Instant,
): number {
  return report == null ? 0 : getReportRefreshMs(report, dataUpdatedAt);
}

/** 화면을 켜 둔 동안에도 서버가 새 리포트를 받기 시작하는 순간에 다시 받는다. 리포트가 없으면 간격이 없다 */
export function getReportRefetchIntervalMs(
  report: WeatherReport | undefined,
  now: Instant,
): number | false {
  return report == null ? false : getReportRefreshMs(report, now);
}

function getReportStaleTime(query: Query<WeatherReport>): number {
  return getReportStaleTimeMs(query.state.data, fromEpochMs(query.state.dataUpdatedAt));
}

function getReportRefetchInterval(query: Query<WeatherReport>): number | false {
  return getReportRefetchIntervalMs(query.state.data, getNowInstant());
}

/** 공급자 장애(WEATHER_1901)는 오래 기다리기보다 다시 시도 화면을 빨리 보여 준다. */
const REPORT_MAX_RETRIES = 2;

function shouldRetryReport(failureCount: number, error: unknown): boolean {
  return failureCount < REPORT_MAX_RETRIES && shouldRetryQuery(failureCount, error);
}

/** 개발 빌드 QA용: `/weather?devScene=HAIL&devNight=1`로 연 날씨 화면에서만 지금 날씨를 바꿔 보여 준다. */
function useRouteDevOverride() {
  const [{ devScene, devNight }] = useRouteParams(weatherDevParamsSchema);
  // 둘 중 하나라도 낯선 값이면 덮어쓰지 않는다
  const override: WeatherDevOverride | null =
    devScene == null || devNight == null
      ? null
      : { condition: devScene, isDaylight: devNight === '0' };

  return [override] as const;
}

function useNoDevOverride() {
  const override: WeatherDevOverride | null = null;

  return [override] as const;
}

/**
 * 개발 빌드에서만 route를 읽는다. 인자로 넘기면 개발용 값이 호출부 17곳에 퍼진다.
 * 운영 번들에서는 `__DEV__`가 false로 치환되어 파라미터를 읽는 코드가 빠진다
 */
export const useWeatherDevOverride = __DEV__ ? useRouteDevOverride : useNoDevOverride;

/** 지금 날씨·시간별 예보(낮밤 포함)·오늘 예보가 모두 같은 날씨로 보이게 바꾼다. 다른 날과 수치는 실제 값을 둔다. */
function withDevOverride(report: WeatherReport, override: WeatherDevOverride): WeatherReport {
  const { condition } = override;
  return {
    ...report,
    current: { ...report.current, ...override },
    hourly: report.hourly.map((hour) => ({ ...hour, ...override })),
    daily: report.daily.map((day, index) =>
      index === 0
        ? {
            ...day,
            condition,
            restOfDay: day.restOfDay == null ? null : { ...day.restOfDay, condition },
          }
        : day,
    ),
  };
}

/** 개발 QA 덮어쓰기는 실제 리포트 캐시로 만들어 새로 요청하지 않고, 키를 나눠 기기에 저장하지 않는다 */
export function useGetWeatherReportQueryOptions() {
  const weatherApi = useWeatherApi();
  const locationRevision = useWeatherLocationRevision();
  const client = useQueryClient();
  const [devOverride] = useWeatherDevOverride();

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
    staleTime: getReportStaleTime,
    refetchInterval: getReportRefetchInterval,
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
      withDevOverride(await queryCachedWeatherReport(queryClient, reportOptions), devOverride),
    initialData: cached == null ? undefined : withDevOverride(cached, devOverride),
    staleTime: getReportStaleTime,
    retry: shouldRetryReport,
  });
}

/** 10일 예보에 할 일 점을 찍을 기간. 화면의 prefetch와 예보 카드가 같은 달 키를 쓰게 한 곳에서 정한다 */
function getForecastCompletionsRange(todayKey: DateKey) {
  return { startDate: todayKey, endDate: addDaysToDateKey(todayKey, FORECAST_DAYS - 1) };
}

export function useGetForecastCompletionsQueriesOptions() {
  return useGetDailyCompletionsInRangeQueriesOptions(getForecastCompletionsRange(useTodayKey()));
}

export function usePrefetchForecastCompletions() {
  usePrefetchDailyCompletionsInRange(getForecastCompletionsRange(useTodayKey()));
}

/** 지금 시각으로 고르는 칸의 select를 만든다. 분이 바뀌어 다시 골라도 값이 같으면 구조 공유가 앞의 참조를 돌려준다 */
function selectHero(now: Instant) {
  return (report: WeatherReport) => ({
    current: report.current,
    today: WeatherReportPolicy.findToday(report, now),
    isStale: WeatherReportPolicy.isStale(report, now),
    fetchedAt: report.fetchedAt,
  });
}

function selectAlerts(now: Instant) {
  return (report: WeatherReport) => ({
    timezone: WeatherReportPolicy.getTimezone(report),
    alerts: WeatherReportPolicy.getActiveAlerts(report, now),
  });
}

function selectPrecipitation(now: Instant) {
  return (report: WeatherReport) => ({
    timezone: WeatherReportPolicy.getTimezone(report),
    isNowcastExpired: WeatherReportPolicy.isNowcastExpired(report, now),
    nextHour: report.nextHour,
    hourlyOutlook: WeatherReportPolicy.findHourlyPrecipitationOutlook(report, now),
    window: WeatherReportPolicy.getPrecipitationWindow(report, now),
  });
}

export type HourlyTimelineItem =
  | { kind: 'hour'; hour: ForecastHour; isNow: boolean }
  | { kind: 'sunrise' | 'sunset'; at: Instant };

function getTimelineTime(item: HourlyTimelineItem): number {
  return item.kind === 'hour' ? toEpochMs(item.hour.startsAt) : toEpochMs(item.at);
}

/** 남은 시간별 예보 사이에 그 범위 안의 일출·일몰 칸을 시각 순서로 끼워 넣는다. */
function toHourlyTimeline(report: WeatherReport, now: Instant): HourlyTimelineItem[] {
  const hours = WeatherReportPolicy.getUpcomingHours(report, now);
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

function selectHourly(now: Instant) {
  return (report: WeatherReport) => ({
    timezone: WeatherReportPolicy.getTimezone(report),
    timeline: toHourlyTimeline(report, now),
    summary: WeatherReportPolicy.findHourlySummary(report, now),
  });
}

interface BriefingSelection {
  now: Instant;
  // 할 일 시각은 기기 시간대로 읽어 예보 위치의 벽시계가 기기와 같을 때만 겹쳐 안내한다
  deviceTimezone: string;
  todos: readonly WeatherBriefingTodo[];
}

/** 겹쳐 안내할 수 없거나 서버가 판단하지 못했으면 브리핑이 없다 */
function selectBriefing({ now, deviceTimezone, todos }: BriefingSelection) {
  return (report: WeatherReport) => ({
    briefing: WeatherReportPolicy.canBriefTodos(report, now, deviceTimezone)
      ? WeatherReportPolicy.findBriefing(report, todos, now)
      : null,
  });
}

interface RescheduleSelection {
  now: Instant;
  todos: readonly WeatherBriefingTodo[];
  // 옮기기 링크(브리핑 카드·알림)가 가리킨 할 일과 이유
  link: WeatherRescheduleParams;
}

function selectReschedule({ now, todos, link }: RescheduleSelection) {
  return (report: WeatherReport) => ({
    reschedule: WeatherReportPolicy.getReschedule(report, todos, {
      now,
      linkedTodoIds: link.todoIds,
      linkedReason: link.reason,
    }),
    upcomingHours: WeatherReportPolicy.getUpcomingHours(report, now),
  });
}

function selectReportBriefing(report: WeatherReport) {
  return report.briefing;
}

function selectDaily(now: Instant) {
  return (report: WeatherReport) => ({
    timezone: WeatherReportPolicy.getTimezone(report),
    daily: report.daily,
    todayKey: WeatherReportPolicy.getTodayKey(report, now),
    currentTemperature: report.current.temperature,
  });
}

function selectDetails(now: Instant) {
  return (report: WeatherReport) => ({
    timezone: WeatherReportPolicy.getTimezone(report),
    current: report.current,
    sunscreenWindow: WeatherReportPolicy.findSunscreenWindow(report, now),
    nextDayPrecipitation: WeatherReportPolicy.calculateNextDayPrecipitation(report, now),
  });
}

function selectSunMoon(now: Instant) {
  return (report: WeatherReport) => ({
    timezone: WeatherReportPolicy.getTimezone(report),
    latitude: report.location.latitude,
    isDaylight: report.current.isDaylight,
    today: WeatherReportPolicy.findToday(report, now),
    todayKey: WeatherReportPolicy.getTodayKey(report, now),
    nextSunEvent: WeatherReportPolicy.findNextSunEvent(report, now),
    nextFullMoon: WeatherReportPolicy.findNextFullMoon(report, now),
  });
}

function selectAirQuality(report: WeatherReport) {
  return report.airQuality;
}

function selectAttribution(report: WeatherReport) {
  return {
    timezone: WeatherReportPolicy.getTimezone(report),
    attribution: report.attribution,
    fetchedAt: report.fetchedAt,
  };
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
    moonPhase: WeatherReportPolicy.findToday(report, report.fetchedAt)?.moonPhase ?? null,
    latitude: report.location.latitude,
  };
}

/** 카드 색조는 날씨 상태와 낮밤만으로 정해진다. 장면의 다른 값(강수 강도·구름·바람·달)이 바뀌어도 카드를 다시 그리지 않게 따로 고른다 */
function selectSky(report: WeatherReport): WeatherSkyInput {
  return pick(report.current, ['condition', 'isDaylight']);
}

function selectBadge(report: WeatherReport) {
  return {
    current: report.current,
    serviceName: report.attribution.serviceName,
  };
}

/**
 * 칸마다 리포트에서 쓰는 값만 골라 그 값이 바뀔 때만 다시 그린다. 지금 시각으로 고르는 칸은
 * `select: WeatherReportSelect.hero(now)`처럼 분 단위 시각을 넘겨 select를 만들고, 그 밖의 칸은
 * `select: WeatherReportSelect.airQuality`로 모듈 함수를 그대로 넘겨 TanStack이 결과를 재사용한다
 */
export const WeatherReportSelect = {
  hero: selectHero,
  alerts: selectAlerts,
  precipitation: selectPrecipitation,
  hourly: selectHourly,
  briefing: selectBriefing,
  reschedule: selectReschedule,
  reportBriefing: selectReportBriefing,
  daily: selectDaily,
  details: selectDetails,
  sunMoon: selectSunMoon,
  airQuality: selectAirQuality,
  attribution: selectAttribution,
  scene: selectScene,
  sky: selectSky,
  badge: selectBadge,
} as const;
