import dayjs from "dayjs";
import type { Mocked } from "vitest";
import { vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import {
  NotificationHistoryReader,
  NotificationPublisher,
} from "#api/modules/notification/notification-delivery.public";
import type { WeatherForecast } from "#api/modules/weather/weather-forecast.public";
import { WeatherForecastAccess } from "#api/modules/weather/weather-forecast.public";

import type { TimezoneContext } from "../../../domain/services/reminders/timezone-context.js";
import { type WeatherReminderReaderPort } from "../../ports/reminders/weather-reminder-reader.port.js";
import { WeatherEveningStrategy } from "./weather-evening.strategy.js";

const TZ = "Asia/Seoul";

const makeCtx = (overrides?: Partial<TimezoneContext>): TimezoneContext => ({
  tz: TZ,
  localHour: 18,
  localMinute: 0,
  dayOfWeek: 2,
  today: dayjs.utc("2024-01-16").startOf("day").toDate(),
  tomorrow: dayjs.utc("2024-01-17").startOf("day").toDate(),
  ...overrides,
});

const makeForecast = (overrides?: Partial<WeatherForecast>): WeatherForecast => ({
  date: new Date("2024-01-17"),
  skyCondition: "CLOUDY",
  precipitationType: "RAIN",
  precipitationProbability: 80,
  temperatureMin: 2,
  temperatureMax: 8,
  humidity: 70,
  windSpeed: 3.5,
  hourlyForecasts: [],
  dailyForecasts: [],
  ...overrides,
});

describe("WeatherEveningStrategy — 저녁 날씨 알림 전략", () => {
  let strategy: WeatherEveningStrategy;
  let reader: Mocked<WeatherReminderReaderPort>;
  let notificationPublisher: Mocked<NotificationPublisher>;
  let notificationHistoryReader: Mocked<NotificationHistoryReader>;
  let weatherForecastAccess: Mocked<WeatherForecastAccess>;

  beforeEach(async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const weatherEveningStrategyDependencies = mockDeep<
      ConstructorParameters<typeof WeatherEveningStrategy>[0]
    >({});
    const unit = new WeatherEveningStrategy(weatherEveningStrategyDependencies);

    strategy = unit;
    reader = weatherEveningStrategyDependencies.reader;
    notificationPublisher = weatherEveningStrategyDependencies.notificationPublisher;
    notificationHistoryReader = weatherEveningStrategyDependencies.notificationHistoryReader;
    weatherForecastAccess = weatherEveningStrategyDependencies.weatherForecastAccess;

    reader.findWeatherEveningUsersWithLocation.mockResolvedValue([]);
    reader.findWeatherEveningFallbackUsers.mockResolvedValue([]);
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
  });

  it("내일 날씨를 기반으로 알림을 발송해야 한다", async () => {
    // Given — 1단계: 위치 있는 유저, 2단계: 위치 없는 유저 (없음)
    reader.findWeatherEveningUsersWithLocation.mockResolvedValue([
      {
        id: "user-1",
        preference: null,
        location: { latitude: 37.5, longitude: 126.9, gridX: 60, gridY: 127 },
      },
    ]);

    const forecastMap = new Map<string, WeatherForecast>();
    forecastMap.set("60:127", makeForecast());
    weatherForecastAccess.getForecastsByGridBatch.mockResolvedValue(forecastMap);

    // When
    const result = await strategy.execute(makeCtx());

    // Then
    expect(result).toEqual({ sent: 1 });
    // tomorrow 날짜로 날씨 조회
    expect(weatherForecastAccess.getForecastsByGridBatch).toHaveBeenCalledWith(
      expect.any(Array),
      makeCtx().tomorrow,
    );
    expect(notificationPublisher.publishBatch).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          userId: "user-1",
          type: "WEATHER_EVENING",
        }),
      ]),
    );
  });

  it("저녁 알림 시각(시:분)으로 리더를 조회해야 한다", async () => {
    // When
    await strategy.execute(makeCtx());

    // Then
    expect(reader.findWeatherEveningUsersWithLocation).toHaveBeenCalledWith(
      expect.objectContaining({
        tz: TZ,
        hour: 18,
        minute: 0,
      }),
    );
  });
});
