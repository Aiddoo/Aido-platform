/**
 * WeatherMorningStrategy 단위 테스트
 *
 * @description
 * 오전 날씨 알림 전략의 유저 필터링, 격자 배칭, dedup, 알림 발송 검증.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test weather-morning.strategy.spec
 * ```
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import dayjs from "dayjs";
import { NotificationService } from "@/notification";
import type { WeatherForecast } from "@/weather";
import { WeatherFacade } from "@/weather";

import type { TimezoneContext } from "../../domain/services/timezone-context";
import {
	WEATHER_REMINDER_READER,
	type WeatherReminderReaderPort,
} from "../ports/weather-reminder-reader.port";
import { WeatherMorningStrategy } from "./weather-morning.strategy";

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
	let notificationService: Mocked<NotificationService>;
	let weatherFacade: Mocked<WeatherFacade>;

	beforeEach(async () => {
		jest.spyOn(Math, "random").mockReturnValue(0);

		const { unit, unitRef } = await TestBed.solitary(
			WeatherMorningStrategy,
		).compile();

		strategy = unit;
		reader = unitRef.get(WEATHER_REMINDER_READER);
		notificationService = unitRef.get(NotificationService);
		weatherFacade = unitRef.get(WeatherFacade);

		reader.findWeatherMorningUsersWithLocation.mockResolvedValue([]);
		reader.findWeatherMorningFallbackUsers.mockResolvedValue([]);
		notificationService.findAlreadyNotifiedUserIds.mockResolvedValue(new Set());
		notificationService.createAndSendBatch.mockResolvedValue({ count: 0 });
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("대상 유저가 없으면 sent: 0을 반환해야 한다", async () => {
		// When
		const result = await strategy.execute(makeCtx());

		// Then
		expect(result).toEqual({ sent: 0 });
		expect(weatherFacade.getForecastsByGridBatch).not.toHaveBeenCalled();
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
		notificationService.findAlreadyNotifiedUserIds.mockResolvedValue(
			new Set(["user-1"]),
		);

		// When
		const result = await strategy.execute(makeCtx());

		// Then
		expect(result).toEqual({ sent: 0 });
		expect(weatherFacade.getForecastsByGridBatch).not.toHaveBeenCalled();
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
		weatherFacade.getForecastsByGridBatch.mockResolvedValue(forecastMap);

		// When
		const result = await strategy.execute(makeCtx());

		// Then
		expect(result).toEqual({ sent: 1 });
		expect(notificationService.createAndSendBatch).toHaveBeenCalledWith(
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
		weatherFacade.getForecastsByGridBatch.mockResolvedValue(forecastMap);

		// When
		const result = await strategy.execute(makeCtx());

		// Then
		expect(result).toEqual({ sent: 2 });
		// getForecastsByGridBatch에 격자 1개만 전달
		expect(weatherFacade.getForecastsByGridBatch).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ gridX: 60, gridY: 127 }),
			]),
			expect.any(Date),
		);
		const gridsArg = weatherFacade.getForecastsByGridBatch.mock.calls[0]?.[0];
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
