import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";

import { type WeatherLocationRepositoryPort } from "../../../locations/application/ports/user-location.repository.port.js";
import type { UserLocation } from "../../../locations/domain/user-location.entity.js";
import type { WeatherForecast } from "../ports/weather-forecast-provider.port.js";
import type { WeatherForecastReader } from "../weather-forecast.reader.js";

/** 예보 + 위치 (컨트롤러가 좌표를 응답에 병합하기 위해 위치도 반환) */
export interface WeatherForecastWithLocation {
  readonly forecast: WeatherForecast;
  readonly location: UserLocation;
}

/**
 * 사용자 위치 기반 날씨 예보 조회 입력.
 */
export interface GetWeatherForecastInput {
  readonly userId: string;
  readonly date: Date;
}

interface GetWeatherForecastDependencies {
  readonly weatherLocationRepository: Pick<WeatherLocationRepositoryPort, "findByUserId">;
  readonly forecastReader: Pick<WeatherForecastReader, "fetchForLocation">;
}

export class GetWeatherForecast {
  readonly #dependencies: GetWeatherForecastDependencies;

  constructor(dependencies: GetWeatherForecastDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetWeatherForecastInput): Promise<WeatherForecastWithLocation> {
    const location = await this.#dependencies.weatherLocationRepository.findByUserId(input.userId);
    if (location == null) {
      throw new ApplicationException(ErrorCode.WEATHER_1902);
    }
    location.requireKmaGrid();

    const forecast = await this.#dependencies.forecastReader.fetchForLocation(location, input.date);
    return { forecast, location };
  }
}
