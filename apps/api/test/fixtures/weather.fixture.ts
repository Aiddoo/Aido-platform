import type { WeatherReportAttribution } from "#api/modules/weather/application/models/forecast/weather-report.model";
import type {
  WeatherReport,
  WeatherReportHour,
} from "#api/modules/weather/application/models/forecast/weather-report.model";
import type {
  WeatherConditions,
  WeatherForecast,
} from "#api/modules/weather/application/ports/forecast/weather-provider.port";
import { UserLocation } from "#api/modules/weather/domain/entities/forecast/user-location.entity";
import type { KmaForecastTiming } from "#api/modules/weather/domain/policies/forecast/kma-forecast-availability.policy";
import { UserLocationBuilder } from "#test/builders/user-location.builder";

export const weatherAttributionFixture = {
  provider: "APPLE_WEATHER",
  serviceName: "Apple Weather",
  legalPageUrl: "https://developer.apple.com/weatherkit/data-source-attribution/",
  logo: {
    light: {
      "1x": "https://weatherkit.apple.com/assets/branding/ko/logo-light-1x.png",
      "2x": "https://weatherkit.apple.com/assets/branding/ko/logo-light-2x.png",
      "3x": "https://weatherkit.apple.com/assets/branding/ko/logo-light-3x.png",
    },
    dark: {
      "1x": "https://weatherkit.apple.com/assets/branding/ko/logo-dark-1x.png",
      "2x": "https://weatherkit.apple.com/assets/branding/ko/logo-dark-2x.png",
      "3x": "https://weatherkit.apple.com/assets/branding/ko/logo-dark-3x.png",
    },
  },
} as const satisfies WeatherReportAttribution;

/** 대상 날짜와 같은 시각의 발표에서 예보를 받는 timing (발표를 당기지 않는 경우) */
export function kmaTimingFixture(target: Date, issuance: Date = target): KmaForecastTiming {
  return { target, issuance };
}

export function weatherForecastFixture(overrides: Partial<WeatherForecast> = {}): WeatherForecast {
  const date = overrides.date ?? new Date("2026-07-23T00:00:00.000Z");
  return {
    skyCondition: "CLEAR",
    precipitationType: "NONE",
    precipitationProbability: 0,
    temperatureMin: 1,
    temperatureMax: 30,
    humidity: 55,
    windSpeed: 4,
    hourlyForecasts: [0, 9, 17].map((hour) => ({
      hour,
      temperature: hour === 9 ? 25 : hour === 0 ? 1 : 15,
      skyCondition: "CLEAR",
      precipitationProbability: 0,
      precipitationAmount: 0,
      snowAmount: 0,
    })),
    dailyForecasts: [
      {
        date: date.toISOString().slice(0, 10),
        skyCondition: "CLEAR",
        precipitationType: "NONE",
        precipitationProbability: 0,
        temperatureMin: 1,
        temperatureMax: 30,
      },
    ],
    ...overrides,
    date: new Date(date),
  };
}

export function weatherConditionsFixture(
  overrides: Partial<WeatherConditions> = {},
): WeatherConditions {
  return {
    feelsLikeTemperature: 25,
    uvIndex: 0,
    sunrise: "05:23",
    sunset: "19:00",
    pm10: 0,
    pm25: 0,
    ...overrides,
  };
}

export function weatherLocationFixture(
  userId = "weather-user",
  city: "서울" | "부산" | "도쿄" = "서울",
) {
  const builder = UserLocationBuilder.create(userId);
  const presets = {
    서울: () => builder,
    부산: () => builder.asBusan(),
    도쿄: () => builder.asTokyo(),
  } as const;
  return UserLocation.reconstitute(presets[city]().build());
}

const HOUR_MS = 60 * 60_000;

/** fetchedAt 정각부터 30시간·11일을 담은 서울 기준 공급자 중립 스냅샷 */
export function weatherReportFixture(
  fetchedAt = new Date("2026-11-02T06:20:00.000Z"),
  overrides: Partial<WeatherReport> = {},
): WeatherReport {
  const hourStartMs = Math.floor(fetchedAt.getTime() / HOUR_MS) * HOUR_MS;
  const hourly = Array.from({ length: 30 }, (_, index): WeatherReportHour => ({
    startsAt: new Date(hourStartMs + index * HOUR_MS),
    condition: "CLEAR",
    isDaylight: true,
    temperature: 12 + (index % 5),
    apparentTemperature: 10,
    humidity: 60,
    uvIndex: 1,
    windSpeed: 3.2,
    windDirection: 270,
    precipitationChance: 10,
    precipitationAmount: 0,
    precipitationType: "NONE",
  }));
  const firstDay = Date.UTC(
    fetchedAt.getUTCFullYear(),
    fetchedAt.getUTCMonth(),
    fetchedAt.getUTCDate(),
  );
  const daily = Array.from({ length: 11 }, (_, index) => ({
    date: new Date(firstDay + index * 24 * HOUR_MS).toISOString().slice(0, 10),
    condition: "PARTLY_CLOUDY" as const,
    temperatureMin: 8,
    temperatureMax: 16,
    precipitationChance: 20,
    precipitationAmount: 0.4,
    precipitationType: "RAIN" as const,
    snowfallAmount: 0,
    uvIndexMax: 3,
    windSpeedMax: 5.1,
    windGustMax: null,
    sunrise: new Date(firstDay + index * 24 * HOUR_MS - 2 * HOUR_MS),
    sunset: new Date(firstDay + index * 24 * HOUR_MS + 8 * HOUR_MS),
    moonPhase: "WANING_CRESCENT" as const,
    moonrise: null,
    moonset: new Date(firstDay + index * 24 * HOUR_MS + 5 * HOUR_MS),
    restOfDay: null,
    daytime: null,
    overnight: null,
  }));
  return {
    current: {
      observedAt: fetchedAt,
      condition: "CLEAR",
      isDaylight: true,
      temperature: 12.4,
      apparentTemperature: 10.1,
      dewPoint: 4.5,
      humidity: 58,
      cloudCover: 10,
      uvIndex: 1,
      windSpeed: 3.2,
      windGust: null,
      windDirection: 270,
      visibility: 20_000,
      pressure: 1018.2,
      pressureTrend: "STEADY",
      precipitationIntensity: 0,
    },
    nextHour: null,
    hourly,
    daily,
    alerts: [],
    attribution: weatherAttributionFixture,
    fetchedAt,
    ...overrides,
  };
}
