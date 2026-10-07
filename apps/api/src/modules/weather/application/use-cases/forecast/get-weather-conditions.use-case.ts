import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { toLocalTimeString } from "#api/shared/domain/date/utils/timezone";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import type { UserLocation } from "../../../domain/entities/forecast/user-location.entity.js";
import { WeatherLogEvent } from "../../observability/forecast/weather-log.events.js";
import { type AirQualityProvider } from "../../ports/forecast/air-quality-provider.port.js";
import { type LifestyleIndexProvider } from "../../ports/forecast/lifestyle-index-provider.port.js";
import { type SunTimeProvider } from "../../ports/forecast/sun-time-provider.port.js";
import { type WeatherCachePort } from "../../ports/forecast/weather-cache.port.js";
import { type WeatherLocationRepositoryPort } from "../../ports/forecast/weather-location.repository.port.js";
import type {
  WeatherConditions,
  WeatherProvider,
} from "../../ports/forecast/weather-provider.port.js";
import type { WeatherForecastReader } from "../../services/forecast/weather-forecast.reader.js";

/**
 * 사용자 위치 기반 날씨 부가 정보(체감온도·자외선·일출/일몰·미세먼지) 조회 입력.
 */
export interface GetWeatherConditionsInput {
  readonly userId: string;
  readonly date: Date;
}

interface GetWeatherConditionsDependencies {
  readonly weatherLocationRepository: Pick<WeatherLocationRepositoryPort, "findByUserId">;
  readonly airQualityProvider: Pick<AirQualityProvider, "getAirQuality">;
  readonly lifestyleIndexProvider: Pick<LifestyleIndexProvider, "getIndex">;
  readonly sunTimeProvider: Pick<SunTimeProvider, "getSunTime">;
  readonly forecastReader: Pick<WeatherForecastReader, "fetchForLocation">;
  readonly weatherProvider: Pick<WeatherProvider, "timeZone">;
  readonly weatherCache: Pick<WeatherCachePort, "getConditions" | "setConditions">;
  readonly logger: Pick<ApplicationLogger, "warn">;
}

export class GetWeatherConditions {
  readonly #dependencies: GetWeatherConditionsDependencies;

  constructor(dependencies: GetWeatherConditionsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetWeatherConditionsInput): Promise<WeatherConditions> {
    const location = await this.#dependencies.weatherLocationRepository.findByUserId(input.userId);
    if (location === null) {
      throw new ApplicationException(ErrorCode.WEATHER_1902);
    }

    const cached = await this.#dependencies.weatherCache.getConditions(
      location.gridX,
      location.gridY,
      input.date,
    );
    if (cached !== undefined) {
      return cached;
    }

    const { currentTemp, windSpeed } = await this.#currentTempAndWind(location, input.date);

    const [airResult, lifestyleResult, sunResult] = await Promise.allSettled([
      this.#dependencies.airQualityProvider.getAirQuality(location.latitude, location.longitude),
      this.#dependencies.lifestyleIndexProvider.getIndex(
        location.latitude,
        location.longitude,
        input.date,
        currentTemp,
        windSpeed,
      ),
      this.#dependencies.sunTimeProvider.getSunTime(
        location.latitude,
        location.longitude,
        input.date,
      ),
    ]);

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

    await this.#dependencies.weatherCache.setConditions(
      location.gridX,
      location.gridY,
      input.date,
      conditions,
    );

    return conditions;
  }

  /** 현재 시각의 기온/풍속 (예보 조회 실패 시 기본값 0). */
  async #currentTempAndWind(
    location: UserLocation,
    date: Date,
  ): Promise<{ currentTemp: number; windSpeed: number }> {
    try {
      const forecast = await this.#dependencies.forecastReader.fetchForLocation(location, date);
      const currentHour = Number.parseInt(
        toLocalTimeString(date, this.#dependencies.weatherProvider.timeZone).slice(0, 2),
        10,
      );
      const hourly = forecast.hourlyForecasts.find((h) => h.hour === currentHour);
      return {
        currentTemp: hourly?.temperature ?? forecast.temperatureMax,
        windSpeed: forecast.windSpeed,
      };
    } catch {
      this.#dependencies.logger.warn({ event: WeatherLogEvent.CONDITIONS_FORECAST_UNAVAILABLE });
      return { currentTemp: 0, windSpeed: 0 };
    }
  }
}
