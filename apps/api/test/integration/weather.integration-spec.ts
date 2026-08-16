/**
 * Weather 통합 테스트 (Mock DB)
 *
 * @description
 * endpoint use-case → WeatherForecastReader / Prisma
 * 위치 어댑터의 수직 배선을 검증합니다. 외부 날씨 프로바이더(KMA·Airkorea·KASI)와
 * 캐시는 Mock으로 처리하며, 실제 DB 연동은 E2E에서 담당합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test weather.integration-spec
 * ```
 */

import { TransactionHost } from "@nestjs-cls/transactional";
import { Test, type TestingModule } from "@nestjs/testing";
import { UserLocationBuilder } from "@test/builders";
import { createMockDatabaseService } from "@test/mocks/mock-database.factory";
import { suppressLogger } from "@test/setup/suppress-logger";

import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import {
	AIR_QUALITY_PROVIDER,
	type AirQualityProvider,
} from "@/weather/application/ports/air-quality-provider.port";
import {
	LIFESTYLE_INDEX_PROVIDER,
	type LifestyleIndexProvider,
} from "@/weather/application/ports/lifestyle-index-provider.port";
import {
	SUN_TIME_PROVIDER,
	type SunTimeProvider,
} from "@/weather/application/ports/sun-time-provider.port";
import { WEATHER_CACHE } from "@/weather/application/ports/weather-cache.port";
import { WEATHER_LOCATION_REPOSITORY } from "@/weather/application/ports/weather-location.repository.port";
import {
	WEATHER_PROVIDER,
	type WeatherProvider,
} from "@/weather/application/ports/weather-provider.port";
import { GetWeatherConditionsUseCase } from "@/weather/application/queries/get-weather-conditions/get-weather-conditions.use-case";
import { GetWeatherForecastUseCase } from "@/weather/application/queries/get-weather-forecast/get-weather-forecast.use-case";
import { WeatherForecastReader } from "@/weather/application/services/weather-forecast.reader";
import { UpsertLocationUseCase } from "@/weather/application/use-cases/upsert-location/upsert-location.use-case";
import { WEATHER_PROVIDERS } from "@/weather/application/weather.providers";
import { WeatherCacheAdapter } from "@/weather/infrastructure/adapters/weather-cache.adapter";
import { PrismaWeatherLocationRepository } from "@/weather/infrastructure/persistence/prisma-weather-location.repository";

describe("Weather 통합 테스트 (Mock DB)", () => {
	let module: TestingModule;
	let upsertLocationUseCase: UpsertLocationUseCase;
	let getWeatherForecastUseCase: GetWeatherForecastUseCase;
	let getWeatherConditionsUseCase: GetWeatherConditionsUseCase;

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

	const mockAirQualityProvider: AirQualityProvider = {
		getAirQuality: jest.fn().mockResolvedValue({ pm10: 45, pm25: 22 }),
	};

	const mockLifestyleIndexProvider: LifestyleIndexProvider = {
		getIndex: jest.fn().mockResolvedValue({ feelsLikeTemperature: 12, uvIndex: 5 }),
	};

	const mockSunTimeProvider: SunTimeProvider = {
		getSunTime: jest.fn().mockResolvedValue({ sunrise: "06:15", sunset: "18:45" }),
	};

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

		// 클린아키 수직 배선: Facade → use-case → 리더/어댑터(mock 인프라)
		module = await Test.createTestingModule({
			providers: [
				WeatherForecastReader,
				...WEATHER_PROVIDERS,
				{
					provide: WEATHER_LOCATION_REPOSITORY,
					useClass: PrismaWeatherLocationRepository,
				},
				{
					// 어댑터가 CLS에서 tx를 읽음 — 활성 tx 없음 = 베이스 클라이언트 폴백
					provide: TransactionHost,
					useValue: { tx: mockDatabaseService },
				},
				{ provide: WEATHER_PROVIDER, useValue: mockWeatherProvider },
				{ provide: AIR_QUALITY_PROVIDER, useValue: mockAirQualityProvider },
				{
					provide: LIFESTYLE_INDEX_PROVIDER,
					useValue: mockLifestyleIndexProvider,
				},
				{ provide: SUN_TIME_PROVIDER, useValue: mockSunTimeProvider },
				{ provide: CacheService, useValue: mockCacheService },
				// application은 WEATHER_CACHE 포트에 의존 — 실제 어댑터가 mock CacheService를 래핑
				{ provide: WEATHER_CACHE, useClass: WeatherCacheAdapter },
			],
		}).compile();

		await module.init();
		upsertLocationUseCase = module.get(UpsertLocationUseCase);
		getWeatherForecastUseCase = module.get(GetWeatherForecastUseCase);
		getWeatherConditionsUseCase = module.get(GetWeatherConditionsUseCase);
	});

	afterAll(async () => {
		await module.close();
	});

	beforeEach(() => {
		jest.clearAllMocks();
		UserLocationBuilder.resetIdCounter();
	});

	describe("DI 통합", () => {
		it("endpoint 유스케이스가 정상적으로 생성되어야 한다", () => {
			expect(upsertLocationUseCase).toBeDefined();
			expect(getWeatherForecastUseCase).toBeDefined();
			expect(getWeatherConditionsUseCase).toBeDefined();
		});
	});

	describe("upsertLocation", () => {
		it("위치를 등록하고 결과를 반환해야 한다", async () => {
			// Given
			const location = UserLocationBuilder.create("user-1").build();
			mockUserLocationDb.findUnique.mockResolvedValue(null);
			mockUserLocationDb.upsert.mockResolvedValue(location);

			// When
			const result = await upsertLocationUseCase.execute({
				userId: "user-1",
				latitude: 37.5665,
				longitude: 126.978,
			});

			// Then
			expect(result.latitude).toBe(location.latitude);
			expect(mockUserLocationDb.upsert).toHaveBeenCalled();
		});
	});

	describe("getForecastForUser", () => {
		it("위치가 등록된 사용자의 예보를 조회해야 한다", async () => {
			// Given
			const location = UserLocationBuilder.create("user-1").build();
			mockUserLocationDb.findUnique.mockResolvedValue(location);

			// When
			const result = await getWeatherForecastUseCase.execute({
				userId: "user-1",
				date: new Date(),
			});

			// Then
			expect(result.forecast).toBeDefined();
			expect(result.forecast.skyCondition).toBe("CLEAR");
			expect(result.location.userId).toBe("user-1");
		});

		it("위치가 미등록이면 ApplicationException을 던져야 한다", async () => {
			// Given
			mockUserLocationDb.findUnique.mockResolvedValue(null);

			// When & Then
			await expect(
				getWeatherForecastUseCase.execute({
					userId: "user-999",
					date: new Date(),
				}),
			).rejects.toThrow(ApplicationException);
		});
	});

	describe("getConditionsForUser", () => {
		it("위치가 등록된 사용자의 부가 정보를 조회해야 한다", async () => {
			// Given
			const location = UserLocationBuilder.create("user-1").build();
			mockUserLocationDb.findUnique.mockResolvedValue(location);

			// When
			const result = await getWeatherConditionsUseCase.execute({
				userId: "user-1",
				date: new Date(),
			});

			// Then
			expect(result).toHaveProperty("feelsLikeTemperature");
			expect(result).toHaveProperty("uvIndex");
			expect(result).toHaveProperty("sunrise");
			expect(result).toHaveProperty("sunset");
			expect(result).toHaveProperty("pm10");
			expect(result).toHaveProperty("pm25");
		});

		it("위치가 미등록이면 ApplicationException을 던져야 한다", async () => {
			// Given
			mockUserLocationDb.findUnique.mockResolvedValue(null);

			// When & Then
			await expect(
				getWeatherConditionsUseCase.execute({
					userId: "user-999",
					date: new Date(),
				}),
			).rejects.toThrow(ApplicationException);
		});
	});
});
