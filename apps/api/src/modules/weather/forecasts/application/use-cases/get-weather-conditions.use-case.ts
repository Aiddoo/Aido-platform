import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { resolveTimezone } from "#api/shared/domain/time/time-zone-name";

import { userLocationNotFound } from "../../../locations/application/locations.errors.js";
import type { UserLocationRepositoryPort } from "../../../locations/application/ports/user-location.repository.port.js";
import type { UserLocation } from "../../../locations/domain/user-location.aggregate.js";
import { ForecastLogEvent } from "../forecasts.log-events.js";
import type { AirQualityProviderPort } from "../ports/air-quality-provider.port.js";
import type { LifestyleIndexProviderPort } from "../ports/lifestyle-index-provider.port.js";
import type { SunTimeProviderPort } from "../ports/sun-time-provider.port.js";
import type { WeatherForecastCachePort } from "../ports/weather-forecast-cache.port.js";
import type { WeatherForecastProviderPort } from "../ports/weather-forecast-provider.port.js";
import type { WeatherConditions } from "../read-models/weather-forecast.read-model.js";
import type { ReadWeatherForecastUseCase } from "./read-weather-forecast.use-case.js";

/** 사용자 위치의 부가 정보(체감온도·자외선·일출/일몰·미세먼지)를 그 순간이 속한 날로 읽는다. */
export interface GetWeatherConditionsQuery {
  readonly userId: string;
  readonly target: Temporal.Instant;
}

export interface GetWeatherConditionsDependencies {
  readonly userLocationRepository: Pick<UserLocationRepositoryPort, "findByUserId">;
  readonly airQualityProvider: Pick<AirQualityProviderPort, "getAirQuality">;
  readonly lifestyleIndexProvider: Pick<LifestyleIndexProviderPort, "getIndex">;
  readonly sunTimeProvider: Pick<SunTimeProviderPort, "getSunTime">;
  readonly readWeatherForecast: Pick<ReadWeatherForecastUseCase, "execute">;
  readonly weatherProvider: Pick<WeatherForecastProviderPort, "timeZone">;
  readonly weatherCache: Pick<WeatherForecastCachePort, "getConditions" | "setConditions">;
  readonly logger: Pick<ApplicationLoggerPort, "warn">;
}

export class GetWeatherConditionsUseCase {
  readonly #dependencies: GetWeatherConditionsDependencies;

  constructor(dependencies: GetWeatherConditionsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetWeatherConditionsQuery): Promise<WeatherConditions> {
    const { target } = query;
    const location = await this.#dependencies.userLocationRepository.findByUserId(
      UserId.reconstitute(query.userId),
    );
    if (location == null) {
      throw userLocationNotFound();
    }
    const grid = location.requireForecastGrid();

    const cached = await this.#dependencies.weatherCache.getConditions(grid, target);
    if (cached != null) {
      return cached;
    }

    const { currentTemp, windSpeed } = await this.#currentTempAndWind(location, target);

    const [airResult, lifestyleResult, sunResult] = await Promise.allSettled([
      this.#dependencies.airQualityProvider.getAirQuality(location.latitude, location.longitude),
      this.#dependencies.lifestyleIndexProvider.getIndex(
        location.latitude,
        location.longitude,
        target,
        currentTemp,
        windSpeed,
      ),
      this.#dependencies.sunTimeProvider.getSunTime(location.latitude, location.longitude, target),
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

    await this.#dependencies.weatherCache.setConditions(grid, target, conditions);

    return conditions;
  }

  /** 그 순간의 기온·풍속. 예보를 읽지 못하면 0으로 계산을 이어 간다. */
  async #currentTempAndWind(
    location: UserLocation,
    target: Temporal.Instant,
  ): Promise<{ currentTemp: number; windSpeed: number }> {
    try {
      const forecast = await this.#dependencies.readWeatherForecast.execute({
        grid: location.requireForecastGrid(),
        target,
      });
      const forecastZone = resolveTimezone(this.#dependencies.weatherProvider.timeZone);
      const currentHour = target.toZonedDateTimeISO(forecastZone).hour;
      const hourly = forecast.hourlyForecasts.find((h) => h.hour === currentHour);
      return {
        currentTemp: hourly?.temperature ?? forecast.temperatureMax,
        windSpeed: forecast.windSpeed,
      };
    } catch {
      this.#dependencies.logger.warn({ event: ForecastLogEvent.CONDITIONS_FORECAST_UNAVAILABLE });
      return { currentTemp: 0, windSpeed: 0 };
    }
  }
}
