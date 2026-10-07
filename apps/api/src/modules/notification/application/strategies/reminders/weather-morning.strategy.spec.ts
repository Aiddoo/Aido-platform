import dayjs from "dayjs";
import type { Mocked } from "vitest";
import { vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import {
  NotificationHistoryReader,
  NotificationPublisher,
} from "#api/modules/notification/notification-delivery.public";
import type { WeatherForecast } from "#api/modules/weather/weather-forecast.public";
import type { WeatherForecastReaderPort } from "#api/modules/weather/weather-forecast.public";

import type { TimezoneContext } from "../../../domain/services/reminders/timezone-context.js";
import { type WeatherReminderReaderPort } from "../../ports/reminders/weather-reminder-reader.port.js";
import { WeatherMorningStrategy } from "./weather-morning.strategy.js";

const TZ = "Asia/Seoul";

const makeCtx = (overrides?: Partial<TimezoneContext>): TimezoneContext => ({
  tz: TZ,
  localHour: 7,
  localMinute: 0,
  dayOfWeek: 2,
  today: dayjs.utc("2024-01-16").startOf("day").toDate(),
  tomorrow: dayjs.utc("2024-01-17").startOf("day").toDate(),
  ...overrides,
});

const makeForecast = (): WeatherForecast => ({
  date: new Date("2024-01-16"),
  skyCondition: "CLEAR",
  precipitationType: "NONE",
  precipitationProbability: 10,
  temperatureMin: 5,
  temperatureMax: 12,
  humidity: 45,
  windSpeed: 2.5,
  hourlyForecasts: [],
  dailyForecasts: [],
});

describe("WeatherMorningStrategy — 오전 날씨 알림 전략", () => {
  let strategy: WeatherMorningStrategy;
  let reader: Mocked<WeatherReminderReaderPort>;
  let notificationPublisher: Mocked<NotificationPublisher>;
  let notificationHistoryReader: Mocked<NotificationHistoryReader>;
  let weatherForecastReader: Mocked<WeatherForecastReaderPort>;

  beforeEach(async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const weatherMorningStrategyDependencies = mockDeep<
      ConstructorParameters<typeof WeatherMorningStrategy>[0]
    >({});
    const unit = new WeatherMorningStrategy(weatherMorningStrategyDependencies);

    strategy = unit;
    reader = weatherMorningStrategyDependencies.reader;
    notificationPublisher = weatherMorningStrategyDependencies.notificationPublisher;
    notificationHistoryReader = weatherMorningStrategyDependencies.notificationHistoryReader;
    weatherForecastReader = weatherMorningStrategyDependencies.weatherForecastReader;

    reader.findWeatherMorningUsersWithLocation.mockResolvedValue([]);
    reader.findWeatherMorningFallbackUsers.mockResolvedValue([]);
    notificationHistoryReader.findAlreadyNotifiedUserIds.mockResolvedValue(new Set());
    notificationPublisher.publishBatch.mockResolvedValue({ count: 0 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("대상 유저가 없으면 sent: 0을 반환해야 한다", async () => {
    // When
    const result = await strategy.execute(makeCtx());

    // Then
    expect(result).toEqual({ sent: 0 });
    expect(weatherForecastReader.getForecastsByGridBatch).not.toHaveBeenCalled();
  });

  it("이미 알림 받은 유저는 제외해야 한다", async () => {
    // Given
    reader.findWeatherMorningUsersWithLocation.mockResolvedValue([
      {
        id: "user-1",
        preference: null,
        location: { latitude: 37.5, longitude: 126.9, gridX: 60, gridY: 127 },
      },
    ]);
    notificationHistoryReader.findAlreadyNotifiedUserIds.mockResolvedValue(new Set(["user-1"]));

    // When
    const result = await strategy.execute(makeCtx());

    // Then
    expect(result).toEqual({ sent: 0 });
    expect(weatherForecastReader.getForecastsByGridBatch).not.toHaveBeenCalled();
  });

  it("대상 유저에게 날씨 알림을 발송해야 한다", async () => {
    // Given — 1단계: 위치 있는 유저, 2단계: 위치 없는 유저 (없음)
    reader.findWeatherMorningUsersWithLocation.mockResolvedValue([
      {
        id: "user-1",
        preference: null,
        location: { latitude: 37.5, longitude: 126.9, gridX: 60, gridY: 127 },
      },
    ]);

    const forecastMap = new Map<string, WeatherForecast>();
    forecastMap.set("60:127", makeForecast());
    weatherForecastReader.getForecastsByGridBatch.mockResolvedValue(forecastMap);

    // When
    const result = await strategy.execute(makeCtx());

    // Then
    expect(result).toEqual({ sent: 1 });
    expect(notificationPublisher.publishBatch).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          userId: "user-1",
          type: "WEATHER_MORNING",
        }),
      ]),
    );
  });

  it("같은 격자의 유저들은 하나의 API 호출로 처리해야 한다", async () => {
    // Given — 2명이 같은 격자 (1단계), 위치 없는 유저 없음 (2단계)
    reader.findWeatherMorningUsersWithLocation.mockResolvedValue([
      {
        id: "user-1",
        preference: null,
        location: {
          latitude: 37.56,
          longitude: 126.97,
          gridX: 60,
          gridY: 127,
        },
      },
      {
        id: "user-2",
        preference: null,
        location: {
          latitude: 37.57,
          longitude: 126.98,
          gridX: 60,
          gridY: 127,
        },
      },
    ]);

    const forecastMap = new Map<string, WeatherForecast>();
    forecastMap.set("60:127", makeForecast());
    weatherForecastReader.getForecastsByGridBatch.mockResolvedValue(forecastMap);

    // When
    const result = await strategy.execute(makeCtx());

    // Then
    expect(result).toEqual({ sent: 2 });
    // getForecastsByGridBatch에 격자 1개만 전달
    expect(weatherForecastReader.getForecastsByGridBatch).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ gridX: 60, gridY: 127 })]),
      expect.any(Date),
    );
    const gridsArg = weatherForecastReader.getForecastsByGridBatch.mock.calls[0]?.[0];
    expect(gridsArg).toHaveLength(1);
  });

  it("catch-up: userId가 있으면 리더 조회에 포함해야 한다", async () => {
    // When
    await strategy.execute(makeCtx({ userId: "user-specific" }));

    // Then
    expect(reader.findWeatherMorningUsersWithLocation).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-specific",
      }),
    );
  });
});
