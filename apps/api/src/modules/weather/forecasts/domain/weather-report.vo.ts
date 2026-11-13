import {
  type WeatherAlertSeverity,
  WEATHER_BRIEFING_RULES,
  type WeatherCondition,
  type WeatherMoonPhase,
  type WeatherNextHourCondition,
  type WeatherPrecipitationType,
  type WeatherPressureTrend,
  WEATHER_REPORT_LIMITS,
} from "@aido/api/vocabulary";

import { ValueObject } from "#api/shared/domain/model/value-object";
import { localDateIn } from "#api/shared/domain/time/time-zone-name";

/** 강수가 이 시간 안에 예보되면 "곧 비"로 본다 */
const PRECIPITATION_SOON_LOOKAHEAD_HOURS = 2;

export interface WeatherReportCurrent {
  readonly observedAt: Temporal.Instant;
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

export interface WeatherReportNextHourPeriod {
  readonly condition: WeatherNextHourCondition;
  /** 공급자가 형태 없이 강수로만 알리면 null */
  readonly precipitationType: WeatherPrecipitationType | null;
  readonly startsAt: Temporal.Instant;
  readonly endsAt: Temporal.Instant | null;
  readonly precipitationChance: number;
  readonly precipitationIntensity: number;
}

export interface WeatherReportMinute {
  readonly startsAt: Temporal.Instant;
  readonly precipitationChance: number;
  readonly precipitationIntensity: number;
}

export interface WeatherReportNextHour {
  readonly periods: readonly WeatherReportNextHourPeriod[];
  readonly minutes: readonly WeatherReportMinute[];
}

export interface WeatherReportHour {
  readonly startsAt: Temporal.Instant;
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
  /** 위치 시간대의 달력 날짜 */
  readonly date: Temporal.PlainDate;
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
  readonly sunrise: Temporal.Instant | null;
  readonly sunset: Temporal.Instant | null;
  readonly moonPhase: WeatherMoonPhase;
  readonly moonrise: Temporal.Instant | null;
  readonly moonset: Temporal.Instant | null;
  /** 지금부터 그날 끝까지. 공급자는 오늘 항목에만 준다 */
  readonly restOfDay: WeatherReportDayPart | null;
  readonly daytime: WeatherReportDayPart | null;
  readonly overnight: WeatherReportDayPart | null;
}

export interface WeatherReportAlert {
  readonly id: string;
  readonly title: string;
  readonly severity: WeatherAlertSeverity;
  readonly source: string;
  readonly areaName: string | null;
  readonly effectiveAt: Temporal.Instant;
  readonly expiresAt: Temporal.Instant;
  readonly detailsUrl: string;
}

export interface WeatherReportValue {
  readonly current: WeatherReportCurrent;
  readonly nextHour: WeatherReportNextHour | null;
  readonly hourly: readonly WeatherReportHour[];
  readonly daily: readonly WeatherReportDay[];
  readonly alerts: readonly WeatherReportAlert[];
  /** 공급자가 이 값을 읽은 순간. 폴백한 리포트면 지금보다 이르다 */
  readonly fetchedAt: Temporal.Instant;
}

function isAfter(left: Temporal.Instant, right: Temporal.Instant): boolean {
  return Temporal.Instant.compare(left, right) > 0;
}

function windowNextHour(
  nextHour: WeatherReportNextHour | null,
  now: Temporal.Instant,
): WeatherReportNextHour | null {
  if (nextHour == null) {
    return null;
  }
  const currentMinuteStart = now.subtract({ minutes: 1 });
  const minutes = nextHour.minutes.filter((minute) => isAfter(minute.startsAt, currentMinuteStart));
  const periods = nextHour.periods.filter(
    (period) => period.endsAt == null || isAfter(period.endsAt, now),
  );
  if (minutes.length === 0 && periods.length === 0) {
    return null;
  }
  return { periods, minutes };
}

/** 공급자 중립 날씨 리포트. 단위는 °C·m/s·mm·hPa·m, 확률·비율은 0~100 정수다. */
export class WeatherReport extends ValueObject<WeatherReportValue> {
  /** 공급자 응답에서 만든다. 값 검증은 공급자 wire가 끝냈다 */
  static create(value: WeatherReportValue): WeatherReport {
    return new WeatherReport(value);
  }

  static reconstitute(value: WeatherReportValue): WeatherReport {
    return new WeatherReport(value);
  }

  get current(): WeatherReportCurrent {
    return this.value.current;
  }

  get nextHour(): WeatherReportNextHour | null {
    return this.value.nextHour;
  }

  get hourly(): readonly WeatherReportHour[] {
    return this.value.hourly;
  }

  get daily(): readonly WeatherReportDay[] {
    return this.value.daily;
  }

  get alerts(): readonly WeatherReportAlert[] {
    return this.value.alerts;
  }

  get fetchedAt(): Temporal.Instant {
    return this.value.fetchedAt;
  }

  /**
   * 캐시·폴백 리포트는 받은 시점의 창을 담고 있으므로 응답 시각 기준으로 지난 구간을 잘라낸다.
   * 시간별은 현재 시각이 속한 시간부터, 일별은 위치 시간대의 오늘부터 시작한다.
   */
  windowAt(now: Temporal.Instant, timezone: string): WeatherReport {
    const currentHourStart = now.subtract({ hours: 1 });
    const today = localDateIn(now, timezone);
    return new WeatherReport({
      ...this.value,
      nextHour: windowNextHour(this.value.nextHour, now),
      hourly: this.value.hourly
        .filter((hour) => isAfter(hour.startsAt, currentHourStart))
        .slice(0, WEATHER_REPORT_LIMITS.HOURLY_FORECAST_HOURS),
      daily: this.value.daily
        .filter((day) => Temporal.PlainDate.compare(day.date, today) >= 0)
        .slice(0, WEATHER_REPORT_LIMITS.DAILY_FORECAST_DAYS),
    });
  }

  /** 지금 강수 중이거나 2시간 안에 강수(다음 1시간 강수 구간·강수 확률 기준 이상인 시간)가 예보됐는지 */
  isPrecipitationSoon(now: Temporal.Instant): boolean {
    const horizon = now.add({ hours: PRECIPITATION_SOON_LOOKAHEAD_HOURS });
    if (this.value.current.precipitationIntensity > 0) {
      return true;
    }
    const nextHourRain =
      this.value.nextHour?.periods.some(
        (period) => period.condition === "PRECIPITATION" && !isAfter(period.startsAt, horizon),
      ) ?? false;
    if (nextHourRain) {
      return true;
    }
    return this.value.hourly.some(
      (hour) =>
        !isAfter(hour.startsAt, horizon) &&
        isAfter(hour.startsAt.add({ hours: 1 }), now) &&
        hour.precipitationChance >= WEATHER_BRIEFING_RULES.WET_HOUR_CHANCE,
    );
  }
}
