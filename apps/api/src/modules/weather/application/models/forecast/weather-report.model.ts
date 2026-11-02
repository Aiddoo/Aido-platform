import {
  WEATHER_REPORT_LIMITS,
  type WeatherAlertSeverity,
  type WeatherCondition,
  type WeatherMoonPhase,
  type WeatherNextHourCondition,
  type WeatherPrecipitationType,
  type WeatherPressureTrend,
  type WeatherProvider,
} from "@aido/api/vocabulary";

import { dayWindowInTimezone } from "#api/shared/domain/date/utils/timezone";

/** 공급자 중립 날씨 스냅샷. 단위는 °C·m/s·mm·hPa·m, 확률·비율은 0~100 정수다. */
export interface WeatherReport {
  readonly current: WeatherReportCurrent;
  readonly nextHour: WeatherReportNextHour | null;
  readonly hourly: readonly WeatherReportHour[];
  readonly daily: readonly WeatherReportDay[];
  readonly alerts: readonly WeatherReportAlert[];
  readonly attribution: WeatherReportAttribution;
  readonly fetchedAt: Date;
}

export interface WeatherReportCurrent {
  readonly observedAt: Date;
  readonly condition: WeatherCondition;
  readonly isDaylight: boolean;
  readonly temperature: number;
  readonly apparentTemperature: number;
  readonly dewPoint: number;
  readonly humidity: number;
  readonly cloudCover: number;
  readonly uvIndex: number;
  readonly windSpeed: number;
  readonly windGust: number | null;
  readonly windDirection: number | null;
  readonly visibility: number;
  readonly pressure: number;
  readonly pressureTrend: WeatherPressureTrend;
  readonly precipitationIntensity: number;
}

export interface WeatherReportNextHour {
  readonly periods: readonly WeatherReportNextHourPeriod[];
  readonly minutes: readonly WeatherReportMinute[];
}

interface WeatherReportNextHourPeriod {
  readonly condition: WeatherNextHourCondition;
  readonly precipitationType: WeatherPrecipitationType;
  readonly startsAt: Date;
  readonly endsAt: Date | null;
  readonly precipitationChance: number;
  readonly precipitationIntensity: number;
}

interface WeatherReportMinute {
  readonly startsAt: Date;
  readonly precipitationChance: number;
  readonly precipitationIntensity: number;
}

export interface WeatherReportHour {
  readonly startsAt: Date;
  readonly condition: WeatherCondition;
  readonly isDaylight: boolean;
  readonly temperature: number;
  readonly apparentTemperature: number;
  readonly humidity: number;
  readonly uvIndex: number;
  readonly windSpeed: number;
  readonly windDirection: number | null;
  readonly precipitationChance: number;
  readonly precipitationAmount: number;
  readonly precipitationType: WeatherPrecipitationType;
}

export interface WeatherReportDayPart {
  readonly condition: WeatherCondition;
  readonly temperatureMin: number | null;
  readonly temperatureMax: number | null;
  readonly precipitationChance: number;
  readonly precipitationAmount: number;
  readonly precipitationType: WeatherPrecipitationType;
}

export interface WeatherReportDay {
  /** 위치 시간대의 달력 날짜 (YYYY-MM-DD) */
  readonly date: string;
  readonly condition: WeatherCondition;
  readonly temperatureMin: number;
  readonly temperatureMax: number;
  readonly precipitationChance: number;
  readonly precipitationAmount: number;
  readonly precipitationType: WeatherPrecipitationType;
  readonly snowfallAmount: number;
  readonly uvIndexMax: number;
  readonly windSpeedMax: number | null;
  readonly windGustMax: number | null;
  readonly sunrise: Date | null;
  readonly sunset: Date | null;
  readonly moonPhase: WeatherMoonPhase;
  readonly daytime: WeatherReportDayPart | null;
  readonly overnight: WeatherReportDayPart | null;
}

export interface WeatherReportAlert {
  readonly id: string;
  readonly title: string;
  readonly severity: WeatherAlertSeverity;
  readonly source: string;
  readonly areaName: string | null;
  readonly effectiveAt: Date;
  readonly expiresAt: Date;
  readonly detailsUrl: string;
}

interface WeatherReportAttribution {
  readonly provider: WeatherProvider;
  readonly legalPageUrl: string;
}

const HOUR_MS = 60 * 60_000;
const MINUTE_MS = 60_000;

/**
 * 캐시·폴백 스냅샷은 받은 시점의 창을 담고 있으므로 응답 시각 기준으로 지난 구간을 잘라낸다.
 * 시간별은 현재 시각이 속한 시간부터, 일별은 위치 시간대의 오늘부터 시작한다.
 */
export function windowWeatherReport(
  report: WeatherReport,
  now: Date,
  timezone: string,
): WeatherReport {
  const currentHourStartMs = now.getTime() - HOUR_MS;
  const today = dayWindowInTimezone(now, timezone).localDate;

  return {
    ...report,
    nextHour: windowNextHour(report.nextHour, now),
    hourly: report.hourly
      .filter((hour) => hour.startsAt.getTime() > currentHourStartMs)
      .slice(0, WEATHER_REPORT_LIMITS.HOURLY_FORECAST_HOURS),
    daily: report.daily
      .filter((day) => day.date >= today)
      .slice(0, WEATHER_REPORT_LIMITS.DAILY_FORECAST_DAYS),
  };
}

function windowNextHour(
  nextHour: WeatherReportNextHour | null,
  now: Date,
): WeatherReportNextHour | null {
  if (nextHour == null) {
    return null;
  }
  const currentMinuteStartMs = now.getTime() - MINUTE_MS;
  const minutes = nextHour.minutes.filter(
    (minute) => minute.startsAt.getTime() > currentMinuteStartMs,
  );
  const periods = nextHour.periods.filter(
    (period) => period.endsAt == null || period.endsAt.getTime() > now.getTime(),
  );
  if (minutes.length === 0 && periods.length === 0) {
    return null;
  }
  return { periods, minutes };
}
