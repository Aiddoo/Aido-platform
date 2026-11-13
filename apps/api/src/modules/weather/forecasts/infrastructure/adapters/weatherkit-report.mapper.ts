import type {
  WeatherAlertSeverity,
  WeatherCondition,
  WeatherMoonPhase,
  WeatherPrecipitationType,
  WeatherPressureTrend,
} from "@aido/api/vocabulary";
import { clamp, round, sortBy } from "es-toolkit";
import { match } from "ts-pattern";

import { localDateIn } from "#api/shared/domain/time/time-zone-name";

import {
  WeatherReport,
  type WeatherReportAlert,
  type WeatherReportCurrent,
  type WeatherReportDay,
  type WeatherReportDayPart,
  type WeatherReportHour,
  type WeatherReportNextHour,
} from "../../domain/weather-report.vo.js";
import type {
  WeatherKitAlert,
  WeatherKitAlertSeverity,
  WeatherKitConditionCode,
  WeatherKitCurrentWeather,
  WeatherKitDay,
  WeatherKitDayPart,
  WeatherKitHour,
  WeatherKitMoonPhase,
  WeatherKitNextHour,
  WeatherKitPrecipitationType,
  WeatherKitPressureTrend,
  WeatherKitWeather,
} from "./weatherkit.wire.js";

/** 새 conditionCode가 와도 응답을 깨지 않도록 가장 중립적인 상태로 둔다. */
const UNKNOWN_CONDITION: WeatherCondition = "CLOUDY";
const KMH_PER_MS = 3.6;
const SEVERITY_ORDER: Readonly<Record<WeatherAlertSeverity, number>> = {
  EXTREME: 0,
  SEVERE: 1,
  MODERATE: 2,
  MINOR: 3,
  UNKNOWN: 4,
};

function toWeatherCondition(code: WeatherKitConditionCode | null): WeatherCondition {
  if (code == null) {
    return UNKNOWN_CONDITION;
  }
  return match(code)
    .returnType<WeatherCondition>()
    .with("Clear", () => "CLEAR")
    .with("MostlyClear", () => "MOSTLY_CLEAR")
    .with("PartlyCloudy", () => "PARTLY_CLOUDY")
    .with("MostlyCloudy", () => "MOSTLY_CLOUDY")
    .with("Cloudy", () => "CLOUDY")
    .with("Fog", () => "FOGGY")
    .with("Haze", "Smoke", "Dust", "BlowingDust", () => "HAZY")
    .with("Breezy", "Windy", () => "WINDY")
    .with("Drizzle", "FreezingDrizzle", () => "DRIZZLE")
    .with(
      "Rain",
      "Showers",
      "ScatteredShowers",
      "SunShowers",
      "MixedRainfall",
      "FreezingRain",
      () => "RAIN",
    )
    .with("HeavyRain", () => "HEAVY_RAIN")
    .with(
      "Thunderstorm",
      "Thunderstorms",
      "IsolatedThunderstorms",
      "ScatteredThunderstorms",
      "SevereThunderstorm",
      "StrongStorms",
      "TropicalStorm",
      "Hurricane",
      "Tornado",
      () => "THUNDERSTORMS",
    )
    .with(
      "Sleet",
      "MixedRainAndSleet",
      "MixedRainAndSnow",
      "MixedSnowAndSleet",
      "WintryMix",
      () => "SLEET",
    )
    .with(
      "Snow",
      "Flurries",
      "SunFlurries",
      "SnowShowers",
      "ScatteredSnowShowers",
      "BlowingSnow",
      () => "SNOW",
    )
    .with("HeavySnow", "Blizzard", () => "HEAVY_SNOW")
    .with("Hail", () => "HAIL")
    .with("Hot", () => "HOT")
    .with("Frigid", () => "FRIGID")
    .exhaustive();
}

/** 모르는 강수 형태는 강수 없음으로 둔다. 강수 확률·양은 별도 필드가 그대로 전달한다. */
function toPrecipitationType(type: WeatherKitPrecipitationType | null): WeatherPrecipitationType {
  if (type == null) {
    return "NONE";
  }
  return (
    match(type)
      .returnType<WeatherPrecipitationType>()
      .with("clear", () => "NONE")
      // 종류를 모르는 강수는 가장 흔한 비로 보여 준다.
      .with("precipitation", "rain", () => "RAIN")
      .with("snow", () => "SNOW")
      .with("sleet", () => "SLEET")
      .with("hail", () => "HAIL")
      .with("mixed", () => "MIXED")
      .exhaustive()
  );
}

/** 다음 1시간 구간은 형태를 모르는 강수를 비로 단정하지 않고 null로 남긴다(계약). */
function toPeriodPrecipitationType(
  type: WeatherKitPrecipitationType | null,
): WeatherPrecipitationType | null {
  if (type == null) {
    return null;
  }
  return match(type)
    .returnType<WeatherPrecipitationType | null>()
    .with("precipitation", () => null)
    .with("clear", "rain", "snow", "sleet", "hail", "mixed", (known) => toPrecipitationType(known))
    .exhaustive();
}

function toPressureTrend(trend: WeatherKitPressureTrend | null): WeatherPressureTrend {
  if (trend == null) {
    return "STEADY";
  }
  return match(trend)
    .returnType<WeatherPressureTrend>()
    .with("rising", () => "RISING")
    .with("falling", () => "FALLING")
    .with("steady", () => "STEADY")
    .exhaustive();
}

/** 달 위상은 표시 보조 값이라 모르는 값은 삭으로 둔다. */
function toMoonPhase(phase: WeatherKitMoonPhase | null): WeatherMoonPhase {
  if (phase == null) {
    return "NEW";
  }
  return match(phase)
    .returnType<WeatherMoonPhase>()
    .with("new", () => "NEW")
    .with("waxingCrescent", () => "WAXING_CRESCENT")
    .with("firstQuarter", () => "FIRST_QUARTER")
    .with("waxingGibbous", () => "WAXING_GIBBOUS")
    .with("full", () => "FULL")
    .with("waningGibbous", () => "WANING_GIBBOUS")
    .with("thirdQuarter", () => "THIRD_QUARTER")
    .with("waningCrescent", () => "WANING_CRESCENT")
    .exhaustive();
}

function toAlertSeverity(severity: WeatherKitAlertSeverity | null): WeatherAlertSeverity {
  if (severity == null) {
    return "UNKNOWN";
  }
  return match(severity)
    .returnType<WeatherAlertSeverity>()
    .with("extreme", () => "EXTREME")
    .with("severe", () => "SEVERE")
    .with("moderate", () => "MODERATE")
    .with("minor", () => "MINOR")
    .with("unknown", () => "UNKNOWN")
    .exhaustive();
}

function kilometersPerHourToMetersPerSecond(speedKmh: number): number {
  return round(speedKmh / KMH_PER_MS, 1);
}

function toPercent(ratio: number): number {
  return clamp(Math.round(ratio * 100), 0, 100);
}

function toWindDirection(degrees: number | null | undefined): number | null {
  if (degrees == null) {
    return null;
  }
  return ((Math.round(degrees) % 360) + 360) % 360;
}

function toCurrent(current: WeatherKitCurrentWeather): WeatherReportCurrent {
  return {
    observedAt: current.asOf,
    condition: toWeatherCondition(current.conditionCode),
    isDaylight: current.daylight,
    temperature: current.temperature,
    apparentTemperature: current.temperatureApparent,
    dewPoint: current.temperatureDewPoint,
    humidity: toPercent(current.humidity),
    cloudCover: toPercent(current.cloudCover),
    uvIndex: Math.max(0, Math.round(current.uvIndex)),
    windSpeed: kilometersPerHourToMetersPerSecond(current.windSpeed),
    windGust:
      current.windGust == null ? null : kilometersPerHourToMetersPerSecond(current.windGust),
    windDirection: toWindDirection(current.windDirection),
    visibility: current.visibility,
    pressure: current.pressure,
    pressureTrend: toPressureTrend(current.pressureTrend),
    precipitationIntensity: current.precipitationIntensity,
  };
}

function toNextHour(nextHour: WeatherKitNextHour | undefined): WeatherReportNextHour | null {
  if (nextHour == null) {
    return null;
  }
  return {
    periods: nextHour.summary.map((period) => {
      const isClear = period.condition === "clear";
      return {
        condition: isClear ? "CLEAR" : "PRECIPITATION",
        precipitationType: toPeriodPrecipitationType(period.condition),
        startsAt: period.startTime,
        endsAt: period.endTime ?? null,
        precipitationChance: toPercent(period.precipitationChance),
        precipitationIntensity: period.precipitationIntensity,
      };
    }),
    minutes: nextHour.minutes.map((minute) => ({
      startsAt: minute.startTime,
      precipitationChance: toPercent(minute.precipitationChance),
      precipitationIntensity: minute.precipitationIntensity,
    })),
  };
}

function toHour(hour: WeatherKitHour): WeatherReportHour {
  return {
    startsAt: hour.forecastStart,
    condition: toWeatherCondition(hour.conditionCode),
    isDaylight: hour.daylight,
    temperature: hour.temperature,
    apparentTemperature: hour.temperatureApparent,
    humidity: toPercent(hour.humidity),
    uvIndex: Math.max(0, Math.round(hour.uvIndex)),
    windSpeed: kilometersPerHourToMetersPerSecond(hour.windSpeed),
    windDirection: toWindDirection(hour.windDirection),
    precipitationChance: toPercent(hour.precipitationChance),
    precipitationAmount: hour.precipitationAmount,
    precipitationType: toPrecipitationType(hour.precipitationType),
  };
}

function toDayPart(part: WeatherKitDayPart | null | undefined): WeatherReportDayPart | null {
  if (part == null) {
    return null;
  }
  return {
    condition: toWeatherCondition(part.conditionCode),
    temperatureMin: part.temperatureMin ?? null,
    temperatureMax: part.temperatureMax ?? null,
    precipitationChance: toPercent(part.precipitationChance),
    precipitationAmount: part.precipitationAmount,
    precipitationType: toPrecipitationType(part.precipitationType),
  };
}

function toDay(day: WeatherKitDay, timezone: string): WeatherReportDay {
  return {
    date: localDateIn(day.forecastStart, timezone),
    condition: toWeatherCondition(day.conditionCode),
    temperatureMin: day.temperatureMin,
    temperatureMax: day.temperatureMax,
    precipitationChance: toPercent(day.precipitationChance),
    precipitationAmount: day.precipitationAmount,
    precipitationType: toPrecipitationType(day.precipitationType),
    snowfallAmount: day.snowfallAmount,
    uvIndexMax: Math.max(0, Math.round(day.maxUvIndex)),
    windSpeedMax:
      day.windSpeedMax == null ? null : kilometersPerHourToMetersPerSecond(day.windSpeedMax),
    windGustMax:
      day.windGustSpeedMax == null
        ? null
        : kilometersPerHourToMetersPerSecond(day.windGustSpeedMax),
    sunrise: day.sunrise ?? null,
    sunset: day.sunset ?? null,
    moonPhase: toMoonPhase(day.moonPhase),
    moonrise: day.moonrise ?? null,
    moonset: day.moonset ?? null,
    restOfDay: toDayPart(day.restOfDayForecast),
    daytime: toDayPart(day.daytimeForecast),
    overnight: toDayPart(day.overnightForecast),
  };
}

function toAlert(alert: WeatherKitAlert): WeatherReportAlert {
  return {
    id: alert.id,
    title: alert.description,
    severity: toAlertSeverity(alert.severity),
    source: alert.source,
    areaName: alert.areaName ?? null,
    effectiveAt: alert.effectiveTime,
    expiresAt: alert.expireTime,
    detailsUrl: alert.detailsUrl,
  };
}

/** WeatherKit 응답(km/h·0~1 비율)을 공급자 중립 리포트(m/s·0~100)로 바꾼다. 창 자르기는 읽을 때 한다. */
export function toWeatherReport(
  weather: WeatherKitWeather & { readonly currentWeather: WeatherKitCurrentWeather },
  timezone: string,
  requestedAt: Temporal.Instant,
): WeatherReport {
  return WeatherReport.create({
    current: toCurrent(weather.currentWeather),
    nextHour: toNextHour(weather.forecastNextHour),
    hourly: (weather.forecastHourly?.hours ?? []).map(toHour),
    daily: (weather.forecastDaily?.days ?? []).map((day) => toDay(day, timezone)),
    alerts: sortBy((weather.weatherAlerts?.alerts ?? []).map(toAlert), [
      (alert) => SEVERITY_ORDER[alert.severity],
    ]),
    // 공급자가 데이터를 읽은 시각이 있으면 그것을, 없으면 요청 시각을 쓴다.
    fetchedAt: weather.currentWeather.metadata?.readTime ?? requestedAt,
  });
}
