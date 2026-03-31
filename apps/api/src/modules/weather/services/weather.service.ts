import { Inject, Injectable, Logger } from "@nestjs/common";

import { CacheService } from "@/common/cache/cache.service";
import { CacheKeys } from "@/common/cache/constants/cache-keys";
import { BusinessExceptions } from "@/common/exception/services/business-exception.service";

import type { UserLocation } from "@/generated/prisma/client";
import {
	AIR_QUALITY_PROVIDER,
	type AirQualityProvider,
} from "../providers/air/air-quality.types";
import { getKmaBaseDateTime } from "../providers/kma/kma.constants";
import { convertToGrid } from "../providers/kma/lambert-projection";
import {
	LIFESTYLE_INDEX_PROVIDER,
	type LifestyleIndexProvider,
} from "../providers/lifestyle/lifestyle-index.types";
import {
	SUN_TIME_PROVIDER,
	type SunTimeProvider,
} from "../providers/sun/sun-time.types";
import {
	WEATHER_PROVIDER,
	type WeatherConditions,
	type WeatherForecast,
	type WeatherProvider,
} from "../providers/weather-provider.interface";
import { WeatherRepository } from "../repositories/weather.repository";

export interface GridInput {
	gridX: number;
	gridY: number;
	lat: number;
	lon: number;
}

@Injectable()
export class WeatherService {
	readonly #logger = new Logger(WeatherService.name);

	constructor(
		@Inject(WEATHER_PROVIDER)
		private readonly weatherProvider: WeatherProvider,
		@Inject(AIR_QUALITY_PROVIDER)
		private readonly airQualityProvider: AirQualityProvider,
		@Inject(LIFESTYLE_INDEX_PROVIDER)
		private readonly lifestyleIndexProvider: LifestyleIndexProvider,
		@Inject(SUN_TIME_PROVIDER)
		private readonly sunTimeProvider: SunTimeProvider,
		private readonly cacheService: CacheService,
		private readonly weatherRepository: WeatherRepository,
	) {}

	// -----------------------------------------
	// 스케줄러용: 배치 조회 (N+1 방지)
	// -----------------------------------------

	async getForecastsByGridBatch(
		grids: GridInput[],
		date: Date,
	): Promise<Map<string, WeatherForecast>> {
		const { baseDate, baseTime } = getKmaBaseDateTime(date);
		const result = new Map<string, WeatherForecast>();

		if (grids.length === 0) return result;

		// 1. Redis mget - 1회 RTT
		const cacheKeys = grids.map((g) =>
			CacheKeys.weatherForecast(g.gridX, g.gridY, baseDate, baseTime),
		);
		const cached = await this.cacheService.mget<WeatherForecast>(cacheKeys);

		// 2. 히트/미스 분류
		const misses: GridInput[] = [];
		for (const [i, grid] of grids.entries()) {
			const key = `${grid.gridX}:${grid.gridY}`;
			const cachedItem = cached[i];
			if (cachedItem) {
				result.set(key, cachedItem);
			} else {
				misses.push(grid);
			}
		}

		// 3. 미스만 API 호출
		if (misses.length > 0) {
			const settled = await Promise.allSettled(
				misses.map((g) => this.weatherProvider.getForecast(g.lat, g.lon, date)),
			);

			// 4. 성공/실패 분류 및 캐시 저장
			const cacheEntries: Array<{
				key: string;
				value: WeatherForecast;
				ttl: number;
			}> = [];
			const latestFallbackTargets: Array<{
				index: number;
				miss: GridInput;
			}> = [];

			for (const [i, settledResult] of settled.entries()) {
				const miss = misses[i];
				if (!miss) continue;

				if (settledResult.status === "fulfilled" && settledResult.value) {
					const forecast = settledResult.value;
					// 정규 캐시 (3h)
					cacheEntries.push({
						key: CacheKeys.weatherForecast(
							miss.gridX,
							miss.gridY,
							baseDate,
							baseTime,
						),
						value: forecast,
						ttl: CacheKeys.TTL.WEATHER_FORECAST,
					});
					// latest 캐시 (24h)
					cacheEntries.push({
						key: CacheKeys.weatherForecastLatest(miss.gridX, miss.gridY),
						value: forecast,
						ttl: CacheKeys.TTL.WEATHER_FORECAST_LATEST,
					});
					result.set(`${miss.gridX}:${miss.gridY}`, forecast);
				} else {
					latestFallbackTargets.push({ index: i, miss });
				}
			}

			// 성공 항목 캐시 저장
			if (cacheEntries.length > 0) {
				await this.cacheService.mset(cacheEntries);
			}

			// 실패 항목 latest fallback 조회
			if (latestFallbackTargets.length > 0) {
				const fallbackKeys = latestFallbackTargets.map(({ miss }) =>
					CacheKeys.weatherForecastLatest(miss.gridX, miss.gridY),
				);
				const fallbackCached =
					await this.cacheService.mget<WeatherForecast>(fallbackKeys);

				for (const [j, { miss }] of latestFallbackTargets.entries()) {
					const fallback = fallbackCached[j];
					if (fallback) {
						result.set(`${miss.gridX}:${miss.gridY}`, fallback);
						this.#logger.warn(
							`Weather batch: using latest fallback for grid ${miss.gridX}:${miss.gridY}`,
						);
					}
				}
			}

			this.#logger.log(
				`Weather batch: ${grids.length} grids, ${misses.length} cache misses`,
			);
		}

		return result;
	}

	// -----------------------------------------
	// API 엔드포인트용: 단건 예보 조회
	// -----------------------------------------

	async getForecastForUser(
		userId: string,
		date: Date,
	): Promise<WeatherForecast> {
		const location = await this.weatherRepository.findByUserId(userId);
		if (!location) {
			throw BusinessExceptions.weatherLocationNotFound();
		}

		const { baseDate, baseTime } = getKmaBaseDateTime(date);
		const cacheKey = CacheKeys.weatherForecast(
			location.gridX,
			location.gridY,
			baseDate,
			baseTime,
		);

		// 1. 캐시 확인
		const cached = await this.cacheService.get<WeatherForecast>(cacheKey);
		if (cached) {
			return cached;
		}

		// 2. KMA 프로바이더 호출
		try {
			const forecast = await this.weatherProvider.getForecast(
				location.latitude,
				location.longitude,
				date,
			);

			// 성공 시 정규 캐시 (3h) + latest 캐시 (24h) 모두 저장
			await Promise.all([
				this.cacheService.set(
					cacheKey,
					forecast,
					CacheKeys.TTL.WEATHER_FORECAST,
				),
				this.cacheService.set(
					CacheKeys.weatherForecastLatest(location.gridX, location.gridY),
					forecast,
					CacheKeys.TTL.WEATHER_FORECAST_LATEST,
				),
			]);

			return forecast;
		} catch (error) {
			this.#logger.warn(
				`KMA forecast failed, trying latest fallback: ${error instanceof Error ? error.message : String(error)}`,
			);
		}

		// 3. KMA 실패 시 latest 캐시 fallback
		const latestCacheKey = CacheKeys.weatherForecastLatest(
			location.gridX,
			location.gridY,
		);
		const latest = await this.cacheService.get<WeatherForecast>(latestCacheKey);
		if (latest) {
			this.#logger.warn(
				`Using latest fallback for user ${userId} grid ${location.gridX}:${location.gridY}`,
			);
			return latest;
		}

		// 4. latest도 없으면 에러
		throw BusinessExceptions.weatherServiceUnavailable();
	}

	// -----------------------------------------
	// API 엔드포인트용: 부가 정보 조회
	// -----------------------------------------

	async getConditionsForUser(
		userId: string,
		date: Date,
	): Promise<WeatherConditions> {
		const location = await this.weatherRepository.findByUserId(userId);
		if (!location) {
			throw BusinessExceptions.weatherLocationNotFound();
		}

		// 1. 캐시 확인 (1h TTL)
		const conditionsCacheKey = CacheKeys.weatherConditions(
			location.gridX,
			location.gridY,
		);
		const cached =
			await this.cacheService.get<WeatherConditions>(conditionsCacheKey);
		if (cached) {
			return cached;
		}

		// 2. 현재 기온/풍속 가져오기 (lifestyle 계산용)
		let currentTemp = 0;
		let windSpeed = 0;

		try {
			const forecast = await this.getForecastForUser(userId, date);
			const currentHour = date.getHours();
			const hourly = forecast.hourlyForecasts.find(
				(h) => h.hour === currentHour,
			);
			currentTemp = hourly?.temperature ?? forecast.temperatureMax;
			windSpeed = forecast.windSpeed;
		} catch {
			this.#logger.warn(
				"Failed to get forecast for lifestyle calculation, using defaults",
			);
		}

		// 3. 3개 프로바이더 병렬 호출
		const [airResult, lifestyleResult, sunResult] = await Promise.allSettled([
			this.airQualityProvider.getAirQuality(
				location.latitude,
				location.longitude,
			),
			this.lifestyleIndexProvider.getIndex(
				location.latitude,
				location.longitude,
				date,
				currentTemp,
				windSpeed,
			),
			this.sunTimeProvider.getSunTime(
				location.latitude,
				location.longitude,
				date,
			),
		]);

		// 4. 결과 병합 (실패한 프로바이더는 null)
		const air = airResult.status === "fulfilled" ? airResult.value : null;
		const lifestyle =
			lifestyleResult.status === "fulfilled" ? lifestyleResult.value : null;
		const sun = sunResult.status === "fulfilled" ? sunResult.value : null;

		const conditions: WeatherConditions = {
			feelsLikeTemperature: lifestyle?.feelsLikeTemperature ?? null,
			uvIndex: lifestyle?.uvIndex ?? null,
			sunrise: sun?.sunrise ?? null,
			sunset: sun?.sunset ?? null,
			pm10: air?.pm10 ?? null,
			pm25: air?.pm25 ?? null,
		};

		// 5. 캐시 저장
		await this.cacheService.set(
			conditionsCacheKey,
			conditions,
			CacheKeys.TTL.WEATHER_CONDITIONS,
		);

		return conditions;
	}

	// -----------------------------------------
	// 위치 관리
	// -----------------------------------------

	async upsertLocation(
		userId: string,
		lat: number,
		lon: number,
	): Promise<UserLocation> {
		const { nx, ny } = convertToGrid(lat, lon);
		return this.weatherRepository.upsert(userId, {
			latitude: lat,
			longitude: lon,
			gridX: nx,
			gridY: ny,
		});
	}

	async getLocation(userId: string): Promise<UserLocation | null> {
		return this.weatherRepository.findByUserId(userId);
	}
}
