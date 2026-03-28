import { Inject, Injectable, Logger } from "@nestjs/common";

import { CacheService } from "@/common/cache/cache.service";
import { CacheKeys } from "@/common/cache/constants/cache-keys";
import { BusinessExceptions } from "@/common/exception/services/business-exception.service";

import type { UserLocation } from "@/generated/prisma/client";
import { getKmaBaseDateTime } from "../providers/kma/kma.constants";
import { convertToGrid } from "../providers/kma/lambert-projection";
import {
	WEATHER_PROVIDER,
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
		private readonly cacheService: CacheService,
		private readonly weatherRepository: WeatherRepository,
	) {}

	// ─────────────────────────────────────────────
	// 스케줄러용: 배치 조회 (N+1 방지)
	// ─────────────────────────────────────────────

	async getForecastsByGridBatch(
		grids: GridInput[],
		date: Date,
	): Promise<Map<string, WeatherForecast>> {
		const { baseDate, baseTime } = getKmaBaseDateTime(date);
		const result = new Map<string, WeatherForecast>();

		if (grids.length === 0) return result;

		// 1. Redis mget — 1회 RTT
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
			const fetched = await Promise.all(
				misses.map((g) => this.weatherProvider.getForecast(g.lat, g.lon, date)),
			);

			// 4. Redis mset — 1회 RTT
			const entries: Array<{
				key: string;
				value: WeatherForecast;
				ttl: number;
			}> = [];
			for (const [i, miss] of misses.entries()) {
				const forecast = fetched[i];
				if (!forecast) continue;
				entries.push({
					key: CacheKeys.weatherForecast(
						miss.gridX,
						miss.gridY,
						baseDate,
						baseTime,
					),
					value: forecast,
					ttl: CacheKeys.TTL.WEATHER_FORECAST,
				});
				result.set(`${miss.gridX}:${miss.gridY}`, forecast);
			}
			await this.cacheService.mset(entries);

			this.#logger.log(
				`Weather batch: ${grids.length} grids, ${misses.length} cache misses`,
			);
		}

		return result;
	}

	// ─────────────────────────────────────────────
	// API 엔드포인트용: 단건 조회
	// ─────────────────────────────────────────────

	async getForecastForUser(
		userId: string,
		date: Date,
	): Promise<WeatherForecast> {
		const location = await this.weatherRepository.findByUserId(userId);
		if (!location) {
			throw BusinessExceptions.weatherLocationNotFound();
		}

		const { baseDate, baseTime } = getKmaBaseDateTime(date);
		return this.cacheService.wrap(
			CacheKeys.weatherForecast(
				location.gridX,
				location.gridY,
				baseDate,
				baseTime,
			),
			() =>
				this.weatherProvider.getForecast(
					location.latitude,
					location.longitude,
					date,
				),
			CacheKeys.TTL.WEATHER_FORECAST,
		);
	}

	// ─────────────────────────────────────────────
	// 위치 관리
	// ─────────────────────────────────────────────

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
