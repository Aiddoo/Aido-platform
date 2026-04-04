/**
 * WeatherService 통합 테스트 (Mock DB)
 *
 * @description
 * WeatherService와 WeatherRepository의 DI 통합을 검증합니다.
 * 외부 날씨 프로바이더(KMA, Airkorea, KASI 등)는 Mock으로 처리하며,
 * 실제 DB 연동은 E2E에서 담당합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test weather.integration-spec
 * ```
 */

import { Test, type TestingModule } from "@nestjs/testing";
import { UserLocationBuilder } from "@test/builders";
import { createMockDatabaseService } from "@test/mocks/mock-database.factory";
import { suppressLogger } from "@test/setup/suppress-logger";
import { CacheService } from "@/common/cache/cache.service";
import { BusinessException } from "@/common/exception/services/business-exception.service";
import { DatabaseService } from "@/database/database.service";
import {
	AIR_QUALITY_PROVIDER,
	type AirQualityProvider,
} from "@/modules/weather/providers/air/air-quality.types";
import {
	LIFESTYLE_INDEX_PROVIDER,
	type LifestyleIndexProvider,
} from "@/modules/weather/providers/lifestyle/lifestyle-index.types";
import {
	SUN_TIME_PROVIDER,
	type SunTimeProvider,
} from "@/modules/weather/providers/sun/sun-time.types";
import {
	WEATHER_PROVIDER,
	type WeatherProvider,
} from "@/modules/weather/providers/weather-provider.interface";
import { WeatherRepository } from "@/modules/weather/repositories/weather.repository";
import { WeatherService } from "@/modules/weather/services/weather.service";

describe("WeatherService 통합 테스트 (Mock DB)", () => {
	let module: TestingModule;
	let service: WeatherService;
	let repository: WeatherRepository;

	// Mock 데이터베이스 서비스
	const mockUserLocationDb = {
		findUnique: jest.fn(),
		upsert: jest.fn(),
		deleteMany: jest.fn(),
	};

	const mockDatabaseService = createMockDatabaseService({
		userLocation: mockUserLocationDb,
	});

	// Mock Weather Provider
	const mockWeatherProvider: WeatherProvider = {
		name: "mock",
		getForecast: jest.fn().mockResolvedValue({
			date: new Date(),
			skyCondition: "CLEAR",
			precipitationType: "NONE",
			precipitationProbability: 10,
			temperatureMin: 8,
			temperatureMax: 20,
			humidity: 55,
			windSpeed: 3.5,
			hourlyForecasts: [
				{
					hour: 12,
					temperature: 15,
					skyCondition: "CLEAR",
					precipitationProbability: 10,
					precipitationAmount: 0,
					snowAmount: 0,
				},
			],
			dailyForecasts: [],
		}),
		isConfigured: jest.fn().mockReturnValue(true),
	};

	// Mock Air Quality Provider
	const mockAirQualityProvider: AirQualityProvider = {
		getAirQuality: jest.fn().mockResolvedValue({ pm10: 45, pm25: 22 }),
	};

	// Mock Lifestyle Index Provider
	const mockLifestyleIndexProvider: LifestyleIndexProvider = {
		getIndex: jest
			.fn()
			.mockResolvedValue({ feelsLikeTemperature: 12, uvIndex: 5 }),
	};

	// Mock Sun Time Provider
	const mockSunTimeProvider: SunTimeProvider = {
		getSunTime: jest
			.fn()
			.mockResolvedValue({ sunrise: "06:15", sunset: "18:45" }),
	};

	// Mock CacheService
	const mockCacheService = {
		get: jest.fn().mockResolvedValue(null),
		set: jest.fn().mockResolvedValue(undefined),
		mget: jest.fn().mockResolvedValue([]),
		mset: jest.fn().mockResolvedValue(undefined),
		del: jest.fn().mockResolvedValue(undefined),
		delByPattern: jest.fn().mockResolvedValue(undefined),
	};

	beforeAll(async () => {
		suppressLogger();

		module = await Test.createTestingModule({
			providers: [
				WeatherService,
				WeatherRepository,
				{ provide: DatabaseService, useValue: mockDatabaseService },
				{ provide: WEATHER_PROVIDER, useValue: mockWeatherProvider },
				{ provide: AIR_QUALITY_PROVIDER, useValue: mockAirQualityProvider },
				{
					provide: LIFESTYLE_INDEX_PROVIDER,
					useValue: mockLifestyleIndexProvider,
				},
				{ provide: SUN_TIME_PROVIDER, useValue: mockSunTimeProvider },
				{ provide: CacheService, useValue: mockCacheService },
			],
		}).compile();

		service = module.get(WeatherService);
		repository = module.get(WeatherRepository);
	});

	afterAll(async () => {
		await module.close();
	});

	beforeEach(() => {
		jest.clearAllMocks();
		UserLocationBuilder.resetIdCounter();
	});

	// ========================================
	// DI 통합 검증
	// ========================================

	describe("DI 통합", () => {
		it("WeatherService가 정상적으로 생성되어야 한다", () => {
			// Then
			expect(service).toBeDefined();
		});

		it("WeatherRepository가 정상적으로 생성되어야 한다", () => {
			// Then
			expect(repository).toBeDefined();
		});
	});

	// ========================================
	// upsertLocation
	// ========================================

	describe("upsertLocation", () => {
		it("위치를 등록하고 결과를 반환해야 한다", async () => {
			// Given
			const location = UserLocationBuilder.create("user-1").build();
			mockUserLocationDb.findUnique.mockResolvedValue(null);
			mockUserLocationDb.upsert.mockResolvedValue(location);

			// When
			const result = await service.upsertLocation("user-1", 37.5665, 126.978);

			// Then
			expect(result.latitude).toBe(37.5665);
			expect(mockUserLocationDb.upsert).toHaveBeenCalled();
		});
	});

	// ========================================
	// getForecastForUser
	// ========================================

	describe("getForecastForUser", () => {
		it("위치가 등록된 사용자의 예보를 조회해야 한다", async () => {
			// Given
			const location = UserLocationBuilder.create("user-1").build();
			mockUserLocationDb.findUnique.mockResolvedValue(location);

			// When
			const result = await service.getForecastForUser("user-1", new Date());

			// Then
			expect(result.forecast).toBeDefined();
			expect(result.forecast.skyCondition).toBe("CLEAR");
			expect(result.location).toEqual(location);
		});

		it("위치가 미등록이면 BusinessException을 던져야 한다", async () => {
			// Given
			mockUserLocationDb.findUnique.mockResolvedValue(null);

			// When & Then
			await expect(
				service.getForecastForUser("user-999", new Date()),
			).rejects.toThrow(BusinessException);
		});
	});

	// ========================================
	// getConditionsForUser
	// ========================================

	describe("getConditionsForUser", () => {
		it("위치가 등록된 사용자의 부가 정보를 조회해야 한다", async () => {
			// Given
			const location = UserLocationBuilder.create("user-1").build();
			mockUserLocationDb.findUnique.mockResolvedValue(location);

			// When
			const result = await service.getConditionsForUser("user-1", new Date());

			// Then
			expect(result).toHaveProperty("feelsLikeTemperature");
			expect(result).toHaveProperty("uvIndex");
			expect(result).toHaveProperty("sunrise");
			expect(result).toHaveProperty("sunset");
			expect(result).toHaveProperty("pm10");
			expect(result).toHaveProperty("pm25");
		});

		it("위치가 미등록이면 BusinessException을 던져야 한다", async () => {
			// Given
			mockUserLocationDb.findUnique.mockResolvedValue(null);

			// When & Then
			await expect(
				service.getConditionsForUser("user-999", new Date()),
			).rejects.toThrow(BusinessException);
		});
	});
});
