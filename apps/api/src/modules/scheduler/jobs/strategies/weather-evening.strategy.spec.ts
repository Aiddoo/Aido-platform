/**
 * WeatherEveningStrategy 단위 테스트
 *
 * @description
 * 오후 날씨 알림 전략 검증. 내일 날씨를 기반으로 알림 발송.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test weather-evening.strategy.spec
 * ```
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import dayjs from "dayjs";

import { DatabaseService } from "@/database/database.service";
import { NotificationService } from "@/modules/notification/notification.service";
import type { WeatherForecast } from "@/modules/weather/providers/weather-provider.interface";
import { WeatherService } from "@/modules/weather/services/weather.service";
import type { TimezoneContext } from "./timezone-reminder-strategy.interface";
import { WeatherEveningStrategy } from "./weather-evening.strategy";

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

const makeForecast = (
	overrides?: Partial<WeatherForecast>,
): WeatherForecast => ({
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
	let database: Mocked<DatabaseService>;
	let notificationService: Mocked<NotificationService>;
	let weatherService: Mocked<WeatherService>;

	beforeEach(async () => {
		jest.spyOn(Math, "random").mockReturnValue(0);

		const { unit, unitRef } = await TestBed.solitary(
			WeatherEveningStrategy,
		).compile();

		strategy = unit;
		database = unitRef.get(DatabaseService);
		notificationService = unitRef.get(NotificationService);
		weatherService = unitRef.get(WeatherService);

		database.user.findMany.mockResolvedValue([] as never);
		notificationService.findAlreadyNotifiedUserIds.mockResolvedValue(new Set());
		notificationService.createAndSendBatch.mockResolvedValue(
			undefined as never,
		);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("대상 유저가 없으면 sent: 0을 반환해야 한다", async () => {
		// When
		const result = await strategy.execute(makeCtx());

		// Then
		expect(result).toEqual({ sent: 0 });
	});

	it("내일 날씨를 기반으로 알림을 발송해야 한다", async () => {
		// Given — 1단계: 위치 있는 유저, 2단계: 위치 없는 유저 (없음)
		database.user.findMany
			.mockResolvedValueOnce([
				{
					id: "user-1",
					location: { latitude: 37.5, longitude: 126.9, gridX: 60, gridY: 127 },
				},
			] as never)
			.mockResolvedValueOnce([] as never);

		const forecastMap = new Map<string, WeatherForecast>();
		forecastMap.set("60:127", makeForecast());
		weatherService.getForecastsByGridBatch.mockResolvedValue(forecastMap);

		// When
		const result = await strategy.execute(makeCtx());

		// Then
		expect(result).toEqual({ sent: 1 });
		// tomorrow 날짜로 날씨 조회
		expect(weatherService.getForecastsByGridBatch).toHaveBeenCalledWith(
			expect.any(Array),
			makeCtx().tomorrow,
		);
		expect(notificationService.createAndSendBatch).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({
					userId: "user-1",
					type: "WEATHER_EVENING",
				}),
			]),
		);
	});

	it("weatherEveningEnabled 필드로 유저를 필터링해야 한다", async () => {
		// Given
		database.user.findMany.mockResolvedValue([] as never);

		// When
		await strategy.execute(makeCtx());

		// Then
		expect(database.user.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					preference: expect.objectContaining({
						weatherEveningEnabled: true,
						weatherEveningHour: 18,
						weatherEveningMinute: 0,
					}),
				}),
			}),
		);
	});
});
