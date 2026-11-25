import type {
  WeatherAlert as WeatherAlertDto,
  WeatherBriefing as WeatherBriefingDto,
  WeatherDayPartForecast as WeatherDayPartForecastDto,
  WeatherHeadline as WeatherHeadlineDto,
  WeatherHourlyForecast as WeatherHourlyForecastDto,
  WeatherLocationResponse,
  WeatherReportResponse,
} from '@aido/api/contracts/weather/v2';
import { dateKeySchema } from '@src/shared/date/date-key';
import { toInstant, toNullableInstant } from '@src/shared/date/instant';
import { isSupportedTimezone } from '@src/shared/date/timezone';
import { isPlainObject, uniq } from 'es-toolkit';
import { match } from 'ts-pattern';

import type { CurrentWeather } from '../domains/current-weather.model';
import type { ForecastDay } from '../domains/forecast-day.model';
import type { ForecastHour } from '../domains/forecast-hour.model';
import type { RegisteredLocation } from '../domains/location-reading.model';
import type { WeatherAlert } from '../domains/weather-alert.model';
import type { HourWindow, WeatherHeadline } from '../domains/weather-briefing.model';
import type { WeatherReportBriefing } from '../domains/weather-report-briefing.model';
import type { WeatherReport } from '../domains/weather-report.model';

type WeatherCurrentConditionsDto = WeatherReportResponse['current'];
type WeatherNextHourDto = NonNullable<WeatherReportResponse['nextHour']>;
type WeatherDailyForecastDto = WeatherReportResponse['daily'][number];

/** 서버가 준 시간대 이름을 런타임(Hermes)이 모르면 다른 시간대로 바꾸지 않고 null로 드러낸다 */
export function toRegisteredLocation(dto: WeatherLocationResponse): RegisteredLocation {
  return {
    latitude: dto.latitude,
    longitude: dto.longitude,
    timezone: isSupportedTimezone(dto.timezone) ? dto.timezone : null,
  };
}

function toCurrentWeather(dto: WeatherCurrentConditionsDto): CurrentWeather {
  return {
    observedAt: toInstant(dto.observedAt),
    condition: dto.condition,
    isDaylight: dto.isDaylight,
    temperature: dto.temperature,
    apparentTemperature: dto.apparentTemperature,
    dewPoint: dto.dewPoint,
    humidity: dto.humidity,
    cloudCover: dto.cloudCover,
    uvIndex: dto.uvIndex,
    windSpeed: dto.windSpeed,
    windGust: dto.windGust,
    windDirection: dto.windDirection,
    visibility: dto.visibility,
    pressure: dto.pressure,
    pressureTrend: dto.pressureTrend,
    precipitationIntensity: dto.precipitationIntensity,
  };
}

function toNextHourForecast(dto: WeatherNextHourDto): NonNullable<WeatherReport['nextHour']> {
  return {
    periods: dto.periods.map((period) => ({
      condition: period.condition,
      precipitationType: period.precipitationType,
      startsAt: toInstant(period.startsAt),
      endsAt: toNullableInstant(period.endsAt),
    })),
    minutes: dto.minutes.map((minute) => ({
      startsAt: toInstant(minute.startsAt),
      precipitationIntensity: minute.precipitationIntensity,
    })),
  };
}

function toForecastHour(dto: WeatherHourlyForecastDto): ForecastHour {
  return {
    startsAt: toInstant(dto.startsAt),
    condition: dto.condition,
    isDaylight: dto.isDaylight,
    temperature: dto.temperature,
    apparentTemperature: dto.apparentTemperature,
    uvIndex: dto.uvIndex,
    precipitationChance: dto.precipitationChance,
    precipitationAmount: dto.precipitationAmount,
    precipitationType: dto.precipitationType,
  };
}

function toDayPartForecast(dto: WeatherDayPartForecastDto | null): ForecastDay['restOfDay'] {
  if (dto == null) {
    return null;
  }
  return {
    condition: dto.condition,
    temperatureMin: dto.temperatureMin,
    temperatureMax: dto.temperatureMax,
    precipitationChance: dto.precipitationChance,
  };
}

function toForecastDay(dto: WeatherDailyForecastDto): ForecastDay {
  return {
    date: dateKeySchema.parse(dto.date),
    condition: dto.condition,
    temperatureMin: dto.temperatureMin,
    temperatureMax: dto.temperatureMax,
    precipitationChance: dto.precipitationChance,
    precipitationAmount: dto.precipitationAmount,
    precipitationType: dto.precipitationType,
    uvIndexMax: dto.uvIndexMax,
    windSpeedMax: dto.windSpeedMax,
    windGustMax: dto.windGustMax,
    sunrise: toNullableInstant(dto.sunrise),
    sunset: toNullableInstant(dto.sunset),
    moonPhase: dto.moonPhase,
    moonrise: toNullableInstant(dto.moonrise),
    moonset: toNullableInstant(dto.moonset),
    restOfDay: toDayPartForecast(dto.restOfDay),
    daytime: toDayPartForecast(dto.daytime),
    overnight: toDayPartForecast(dto.overnight),
  };
}

function toWeatherAlert(dto: WeatherAlertDto): WeatherAlert {
  return {
    id: dto.id,
    title: dto.title,
    severity: dto.severity,
    source: dto.source,
    areaName: dto.areaName,
    effectiveAt: toInstant(dto.effectiveAt),
    expiresAt: toInstant(dto.expiresAt),
    detailsUrl: dto.detailsUrl,
  };
}

function toWeatherReportBriefing(dto: WeatherBriefingDto): WeatherReportBriefing {
  return {
    reason: dto.reason,
    affectedTodoIds: dto.affectedTodoIds,
    rescheduleOptions: dto.rescheduleOptions.map(({ todoId, options }) => ({
      todoId,
      options: options.map((option) => ({
        startsAt: toInstant(option.startsAt),
        precipitationChance: option.precipitationChance,
        apparentTemperature: option.apparentTemperature,
        isRecommended: option.isRecommended,
      })),
    })),
  };
}

function toHourWindow(window: { startsAt: string; endsAt: string }): HourWindow {
  return { startsAt: toInstant(window.startsAt), endsAt: toInstant(window.endsAt) };
}

function toWeatherHeadline(dto: WeatherHeadlineDto): WeatherHeadline {
  return match(dto)
    .returnType<WeatherHeadline>()
    .with({ kind: 'todoWet' }, ({ kind, hazard, window }) => ({
      kind,
      hazard,
      window: toHourWindow(window),
    }))
    .with({ kind: 'todoHot' }, ({ kind, peakApparentTemperature, window }) => ({
      kind,
      peakApparentTemperature,
      window: toHourWindow(window),
    }))
    .with({ kind: 'wetLater' }, ({ kind, startsAt, isSnow }) => ({
      kind,
      startsAt: toInstant(startsAt),
      isSnow,
    }))
    .with({ kind: 'wetTomorrow' }, ({ kind, dayPart, isSnow }) => ({ kind, dayPart, isSnow }))
    .with({ kind: 'clear' }, ({ kind, window }) => ({ kind, window: toHourWindow(window) }))
    .with({ kind: 'tomorrow' }, ({ kind, temperatureMin, temperatureMax, isChilly }) => ({
      kind,
      temperatureMin,
      temperatureMax,
      isChilly,
    }))
    .with({ kind: 'calm' }, ({ kind }) => ({ kind }))
    .exhaustive();
}

export function toWeatherReport(dto: WeatherReportResponse): WeatherReport {
  return {
    location: toRegisteredLocation(dto.location),
    current: toCurrentWeather(dto.current),
    nextHour: dto.nextHour == null ? null : toNextHourForecast(dto.nextHour),
    hourly: dto.hourly.map(toForecastHour),
    daily: dto.daily.map(toForecastDay),
    alerts: dto.alerts.map(toWeatherAlert),
    airQuality:
      dto.airQuality == null
        ? null
        : {
            pm10: dto.airQuality.pm10,
            pm25: dto.airQuality.pm25,
            source: dto.airQuality.source,
          },
    attribution: {
      serviceName: dto.attribution.serviceName,
      legalPageUrl: dto.attribution.legalPageUrl,
      logo: dto.attribution.logo,
    },
    fetchedAt: toInstant(dto.fetchedAt),
    expiresAt: toNullableInstant(dto.expiresAt ?? null),
    briefing: dto.briefing == null ? null : toWeatherReportBriefing(dto.briefing),
    headline: dto.headline == null ? null : toWeatherHeadline(dto.headline),
  };
}

function collectFallbackPaths(raw: unknown, parsed: unknown, path: string): string[] {
  if (Array.isArray(parsed)) {
    const rawItems: unknown[] = Array.isArray(raw) ? raw : [];
    return parsed.flatMap((item, index) =>
      collectFallbackPaths(rawItems[index], item, `${path}[]`),
    );
  }
  if (isPlainObject(parsed)) {
    const rawFields = isPlainObject(raw) ? raw : {};
    return Object.entries(parsed).flatMap(([key, value]) =>
      collectFallbackPaths(rawFields[key], value, path === '' ? key : `${path}.${key}`),
    );
  }
  // oxlint-disable-next-line aido/no-strict-nullish -- 받은 값이 없음(undefined)과 null을 가른다
  return raw !== undefined && raw !== parsed ? [path] : [];
}

/**
 * 계약의 .catch가 모르는 값을 대체값으로 바꾼 칸의 경로(`hourly[].condition`). 받은 값과 읽은 값이 다른
 * 끝 칸이 대체된 칸이다. 값은 담지 않고 배열 위치는 []로 접는다
 */
export function getFallbackFieldPaths(raw: unknown, parsed: unknown): string[] {
  return uniq(collectFallbackPaths(raw, parsed, ''));
}
