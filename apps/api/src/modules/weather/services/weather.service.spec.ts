/**
 * WeatherService 단위 테스트
 *
 * @description
 * 캐시 → Provider 위임, 배치 조회, 위치 관리 검증.
 * Provider는 WEATHER_PROVIDER 토큰으로 Mock 주입.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test weather.service.spec
 * ```
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { CacheService } from "@/common/cache/cache.service";

import {
	WEATHER_PROVIDER,
	type WeatherForecast,
	type WeatherProvider,
} from "../providers/weather-provider.interface";
import { WeatherRepository } from "../repositories/weather.repository";
import { WeatherService } from "./weather.service";

const makeForecast = (
	overrides?: Partial<WeatherForecast>,
): WeatherForecast => ({
	date: new Date("2024-01-16"),
	skyCondition: "CLEAR",
	precipitationType: "NONE",
	precipitationProbability: 10,
	temperatureMin: 5,
	temperatureMax: 12,
	humidity: 45,
	windSpeed: 2.5,
	hourlyForecasts: [],
	...overrides,
});

describe("WeatherService", () => {
	let service: WeatherService;
	let weatherProvider: Mocked<WeatherProvider>;
	let cacheService: Mocked<CacheService>;
	let weatherRepository: Mocked<WeatherRepository>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(WeatherService)
			.mock(WEATHER_PROVIDER)
			.impl(() => ({
				name: "mock",
				getForecast: jest.fn(),
				getForecasts: jest.fn(),
				isConfigured: jest.fn().mockReturnValue(true),
			}))
			.compile();

		service = unit;
		weatherProvider = unitRef.get(WEATHER_PROVIDER);
		cacheService = unitRef.get(CacheService);
		weatherRepository = unitRef.get(WeatherRepository);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe("getForecastsByGridBatch", () => {
		it("빈 격자 배열이면 빈 Map을 반환해야 한다", async () => {
			// When
			const result = await service.getForecastsByGridBatch([], new Date());

			// Then
			expect(result.size).toBe(0);
			expect(cacheService.mget).not.toHaveBeenCalled();
		});

		it("캐시 히트 시 Provider를 호출하지 않아야 한다", async () => {
			// Given
			const forecast = makeForecast();
			cacheService.mget.mockResolvedValue([forecast] as never);

			// When
			const result = await service.getForecastsByGridBatch(
				[{ gridX: 60, gridY: 127, lat: 37.5, lon: 126.9 }],
				new Date("2024-01-16"),
			);

			// Then
			expect(result.get("60:127")).toEqual(forecast);
			expect(weatherProvider.getForecast).not.toHaveBeenCalled();
			expect(cacheService.mset).not.toHaveBeenCalled();
		});

		it("캐시 미스 시 Provider 호출 후 mset으로 캐싱해야 한다", async () => {
			// Given
			const forecast = makeForecast();
			cacheService.mget.mockResolvedValue([undefined] as never);
			weatherProvider.getForecast.mockResolvedValue(forecast);

			// When
			const result = await service.getForecastsByGridBatch(
				[{ gridX: 60, gridY: 127, lat: 37.5, lon: 126.9 }],
				new Date("2024-01-16"),
			);

			// Then
			expect(result.get("60:127")).toEqual(forecast);
			expect(weatherProvider.getForecast).toHaveBeenCalledTimes(1);
			expect(cacheService.mset).toHaveBeenCalledTimes(1);
		});

		it("히트와 미스가 섞여도 미스만 API 호출해야 한다", async () => {
			// Given
			const hitForecast = makeForecast({ temperatureMin: 10 });
			const missForecast = makeForecast({ temperatureMin: -5 });
			cacheService.mget.mockResolvedValue([hitForecast, undefined] as never);
			weatherProvider.getForecast.mockResolvedValue(missForecast);

			// When
			const result = await service.getForecastsByGridBatch(
				[
					{ gridX: 60, gridY: 127, lat: 37.5, lon: 126.9 },
					{ gridX: 98, gridY: 76, lat: 35.1, lon: 129.0 },
				],
				new Date("2024-01-16"),
			);

			// Then
			expect(result.size).toBe(2);
			expect(result.get("60:127")).toEqual(hitForecast);
			expect(result.get("98:76")).toEqual(missForecast);
			expect(weatherProvider.getForecast).toHaveBeenCalledTimes(1);
		});
	});

	describe("getForecastForUser", () => {
		it("위치가 없으면 예외를 던져야 한다", async () => {
			// Given
			weatherRepository.findByUserId.mockResolvedValue(null);

			// When & Then
			await expect(
				service.getForecastForUser("user-1", new Date()),
			).rejects.toThrow();
		});

		it("위치가 있으면 캐시 wrap으로 조회해야 한다", async () => {
			// Given
			const location = {
				id: "loc-1",
				userId: "user-1",
				latitude: 37.5,
				longitude: 126.9,
				gridX: 60,
				gridY: 127,
				updatedAt: new Date(),
			};
			const forecast = makeForecast();
			weatherRepository.findByUserId.mockResolvedValue(location);
			cacheService.wrap.mockResolvedValue(forecast as never);

			// When
			const result = await service.getForecastForUser(
				"user-1",
				new Date("2024-01-16"),
			);

			// Then
			expect(result).toEqual(forecast);
			expect(cacheService.wrap).toHaveBeenCalledTimes(1);
		});
	});

	describe("upsertLocation", () => {
		it("격자 변환 후 upsert를 호출해야 한다", async () => {
			// Given
			const expected = {
				id: "loc-1",
				userId: "user-1",
				latitude: 37.5665,
				longitude: 126.978,
				gridX: 60,
				gridY: 127,
				updatedAt: new Date(),
			};
			weatherRepository.upsert.mockResolvedValue(expected);

			// When
			const result = await service.upsertLocation("user-1", 37.5665, 126.978);

			// Then
			expect(result).toEqual(expected);
			expect(weatherRepository.upsert).toHaveBeenCalledWith("user-1", {
				latitude: 37.5665,
				longitude: 126.978,
				gridX: 60,
				gridY: 127,
			});
		});
	});
});
