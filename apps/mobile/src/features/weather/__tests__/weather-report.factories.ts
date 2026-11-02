import type { WeatherHourlyForecast, WeatherReportResponse } from '@aido/api';

import { toWeatherReport } from '../apis/weather.mapper';
import type { WeatherReport } from '../domains/weather-report.model';

const HOUR_MS = 60 * 60_000;

export function createHourlyForecastDto(
  overrides: Partial<WeatherHourlyForecast> = {},
): WeatherHourlyForecast {
  return {
    startsAt: '2026-11-02T06:00:00.000Z',
    condition: 'CLOUDY',
    isDaylight: true,
    temperature: 12.4,
    apparentTemperature: 9.1,
    humidity: 70,
    uvIndex: 1,
    windSpeed: 3.2,
    windDirection: 315,
    precipitationChance: 10,
    precipitationAmount: 0,
    precipitationType: 'NONE',
    ...overrides,
  };
}

/** 시작 시각부터 1시간 간격의 예보. chances[i]가 i번째 시간의 강수 확률이다. */
export function createHourlySeries(startsAt: string, chances: readonly number[]) {
  const start = Date.parse(startsAt);
  return chances.map((chance, index) =>
    createHourlyForecastDto({
      startsAt: new Date(start + index * HOUR_MS).toISOString(),
      precipitationChance: chance,
      precipitationType: chance >= 50 ? 'RAIN' : 'NONE',
    }),
  );
}

export function createWeatherReportDto(
  overrides: Partial<WeatherReportResponse> = {},
): WeatherReportResponse {
  return {
    location: { latitude: 37.5636, longitude: 126.9976, timezone: 'Asia/Seoul' },
    current: {
      observedAt: '2026-11-02T06:26:00.000Z',
      condition: 'CLOUDY',
      isDaylight: true,
      temperature: 12.4,
      apparentTemperature: 9.1,
      dewPoint: 10.5,
      humidity: 88,
      cloudCover: 100,
      uvIndex: 1,
      windSpeed: 4.6,
      windGust: 9.2,
      windDirection: 315,
      visibility: 8000,
      pressure: 1012.3,
      pressureTrend: 'FALLING',
      precipitationIntensity: 0,
    },
    nextHour: null,
    hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [10, 10, 10, 10]),
    daily: [
      {
        date: '2026-11-02',
        condition: 'CLOUDY',
        temperatureMin: 8,
        temperatureMax: 14,
        precipitationChance: 20,
        precipitationAmount: 0,
        precipitationType: 'NONE',
        snowfallAmount: 0,
        uvIndexMax: 2,
        windSpeedMax: 6.1,
        windGustMax: 11.4,
        sunrise: '2026-11-01T21:51:00.000Z',
        sunset: '2026-11-02T08:28:00.000Z',
        moonPhase: 'WANING_CRESCENT',
        daytime: null,
        overnight: null,
      },
    ],
    alerts: [],
    airQuality: { pm10: 32, pm25: 18 },
    attribution: {
      provider: 'APPLE_WEATHER',
      legalPageUrl: 'https://developer.apple.com/weatherkit/data-source-attribution/',
    },
    fetchedAt: '2026-11-02T06:20:00.000Z',
    ...overrides,
  };
}

export function createWeatherReport(overrides: Partial<WeatherReportResponse> = {}): WeatherReport {
  return toWeatherReport(createWeatherReportDto(overrides));
}
