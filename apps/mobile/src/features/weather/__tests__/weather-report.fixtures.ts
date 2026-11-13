import {
  weatherAttributionSchema,
  weatherBriefingSchema,
  type WeatherHourlyForecast,
  weatherHourlyForecastSchema,
  type WeatherReportResponse,
  weatherReportSchema as weatherReportDtoSchema,
  weatherRescheduleOptionSchema,
} from '@aido/api/contracts/weather/v2';
import { fromEpochMs, toInstant } from '@src/shared/date/instant';
import { defineFixture } from '@src/testing/fixture';

import { toWeatherReport } from '../apis/weather.mapper';
import type { BriefingTodo, ForecastTodo } from '../domains/weather-briefing.model';
import {
  airQualitySchema,
  type CurrentWeather,
  type DailyForecastEntry,
  type WeatherReport,
} from '../domains/weather-report.model';

const HOUR_MS = 60 * 60_000;

export const createHourlyForecastDto = defineFixture(weatherHourlyForecastSchema, {
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
});

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

const LOGO_BASE_URL = 'https://weatherkit.apple.com/assets/branding/ko/Apple_Weather';

export const createAttributionDto = defineFixture(weatherAttributionSchema, {
  provider: 'APPLE_WEATHER',
  serviceName: 'Apple Weather',
  legalPageUrl: 'https://developer.apple.com/weatherkit/data-source-attribution/',
  logo: {
    light: {
      '1x': `${LOGO_BASE_URL}_blk_ko_1X_090122.png`,
      '2x': `${LOGO_BASE_URL}_blk_ko_2X_090122.png`,
      '3x': `${LOGO_BASE_URL}_blk_ko_3X_090122.png`,
    },
    dark: {
      '1x': `${LOGO_BASE_URL}_wht_ko_1X_090122.png`,
      '2x': `${LOGO_BASE_URL}_wht_ko_2X_090122.png`,
      '3x': `${LOGO_BASE_URL}_wht_ko_3X_090122.png`,
    },
  },
});

/** 서버가 판단한 브리핑. 기본은 날씨와 겹친 할 일이 없다. */
export const createBriefingDto = defineFixture(weatherBriefingSchema, {
  reason: null,
  affectedTodoIds: [],
  rescheduleOptions: [],
});

const rescheduleOption = defineFixture(weatherRescheduleOptionSchema, {
  startsAt: '2026-11-02T10:00:00.000Z',
  precipitationChance: 10,
  apparentTemperature: 9.1,
  isRecommended: false,
});

/** 서버가 고른 옮길 시각 후보 한 칸. 첫 후보가 추천이다. */
export function createRescheduleOptionDto(
  startsAt: string,
  overrides: Parameters<typeof rescheduleOption>[0] = {},
) {
  return rescheduleOption({ startsAt, ...overrides });
}

export const createWeatherReportDto = defineFixture(weatherReportDtoSchema, {
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
      moonPhase: 'THIRD_QUARTER',
      moonrise: null,
      moonset: '2026-11-02T04:50:15.000Z',
      restOfDay: null,
      daytime: null,
      overnight: null,
    },
  ],
  alerts: [],
  airQuality: { pm10: 32, pm25: 18, source: 'AIRKOREA' },
  attribution: createAttributionDto(),
  fetchedAt: '2026-11-02T06:20:00.000Z',
  // 서버가 30분 둔다
  expiresAt: '2026-11-02T06:50:00.000Z',
  briefing: createBriefingDto(),
  // 서버 머리글. 기본은 알릴 날씨가 없다
  headline: { kind: 'calm' },
});

export function createWeatherReport(overrides: Partial<WeatherReportResponse> = {}): WeatherReport {
  return toWeatherReport(createWeatherReportDto(overrides));
}

/** 국내: WeatherKit이 분 단위 예보·특보를 주지 않는다. 16시(07:00Z)부터 두 시간 비. */
export function createSeoulReportDto(): WeatherReportResponse {
  return createWeatherReportDto({
    nextHour: null,
    alerts: [],
    hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [10, 70, 80, 20, 10]),
  });
}

/** 일본: 분 단위 예보와 특보가 함께 온다. 17분 뒤 비가 시작된다. */
export function createTokyoReportDto(): WeatherReportResponse {
  return createWeatherReportDto({
    location: { latitude: 35.6812, longitude: 139.7671, timezone: 'Asia/Tokyo' },
    nextHour: {
      periods: [
        {
          condition: 'PRECIPITATION',
          precipitationType: 'RAIN',
          startsAt: '2026-11-02T06:43:00.000Z',
          endsAt: null,
          precipitationChance: 80,
          precipitationIntensity: 2.4,
        },
      ],
      minutes: [
        {
          startsAt: '2026-11-02T06:26:00.000Z',
          precipitationChance: 10,
          precipitationIntensity: 0,
        },
        {
          startsAt: '2026-11-02T07:25:00.000Z',
          precipitationChance: 80,
          precipitationIntensity: 2,
        },
      ],
    },
    alerts: [
      {
        id: 'jma-heavy-rain',
        title: '大雨注意報',
        severity: 'MODERATE',
        source: 'JMA',
        areaName: null,
        effectiveAt: '2026-11-02T05:00:00.000Z',
        expiresAt: '2026-11-02T12:00:00.000Z',
        detailsUrl: 'https://example.com/jma',
      },
    ],
    hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [30, 80, 20, 10]),
  });
}

/** 06:00Z부터 1시간 간격 예보. 각 항목이 그 시간의 값을 덮어쓴다. */
export function createHourlyForecasts(rows: readonly Partial<WeatherHourlyForecast>[]) {
  return rows.map((row, index) =>
    createHourlyForecastDto({
      startsAt: fromEpochMs(Date.parse('2026-11-02T06:00:00.000Z') + index * HOUR_MS),
      ...row,
    }),
  );
}

export function createWeatherReportWithHours(
  rows: readonly Partial<WeatherHourlyForecast>[],
  overrides: Partial<WeatherReportResponse> = {},
) {
  return createWeatherReport({ hourly: createHourlyForecasts(rows), ...overrides });
}

export function createCurrentWeather(overrides: Partial<CurrentWeather> = {}): CurrentWeather {
  return { ...createWeatherReport().current, ...overrides };
}

export function createDailyForecast(
  overrides: Partial<DailyForecastEntry> = {},
): DailyForecastEntry {
  const [today] = createWeatherReport().daily;
  if (today == null) {
    throw new Error('기본 예보에 일별 예보가 없습니다');
  }
  return { ...today, ...overrides };
}

export const createAirQuality = defineFixture(airQualitySchema, {
  pm10: null,
  pm25: null,
  source: 'AIRKOREA',
});

export function createForecastTodo(overrides: Partial<ForecastTodo> = {}): ForecastTodo {
  const [hour] = createWeatherReport().hourly;
  if (hour == null) {
    throw new Error('기본 예보에 시간별 예보가 없습니다');
  }
  return {
    todoId: 1,
    title: '산책',
    // 기본 예보 첫 칸(서울 15시)이다
    localTime: '15:00',
    scheduledAt: hour.startsAt,
    completed: false,
    subTodoProgress: null,
    hour,
    ...overrides,
  };
}

export function createBriefingTodo(overrides: Partial<BriefingTodo> = {}): BriefingTodo {
  return {
    id: 1,
    title: '산책',
    localTime: '16:30',
    scheduledAt: toInstant('2026-11-02T07:30:00.000Z'),
    completed: false,
    subTodoProgress: null,
    ...overrides,
  };
}
