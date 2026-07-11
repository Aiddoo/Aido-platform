import { ErrorCode } from "@aido/errors";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import { CacheKeys } from "@/shared/infrastructure/cache/constants/cache-keys";
import type { UserLocation } from "../../domain/entities/user-location.entity";
import { getKmaBaseDateTime } from "../../domain/services/kma-base-datetime";
import {
	WEATHER_PROVIDER,
	type WeatherForecast,
	type WeatherProvider,
} from "../ports/weather-provider.port";

/** 격자 배치 조회 입력 (스케줄러·ai-suggestion 등 크로스 모듈에서 사용) */
export interface GridInput {
	gridX: number;
	gridY: number;
	lat: number;
	lon: number;
}

/**
 * 예보 읽기 모델 — 캐시-스루 프로바이더 조회를 캡슐화하는 애플리케이션 서비스.
 *
 * 예보 단건/배치 조회에서 공통으로 쓰이는 캐시(3h 정규 + 24h latest fallback)·
 * KMA 프로바이더 호출·장애 폴백 오케스트레이션을 한 곳에 둔다(SRP/DRY).
 */
@Injectable()
export class WeatherForecastReader {
	readonly #logger = new Logger(WeatherForecastReader.name);

	constructor(
		@Inject(WEATHER_PROVIDER)
		private readonly weatherProvider: WeatherProvider,
		private readonly cacheService: CacheService,
	) {}

	/** 단일 위치의 예보를 조회한다 (캐시 → 프로바이더 → latest 폴백 → WEATHER_1901). */
	async fetchForLocation(
		location: UserLocation,
		date: Date,
	): Promise<WeatherForecast> {
		const { baseDate, baseTime } = getKmaBaseDateTime(date);
		const cacheKey = CacheKeys.weatherForecast(
			location.gridX,
			location.gridY,
			baseDate,
			baseTime,
		);

		const cached = await this.cacheService.get<WeatherForecast>(cacheKey);
		if (cached) {
			return cached;
		}

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

		const latest = await this.cacheService.get<WeatherForecast>(
			CacheKeys.weatherForecastLatest(location.gridX, location.gridY),
		);
		if (latest) {
			this.#logger.warn(
				`Using latest fallback for grid ${location.gridX}:${location.gridY}`,
			);
			return latest;
		}

		throw new ApplicationException(ErrorCode.WEATHER_1901);
	}

	/**
	 * 여러 격자의 예보를 배치 조회한다 (N+1 방지: 1회 mget → 미스만 병렬 호출 → mset).
	 * 실패 격자는 latest 캐시로 폴백한다.
	 */
	async fetchBatch(
		grids: GridInput[],
		date: Date,
	): Promise<Map<string, WeatherForecast>> {
		const { baseDate, baseTime } = getKmaBaseDateTime(date);
		const result = new Map<string, WeatherForecast>();

		if (grids.length === 0) {
			return result;
		}

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

		if (misses.length === 0) {
			return result;
		}

		// 3. 미스만 API 호출
		const settled = await Promise.allSettled(
			misses.map((g) => this.weatherProvider.getForecast(g.lat, g.lon, date)),
		);

		// 4. 성공/실패 분류 및 캐시 저장
		const cacheEntries: Array<{
			key: string;
			value: WeatherForecast;
			ttl: number;
		}> = [];
		const latestFallbackTargets: GridInput[] = [];

		for (const [i, settledResult] of settled.entries()) {
			const miss = misses[i];
			if (!miss) {
				continue;
			}

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
				latestFallbackTargets.push(miss);
			}
		}

		// 성공 항목 캐시 저장
		if (cacheEntries.length > 0) {
			await this.cacheService.mset(cacheEntries);
		}

		// 실패 항목 latest fallback 조회
		if (latestFallbackTargets.length > 0) {
			const fallbackKeys = latestFallbackTargets.map((miss) =>
				CacheKeys.weatherForecastLatest(miss.gridX, miss.gridY),
			);
			const fallbackCached =
				await this.cacheService.mget<WeatherForecast>(fallbackKeys);

			for (const [j, miss] of latestFallbackTargets.entries()) {
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

		return result;
	}
}
