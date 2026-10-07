import type {
  WeatherConditions,
  WeatherForecast,
} from "#api/modules/weather/application/ports/forecast/weather-provider.port";
import { UserLocation } from "#api/modules/weather/domain/entities/forecast/user-location.entity";
import { UserLocationBuilder } from "#test/builders/user-location.builder";

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

export function weatherLocationFixture(userId = "weather-user", city: "서울" | "부산" = "서울") {
  const builder = UserLocationBuilder.create(userId);
  return UserLocation.reconstitute(city === "부산" ? builder.asBusan().build() : builder.build());
}
