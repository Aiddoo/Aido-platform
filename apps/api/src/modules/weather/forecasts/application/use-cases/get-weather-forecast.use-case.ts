import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { userLocationNotFound } from "../../../locations/application/locations.errors.js";
import type { UserLocationRepositoryPort } from "../../../locations/application/ports/user-location.repository.port.js";
import type { UserLocation } from "../../../locations/domain/user-location.aggregate.js";
import type { WeatherForecast } from "../read-models/weather-forecast.read-model.js";
import type { WeatherForecastReader } from "../weather-forecast.reader.js";

/** 예보 + 위치 (컨트롤러가 좌표를 응답에 병합하기 위해 위치도 반환) */
export interface WeatherForecastWithLocation {
  readonly forecast: WeatherForecast;
  readonly location: UserLocation;
}

/** 사용자 위치 기반 날씨 예보 조회 입력. */
export interface GetWeatherForecastQuery {
  readonly userId: string;
  readonly date: Date;
}

export interface GetWeatherForecastDependencies {
  readonly userLocationRepository: Pick<UserLocationRepositoryPort, "findByUserId">;
  readonly forecastReader: Pick<WeatherForecastReader, "fetchForLocation">;
}

export class GetWeatherForecastUseCase {
  readonly #dependencies: GetWeatherForecastDependencies;

  constructor(dependencies: GetWeatherForecastDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetWeatherForecastQuery): Promise<WeatherForecastWithLocation> {
    const { userLocationRepository, forecastReader } = this.#dependencies;
    const location = await userLocationRepository.findByUserId(UserId.reconstitute(query.userId));
    if (location == null) {
      throw userLocationNotFound();
    }
    location.requireForecastGrid();

    const forecast = await forecastReader.fetchForLocation(location, query.date);
    return { forecast, location };
  }
}
