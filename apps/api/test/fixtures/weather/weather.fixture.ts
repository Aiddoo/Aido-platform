import type { ForecastTiming } from "#api/modules/weather/weather-reports/application/ports/weather-forecast-provider.port";
import type {
  WeatherConditionsReadModel,
  WeatherForecastReadModel,
} from "#api/modules/weather/weather-reports/application/read-models/weather-forecast.read-model";
import type { WeatherReportAttributionReadModel } from "#api/modules/weather/weather-reports/application/read-models/weather-report-attribution.read-model";

/** WeatherKit attribution API처럼 언어별로 다른 상표 로고 경로를 돌려준다. */
export function createWeatherAttributionFixture(
  language = "ko",
): WeatherReportAttributionReadModel {
  const logoUrl = (variant: string) =>
    `https://weatherkit.apple.com/assets/branding/${language}/logo-${variant}.png`;
  return {
    provider: "APPLE_WEATHER",
    serviceName: "Apple Weather",
    legalPageUrl: "https://developer.apple.com/weatherkit/data-source-attribution/",
    logo: {
      light: { "1x": logoUrl("light-1x"), "2x": logoUrl("light-2x"), "3x": logoUrl("light-3x") },
      dark: { "1x": logoUrl("dark-1x"), "2x": logoUrl("dark-2x"), "3x": logoUrl("dark-3x") },
    },
  };
}

/** 대상 날짜와 같은 시각의 발표에서 예보를 받는 timing (발표를 당기지 않는 경우) */
export function createForecastTimingFixture(
  target: Temporal.Instant,
  issuance: Temporal.Instant = target,
): ForecastTiming {
  return { target, issuance };
}

export function createWeatherForecastFixture(
  overrides: Partial<WeatherForecastReadModel> = {},
): WeatherForecastReadModel {
  const date = overrides.date ?? Temporal.Instant.from("2026-07-23T00:00:00.000Z");
  return {
    skyCondition: "CLEAR",
    precipitationType: "NONE",
    precipitationProbability: 0,
    temperatureMin: 1,
    temperatureMax: 30,
    humidity: 55,
    windSpeed: 4,
    hourlyForecasts: (
      [
        [0, 1],
        [9, 25],
        [17, 15],
      ] as const
    ).map(([hour, temperature]) => ({
      hour,
      temperature,
      skyCondition: "CLEAR",
      precipitationProbability: 0,
      precipitationAmount: 0,
      snowAmount: 0,
    })),
    dailyForecasts: [
      {
        date: date.toZonedDateTimeISO("UTC").toPlainDate().toString(),
        skyCondition: "CLEAR",
        precipitationType: "NONE",
        precipitationProbability: 0,
        temperatureMin: 1,
        temperatureMax: 30,
      },
    ],
    ...overrides,
    date,
  };
}

export function createWeatherConditionsFixture(
  overrides: Partial<WeatherConditionsReadModel> = {},
): WeatherConditionsReadModel {
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
