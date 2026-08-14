import { ErrorCode } from "@aido/errors";
import { Inject, Injectable, Logger } from "@nestjs/common";

import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import type { UserLocation } from "../../../domain/entities/user-location.entity";
import {
	AIR_QUALITY_PROVIDER,
	type AirQualityProvider,
} from "../../ports/air-quality-provider.port";
import {
	LIFESTYLE_INDEX_PROVIDER,
	type LifestyleIndexProvider,
} from "../../ports/lifestyle-index-provider.port";
import { SUN_TIME_PROVIDER, type SunTimeProvider } from "../../ports/sun-time-provider.port";
import { WEATHER_CACHE, type WeatherCachePort } from "../../ports/weather-cache.port";
import {
	WEATHER_LOCATION_REPOSITORY,
	type WeatherLocationRepositoryPort,
} from "../../ports/weather-location.repository.port";
import type { WeatherConditions } from "../../ports/weather-provider.port";
import { WeatherForecastReader } from "../../services/weather-forecast.reader";

/**
 * 사용자 위치 기반 날씨 부가 정보(체감온도·자외선·일출/일몰·미세먼지) 조회 입력.
 */
export interface GetWeatherConditionsInput {
	userId: string;
	date: Date;
}

@Injectable()
export class GetWeatherConditionsUseCase {
	readonly #logger = new Logger(GetWeatherConditionsUseCase.name);

	constructor(
		@Inject(WEATHER_LOCATION_REPOSITORY)
		private readonly repository: WeatherLocationRepositoryPort,
		@Inject(AIR_QUALITY_PROVIDER)
		private readonly airQualityProvider: AirQualityProvider,
		@Inject(LIFESTYLE_INDEX_PROVIDER)
		private readonly lifestyleIndexProvider: LifestyleIndexProvider,
		@Inject(SUN_TIME_PROVIDER)
		private readonly sunTimeProvider: SunTimeProvider,
		private readonly forecastReader: WeatherForecastReader,
		@Inject(WEATHER_CACHE)
		private readonly cache: WeatherCachePort,
	) {}

	async execute(input: GetWeatherConditionsInput): Promise<WeatherConditions> {
		const location = await this.repository.findByUserId(input.userId);
		if (!location) {
			throw new ApplicationException(ErrorCode.WEATHER_1902);
		}

		// 1. 캐시 확인 (1h TTL)
		const cached = await this.cache.getConditions(location.gridX, location.gridY);
		if (cached) {
			return cached;
		}

		// 2. 현재 기온/풍속 (lifestyle 계산용)
		const { currentTemp, windSpeed } = await this.#currentTempAndWind(location, input.date);

		// 3. 3개 프로바이더 병렬 호출
		const [airResult, lifestyleResult, sunResult] = await Promise.allSettled([
			this.airQualityProvider.getAirQuality(location.latitude, location.longitude),
			this.lifestyleIndexProvider.getIndex(
				location.latitude,
				location.longitude,
				input.date,
				currentTemp,
				windSpeed,
			),
			this.sunTimeProvider.getSunTime(location.latitude, location.longitude, input.date),
		]);

		// 4. 결과 병합 (실패한 프로바이더는 null)
		const air = airResult.status === "fulfilled" ? airResult.value : null;
		const lifestyle = lifestyleResult.status === "fulfilled" ? lifestyleResult.value : null;
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
		await this.cache.setConditions(location.gridX, location.gridY, conditions);

		return conditions;
	}

	/** 현재 시각의 기온/풍속 (예보 조회 실패 시 기본값 0). */
	async #currentTempAndWind(
		location: UserLocation,
		date: Date,
	): Promise<{ currentTemp: number; windSpeed: number }> {
		try {
			const forecast = await this.forecastReader.fetchForLocation(location, date);
			const currentHour = date.getHours();
			const hourly = forecast.hourlyForecasts.find((h) => h.hour === currentHour);
			return {
				currentTemp: hourly?.temperature ?? forecast.temperatureMax,
				windSpeed: forecast.windSpeed,
			};
		} catch {
			this.#logger.warn("Failed to get forecast for lifestyle calculation, using defaults");
			return { currentTemp: 0, windSpeed: 0 };
		}
	}
}
