import {
  SERVICE_DEFAULT_TIMEZONE,
  WEATHER_NEXT_HOUR_CONDITIONS,
  WEATHER_PRECIPITATION_TYPES,
  type WeatherPrecipitationType,
  type WeatherRescheduleReason,
} from '@aido/api/vocabulary';
import { HOUR_MS, MINUTE_MS } from '@src/shared/constants/time-units';
import type { DateKey } from '@src/shared/date/date-key';
import {
  type Instant,
  diffMs,
  fromEpochMs,
  instantSchema,
  toEpochMs,
} from '@src/shared/date/instant';
import { hasSameWallClock, toDateKey } from '@src/shared/date/zoned';
import { z } from 'zod';

import { airQualitySchema } from './air-quality.model';
import { CurrentWeatherPolicy, currentWeatherSchema } from './current-weather.model';
import {
  type ForecastDay,
  ForecastDayPolicy,
  forecastDaySchema,
  type NextSunEvent,
} from './forecast-day.model';
import {
  type ForecastHour,
  ForecastHourPolicy,
  forecastHourSchema,
  type HourlyPrecipitationOutlook,
  type HourlySummary,
  type HourRange,
} from './forecast-hour.model';
import { registeredLocationSchema } from './location-reading.model';
import { type WeatherAlert, WeatherAlertPolicy, weatherAlertSchema } from './weather-alert.model';
import {
  createWeatherBriefing,
  createWeatherForecastTodos,
  type WeatherBriefing,
  type WeatherBriefingTodo,
  weatherHeadlineSchema,
} from './weather-briefing.model';
import { weatherReportBriefingSchema } from './weather-report-briefing.model';
import { createWeatherReschedule, type WeatherReschedule } from './weather-reschedule.model';

const minuteForecastSchema = z.object({
  startsAt: instantSchema,
  precipitationIntensity: z.number(),
});
export type MinuteForecast = z.infer<typeof minuteForecastSchema>;

const nextHourPeriodSchema = z.object({
  condition: z.enum(WEATHER_NEXT_HOUR_CONDITIONS),
  precipitationType: z.enum(WEATHER_PRECIPITATION_TYPES).nullable(),
  startsAt: instantSchema,
  endsAt: instantSchema.nullable(),
});

const nextHourForecastSchema = z.object({
  periods: z.array(nextHourPeriodSchema),
  minutes: z.array(minuteForecastSchema),
});
type NextHourForecast = z.infer<typeof nextHourForecastSchema>;

const attributionLogoSchema = z.object({ '1x': z.string(), '2x': z.string(), '3x': z.string() });

const attributionSchema = z.object({
  serviceName: z.string(),
  legalPageUrl: z.string(),
  logo: z.object({ light: attributionLogoSchema, dark: attributionLogoSchema }).nullable(),
});
export type AttributionInfo = z.infer<typeof attributionSchema>;

/** 서버에 등록한 위치의 날씨 리포트 한 장. 화면의 칸은 모두 이 리포트에서 고른다 */
export const weatherReportSchema = z.object({
  location: registeredLocationSchema,
  current: currentWeatherSchema,
  // 분 단위 강수 예보. 지원하지 않는 지역은 null이다
  nextHour: nextHourForecastSchema.nullable(),
  hourly: z.array(forecastHourSchema),
  daily: z.array(forecastDaySchema),
  alerts: z.array(weatherAlertSchema),
  airQuality: airQualitySchema.nullable(),
  attribution: attributionSchema,
  fetchedAt: instantSchema,
  // 서버가 이 리포트를 공급자에서 다시 받기 시작하는 순간. 공급자 장애로 마지막 리포트를 주면 null이다
  expiresAt: instantSchema.nullable(),
  // 서버가 오늘 할 일을 읽지 못하면 null이다
  briefing: weatherReportBriefingSchema.nullable(),
  // 서버가 판단하지 못했거나 이 앱이 모르는 종류면 null이다
  headline: weatherHeadlineSchema.nullable(),
});
export type WeatherReport = z.infer<typeof weatherReportSchema>;

const NEXT_HOUR_RANGE_MS = HOUR_MS;
// 기기 시계가 서버보다 조금 빨라 만료 직후 같은 리포트를 한 번 더 받아도 1분 뒤 다시 받으므로 그 사이는 안내하지 않는다
const STALE_NOTICE_GRACE_MS = 2 * MINUTE_MS;
const NOWCAST_EXPIRES_AFTER_MS = 6 * HOUR_MS;

/** 분 단위 예보에서 온 시각은 분까지, 시간별 예보에서 온 시각은 정시로 안내한다. */
export type PrecipitationPrecision = 'minute' | 'hour';

export type PrecipitationWindow =
  | { kind: 'dry' }
  | {
      kind: 'ongoing';
      precipitationType: WeatherPrecipitationType | null;
      endsAt: Instant | null;
      endPrecision: PrecipitationPrecision;
      isEndingOnLaterDay: boolean;
    }
  | {
      kind: 'upcoming';
      precision: PrecipitationPrecision;
      precipitationType: WeatherPrecipitationType | null;
      startsAt: Instant;
      endsAt: Instant | null;
      endPrecision: PrecipitationPrecision;
      isEndingOnLaterDay: boolean;
    };

interface WetPeriod {
  startsAt: Instant;
  endsAt: Instant | null;
  precision: PrecipitationPrecision;
  endPrecision: PrecipitationPrecision;
  precipitationType: WeatherPrecipitationType | null;
}

interface RescheduleContext {
  now: Instant;
  // 옮기기 링크(브리핑 카드·알림)가 가리킨 할 일과 이유
  linkedTodoIds: readonly number[];
  linkedReason: WeatherRescheduleReason;
}

/** 분 단위 예보가 끝나는 순간. 분 칸이 없으면 지금부터 한 시간이다 */
function getNextHourHorizon(nextHour: NextHourForecast, now: Instant): Instant {
  const lastMinute = nextHour.minutes.at(-1);
  return fromEpochMs(
    lastMinute == null
      ? toEpochMs(now) + NEXT_HOUR_RANGE_MS
      : toEpochMs(lastMinute.startsAt) + MINUTE_MS,
  );
}

function createPrecipitationWindow(
  wet: WetPeriod,
  now: Instant,
  timezone: string,
): PrecipitationWindow {
  const isEndingOnLaterDay =
    wet.endsAt != null && toDateKey(wet.endsAt, timezone) !== toDateKey(now, timezone);
  if (toEpochMs(wet.startsAt) <= toEpochMs(now)) {
    return {
      kind: 'ongoing',
      precipitationType: wet.precipitationType,
      endsAt: wet.endsAt,
      endPrecision: wet.endPrecision,
      isEndingOnLaterDay,
    };
  }
  return { kind: 'upcoming', ...wet, isEndingOnLaterDay };
}

export const WeatherReportPolicy = {
  /**
   * 예보 위치의 시간대. 일별 예보의 날짜와 화면의 시각이 이 시간대를 따른다. 런타임이 모르는 이름이면(null)
   * 서비스 기본 시간대로 읽는다. 포매터의 안전망(`getFormatter`)이 고르던 값과 같다
   */
  getTimezone(report: WeatherReport) {
    return report.location.timezone ?? SERVICE_DEFAULT_TIMEZONE;
  },

  /** 예보 위치 시간대의 오늘 날짜(YYYY-MM-DD). 기기 시간대의 오늘과 다를 수 있다 */
  getTodayKey(report: WeatherReport, now: Instant): DateKey {
    return toDateKey(now, this.getTimezone(report));
  },

  /** 오늘 예보. 일별 예보에 오늘이 없으면(날짜 경계의 지연) 첫 예보를 오늘처럼 쓴다. */
  findToday(report: WeatherReport, now: Instant): ForecastDay | null {
    return ForecastDayPolicy.findOnDateOrFirst(report.daily, this.getTodayKey(report, now));
  },

  /** 서버가 같은 리포트를 주는 남은 시간(ms). 공급자 장애로 받은 마지막 리포트와 이미 지난 만료는 0이다 */
  getFreshForMs(report: WeatherReport, at: Instant) {
    return report.expiresAt == null ? 0 : Math.max(0, diffMs(report.expiresAt, at));
  },

  /** 서버가 새 리포트를 받기 시작한 뒤에도 새것을 받지 못했다. 공급자 장애로 받은 마지막 리포트는 처음부터 오래된 정보다 */
  isStale(report: WeatherReport, now: Instant) {
    return report.expiresAt == null || STALE_NOTICE_GRACE_MS < diffMs(now, report.expiresAt);
  },

  /** 6시간 넘게 갱신되지 않은 데이터로는 곧 올 비나 할 일 브리핑을 안내하지 않는다. */
  isNowcastExpired(report: WeatherReport, now: Instant) {
    return NOWCAST_EXPIRES_AFTER_MS < diffMs(now, report.fetchedAt);
  },

  getUpcomingHours(report: WeatherReport, now: Instant): ForecastHour[] {
    return ForecastHourPolicy.getUpcoming(report.hourly, now);
  },

  getActiveAlerts(report: WeatherReport, now: Instant): WeatherAlert[] {
    return WeatherAlertPolicy.getActive(report.alerts, now);
  },

  /** 분 단위 예보를 먼저 믿고, 그 범위 끝까지 이어지는 비는 시간별 예보에서 그치는 시각을 찾는다 */
  getPrecipitationWindow(report: WeatherReport, now: Instant): PrecipitationWindow {
    const { nextHour, hourly } = report;
    const timezone = this.getTimezone(report);

    if (nextHour != null) {
      const period = nextHour.periods.find(
        (candidate) =>
          candidate.condition === 'PRECIPITATION' &&
          (candidate.endsAt == null || toEpochMs(now) < toEpochMs(candidate.endsAt)),
      );
      if (period != null) {
        return createPrecipitationWindow(
          {
            startsAt: period.startsAt,
            endsAt:
              period.endsAt ??
              ForecastHourPolicy.findFirstDryStartFrom(hourly, getNextHourHorizon(nextHour, now)),
            precision: 'minute',
            endPrecision: period.endsAt == null ? 'hour' : 'minute',
            precipitationType: period.precipitationType,
          },
          now,
          timezone,
        );
      }
    }

    const searchFrom = nextHour == null ? now : getNextHourHorizon(nextHour, now);
    const wetHour = ForecastHourPolicy.findFirstWetEndingAfter(hourly, searchFrom);
    if (wetHour == null) {
      return { kind: 'dry' };
    }
    return createPrecipitationWindow(
      {
        startsAt: fromEpochMs(Math.max(toEpochMs(wetHour.startsAt), toEpochMs(searchFrom))),
        endsAt: ForecastHourPolicy.findFirstDryStartFrom(
          hourly,
          ForecastHourPolicy.getEndsAt(wetHour),
        ),
        precision: 'hour',
        endPrecision: 'hour',
        precipitationType: wetHour.precipitationType,
      },
      now,
      timezone,
    );
  },

  findHourlyPrecipitationOutlook(
    report: WeatherReport,
    now: Instant,
  ): HourlyPrecipitationOutlook | null {
    return ForecastHourPolicy.findPrecipitationOutlook(report.hourly, now);
  },

  /** 지금 관측된 강수가 시간별 확률보다 먼저고, 날짜는 예보 위치 시간대로 가른다 */
  findHourlySummary(report: WeatherReport, now: Instant): HourlySummary | null {
    return ForecastHourPolicy.findSummary(report.hourly, {
      now,
      timezone: this.getTimezone(report),
      observedPrecipitationType: CurrentWeatherPolicy.findObservedPrecipitationType(report.current),
    });
  },

  /** 오늘(예보 위치 시간대) 남은 시간 중 자외선 차단이 필요한 시간대. 없으면 null이다 */
  findSunscreenWindow(report: WeatherReport, now: Instant): HourRange | null {
    return ForecastHourPolicy.findSunscreenWindow(report.hourly, now, this.getTimezone(report));
  },

  calculateNextDayPrecipitation(report: WeatherReport, now: Instant): number | null {
    return ForecastHourPolicy.calculateNextDayPrecipitation(report.hourly, now);
  },

  /** 오늘 아직 지나지 않은 일출·일몰, 둘 다 지났으면 내일 일출. 오늘 예보가 없거나 모두 없으면 null이다. */
  findNextSunEvent(report: WeatherReport, now: Instant): NextSunEvent | null {
    const today = this.findToday(report, now);
    if (today == null) {
      return null;
    }
    const tomorrow = ForecastDayPolicy.findDayAfter(report.daily, this.getTodayKey(report, now));
    return ForecastDayPolicy.findNextSunEvent(today, tomorrow, now);
  },

  findNextFullMoon(report: WeatherReport, now: Instant): DateKey | null {
    return ForecastDayPolicy.findNextFullMoon(report.daily, this.getTodayKey(report, now));
  },

  /**
   * 오늘 할 일과 날씨를 겹쳐 안내해도 되는가. 6시간 넘게 낡은 리포트이거나 예보 위치의 벽시계가 기기와 다르면
   * 할 일 시각(기기 시간대)과 예보를 맞출 수 없어 안내하지 않는다
   */
  canBriefTodos(report: WeatherReport, now: Instant, deviceTimezone: string): boolean {
    return (
      !this.isNowcastExpired(report, now) &&
      hasSameWallClock(now, this.getTimezone(report), deviceTimezone)
    );
  },

  /** 서버 머리글(날씨 알림과 같은 판단)을 오늘 목록의 할 일과 묶는다. 서버가 판단하지 못한 리포트(오늘 할 일 읽기 실패)는 null이다. */
  findBriefing(
    report: WeatherReport,
    todos: readonly WeatherBriefingTodo[],
    now: Instant,
  ): WeatherBriefing | null {
    if (report.briefing == null || report.headline == null) {
      return null;
    }
    return createWeatherBriefing({
      headline: report.headline,
      reportBriefing: report.briefing,
      hourly: report.hourly,
      todos,
      now,
    });
  },

  /** 지금 서버 브리핑이 영향받는다고 본 할 일로 옮기기를 만든다. 서버가 판단하지 못했으면 옮길 할 일이 없다 */
  getReschedule(
    report: WeatherReport,
    todos: readonly WeatherBriefingTodo[],
    { now, linkedTodoIds, linkedReason }: RescheduleContext,
  ): WeatherReschedule {
    return createWeatherReschedule({
      reportBriefing: report.briefing,
      forecastTodos: createWeatherForecastTodos(todos, report.hourly, now),
      linkedTodoIds,
      linkedReason,
    });
  },
};
