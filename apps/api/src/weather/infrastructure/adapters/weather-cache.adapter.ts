import { Injectable } from "@nestjs/common";

import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import { CacheKeys } from "@/shared/infrastructure/cache/constants/cache-keys";

import type {
	WeatherCachePort,
	WeatherForecastEntry,
	WeatherGridRef,
} from "../../application/ports/weather-cache.port";
import type {
	WeatherConditions,
	WeatherForecast,
} from "../../application/ports/weather-provider.port";

/**
 * WeatherCachePort의 어댑터 — 공유 CacheService(중앙 관리 CacheKeys)에 위임한다.
 * 키 구성·TTL·직렬화는 CacheKeys/CacheService가 소유하고, 이 어댑터는 예보 캐시
 * 시맨틱만 노출한다. 정규(3h)·latest(24h) 이중 쓰기와 mget 순서보존은 여기서 캡슐화한다.
 */
@Injectable()
export class WeatherCacheAdapter implements WeatherCachePort {
	constructor(private readonly cacheService: CacheService) {}

	getForecast(
		gridX: number,
		gridY: number,
		baseDate: string,
		baseTime: string,
	): Promise<WeatherForecast | undefined> {
		return this.cacheService.get<WeatherForecast>(
			CacheKeys.weatherForecast(gridX, gridY, baseDate, baseTime),
		);
	}

	async saveForecast(
		gridX: number,
		gridY: number,
		baseDate: string,
		baseTime: string,
		forecast: WeatherForecast,
	): Promise<void> {
		await Promise.all([
			this.cacheService.set(
				CacheKeys.weatherForecast(gridX, gridY, baseDate, baseTime),
				forecast,
				CacheKeys.TTL.WEATHER_FORECAST,
			),
			this.cacheService.set(
				CacheKeys.weatherForecastLatest(gridX, gridY),
				forecast,
				CacheKeys.TTL.WEATHER_FORECAST_LATEST,
			),
		]);
	}

	getLatestForecast(
		gridX: number,
		gridY: number,
	): Promise<WeatherForecast | undefined> {
		return this.cacheService.get<WeatherForecast>(
			CacheKeys.weatherForecastLatest(gridX, gridY),
		);
	}

	getForecastBatch(
		grids: WeatherGridRef[],
		baseDate: string,
		baseTime: string,
	): Promise<(WeatherForecast | undefined)[]> {
		return this.cacheService.mget<WeatherForecast>(
			grids.map((g) =>
				CacheKeys.weatherForecast(g.gridX, g.gridY, baseDate, baseTime),
			),
		);
	}

	async saveForecastBatch(
		entries: WeatherForecastEntry[],
		baseDate: string,
		baseTime: string,
	): Promise<void> {
		const cacheEntries = entries.flatMap((entry) => [
			{
				key: CacheKeys.weatherForecast(
					entry.gridX,
					entry.gridY,
					baseDate,
					baseTime,
				),
				value: entry.forecast,
				ttl: CacheKeys.TTL.WEATHER_FORECAST,
			},
			{
				key: CacheKeys.weatherForecastLatest(entry.gridX, entry.gridY),
				value: entry.forecast,
				ttl: CacheKeys.TTL.WEATHER_FORECAST_LATEST,
			},
		]);
		await this.cacheService.mset(cacheEntries);
	}

	getLatestForecastBatch(
		grids: WeatherGridRef[],
	): Promise<(WeatherForecast | undefined)[]> {
		return this.cacheService.mget<WeatherForecast>(
			grids.map((g) => CacheKeys.weatherForecastLatest(g.gridX, g.gridY)),
		);
	}

	getConditions(
		gridX: number,
		gridY: number,
	): Promise<WeatherConditions | undefined> {
		return this.cacheService.get<WeatherConditions>(
			CacheKeys.weatherConditions(gridX, gridY),
		);
	}

	async setConditions(
		gridX: number,
		gridY: number,
		conditions: WeatherConditions,
	): Promise<void> {
		await this.cacheService.set(
			CacheKeys.weatherConditions(gridX, gridY),
			conditions,
			CacheKeys.TTL.WEATHER_CONDITIONS,
		);
	}

	async invalidateGrid(gridX: number, gridY: number): Promise<void> {
		await Promise.all([
			this.cacheService.delByPattern(
				CacheKeys.weatherForecastPattern(gridX, gridY),
			),
			this.cacheService.del(CacheKeys.weatherForecastLatest(gridX, gridY)),
			this.cacheService.del(CacheKeys.weatherConditions(gridX, gridY)),
		]);
	}
}
