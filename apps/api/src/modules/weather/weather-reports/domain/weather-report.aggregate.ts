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

import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";
import { localDateIn } from "#api/shared/domain/time/timezone-name";

import type { GeoCell } from "../../shared/domain/geo-cell.vo.js";
import { WeatherReportId } from "./weather-report-id.vo.js";

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

interface WeatherReportNextHourPeriod {
  readonly condition: WeatherNextHourCondition;
  /** 공급자가 형태 없이 강수로만 알리면 null */
  readonly precipitationType: WeatherPrecipitationType | null;
  readonly startsAt: Temporal.Instant;
  readonly endsAt: Temporal.Instant | null;
  readonly precipitationChance: number;
  readonly precipitationIntensity: number;
}

interface WeatherReportMinute {
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

export interface WeatherReportPrimitives {
  /** 리포트가 속한 칸의 geohash */
  readonly cellKey: string;
  readonly current: WeatherReportCurrent;
  readonly nextHour: WeatherReportNextHour | null;
  readonly hourly: readonly WeatherReportHour[];
  readonly daily: readonly WeatherReportDay[];
  readonly alerts: readonly WeatherReportAlert[];
  /** 공급자가 이 값을 읽은 순간. 폴백한 리포트면 지금보다 이르다 */
  readonly fetchedAt: Temporal.Instant;
  /** 공급자가 예보를 새로 내기 전까지 유효하다고 알린 순간. 모르면 null */
  readonly validUntil: Temporal.Instant | null;
}

interface WeatherReportProps {
  readonly current: WeatherReportCurrent;
  readonly nextHour: WeatherReportNextHour | null;
  readonly hourly: readonly WeatherReportHour[];
  readonly daily: readonly WeatherReportDay[];
  readonly alerts: readonly WeatherReportAlert[];
  readonly fetchedAt: Temporal.Instant;
  readonly validUntil: Temporal.Instant | null;
}

interface CreateWeatherReportParams extends WeatherReportProps {
  readonly cell: GeoCell;
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

/**
 * 공급자 중립 날씨 리포트. 단위는 °C·m/s·mm·hPa·m, 확률·비율은 0~100 정수다.
 * 저장하지 않는다. 공급자 응답에서 만들고 칸 캐시에서 복원한다.
 */
export class WeatherReport extends AggregateRoot<WeatherReportId, WeatherReportProps> {
  // 값 검증은 공급자 wire가 끝냈다
  static create({ cell, ...props }: CreateWeatherReportParams): WeatherReport {
    return new WeatherReport(WeatherReportId.reconstitute(cell.key), props);
  }

  static reconstitute({ cellKey, ...props }: WeatherReportPrimitives): WeatherReport {
    return new WeatherReport(WeatherReportId.reconstitute(cellKey), props);
  }

  get current(): WeatherReportCurrent {
    return this.props.current;
  }

  get nextHour(): WeatherReportNextHour | null {
    return this.props.nextHour;
  }

  get hourly(): readonly WeatherReportHour[] {
    return this.props.hourly;
  }

  get daily(): readonly WeatherReportDay[] {
    return this.props.daily;
  }

  get alerts(): readonly WeatherReportAlert[] {
    return this.props.alerts;
  }

  get fetchedAt(): Temporal.Instant {
    return this.props.fetchedAt;
  }

  get validUntil(): Temporal.Instant | null {
    return this.props.validUntil;
  }

  /** 분 단위 강수 예보(다음 1시간)를 주는 지역의 리포트인지. 한국은 주지 않는다 */
  hasMinuteForecast(): boolean {
    return this.props.nextHour != null;
  }

  isPrecipitatingNow(): boolean {
    return this.props.current.precipitationIntensity > 0;
  }

  /**
   * 캐시·폴백 리포트는 받은 시점의 창을 담고 있으므로 응답 시각 기준으로 지난 구간을 잘라낸다.
   * 시간별은 현재 시각이 속한 시간부터, 일별은 위치 시간대의 오늘부터 시작한다.
   */
  windowAt(now: Temporal.Instant, timezone: string): WeatherReport {
    const currentHourStart = now.subtract({ hours: 1 });
    const today = localDateIn(now, timezone);
    return new WeatherReport(this.id, {
      ...this.props,
      nextHour: windowNextHour(this.props.nextHour, now),
      hourly: this.props.hourly
        .filter((hour) => isAfter(hour.startsAt, currentHourStart))
        .slice(0, WEATHER_REPORT_LIMITS.HOURLY_FORECAST_HOURS),
      daily: this.props.daily
        .filter((day) => Temporal.PlainDate.compare(day.date, today) >= 0)
        .slice(0, WEATHER_REPORT_LIMITS.DAILY_FORECAST_DAYS),
    });
  }

  /** 지금 강수 중이거나 2시간 안에 강수(다음 1시간 강수 구간·강수 확률 기준 이상인 시간)가 예보됐는지 */
  isPrecipitationSoon(now: Temporal.Instant): boolean {
    const horizon = now.add({ hours: PRECIPITATION_SOON_LOOKAHEAD_HOURS });
    if (this.isPrecipitatingNow()) {
      return true;
    }
    const nextHourRain =
      this.props.nextHour?.periods.some(
        (period) => period.condition === "PRECIPITATION" && !isAfter(period.startsAt, horizon),
      ) ?? false;
    if (nextHourRain) {
      return true;
    }
    return this.props.hourly.some(
      (hour) =>
        !isAfter(hour.startsAt, horizon) &&
        isAfter(hour.startsAt.add({ hours: 1 }), now) &&
        hour.precipitationChance >= WEATHER_BRIEFING_RULES.WET_HOUR_CHANCE,
    );
  }

  toPrimitives(): WeatherReportPrimitives {
    return { cellKey: this.id.value, ...this.props };
  }
}
