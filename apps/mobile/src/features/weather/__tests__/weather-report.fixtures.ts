import type { WeatherBriefing, WeatherHourlyForecast, WeatherReportResponse } from '@aido/api';
import { fromEpochMs, toInstant } from '@src/shared/date/instant';

import { toWeatherReport } from '../apis/weather.mapper';
import type { BriefingTodo, ForecastTodo } from '../domains/weather-briefing.model';
import type {
  AirQuality,
  CurrentWeather,
  DailyForecastEntry,
  WeatherReport,
} from '../domains/weather-report.model';

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

const LOGO_BASE_URL = 'https://weatherkit.apple.com/assets/branding/ko/Apple_Weather';

export function createAttributionDto(
  overrides: Partial<WeatherReportResponse['attribution']> = {},
): WeatherReportResponse['attribution'] {
  return {
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
    ...overrides,
  };
}

/** 서버가 판단한 브리핑. 기본은 날씨와 겹친 할 일이 없다. */
export function createBriefingDto(overrides: Partial<WeatherBriefing> = {}): WeatherBriefing {
  return { reason: null, affectedTodoIds: [], rescheduleOptions: [], ...overrides };
}

/** 서버가 고른 옮길 시각 후보 한 칸. 첫 후보가 추천이다. */
export function createRescheduleOptionDto(
  startsAt: string,
  overrides: Partial<WeatherBriefing['rescheduleOptions'][number]['options'][number]> = {},
) {
  return {
    startsAt,
    precipitationChance: 10,
    apparentTemperature: 9.1,
    isRecommended: false,
    ...overrides,
  };
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
    briefing: createBriefingDto(),
    ...overrides,
  };
}

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

/** 베트남: 분 단위 예보와 대기질이 없다. */
export function createHanoiReportDto(): WeatherReportResponse {
  return createWeatherReportDto({
    location: { latitude: 21.0278, longitude: 105.8342, timezone: 'Asia/Bangkok' },
    nextHour: null,
    airQuality: null,
    alerts: [],
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

export function createAirQuality(overrides: Partial<AirQuality> = {}): AirQuality {
  return { pm10: null, pm25: null, source: 'AIRKOREA', ...overrides };
}

export function createForecastTodo(overrides: Partial<ForecastTodo> = {}): ForecastTodo {
  const [hour] = createWeatherReport().hourly;
  if (hour == null) {
    throw new Error('기본 예보에 시간별 예보가 없습니다');
  }
  return {
    todoId: 1,
    title: '산책',
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
    scheduledAt: toInstant('2026-11-02T07:30:00.000Z'),
    completed: false,
    subTodoProgress: null,
    ...overrides,
  };
}
