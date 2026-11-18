import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserLocationRepositoryPort } from "../../../user-locations/application/ports/user-location.repository.port.js";
import { userLocationNotFound } from "../../../user-locations/application/user-locations.errors.js";
import type { UserLocation } from "../../../user-locations/domain/user-location.aggregate.js";
import type { WeatherForecastReadModel } from "../read-models/weather-forecast.read-model.js";
import type { ReadWeatherForecastUseCase } from "./read-weather-forecast.use-case.js";

/** 컨트롤러가 좌표를 응답에 합치므로 위치도 돌려준다 */
export interface WeatherForecastWithLocation {
  readonly forecast: WeatherForecastReadModel;
  readonly location: UserLocation;
}

export interface GetWeatherForecastQuery {
  readonly userId: string;
  readonly target: Temporal.Instant;
}

export interface GetWeatherForecastDependencies {
  readonly userLocationRepository: Pick<UserLocationRepositoryPort, "findByUserId">;
  readonly readWeatherForecast: Pick<ReadWeatherForecastUseCase, "execute">;
}

export class GetWeatherForecastUseCase {
  readonly #dependencies: GetWeatherForecastDependencies;

  constructor(dependencies: GetWeatherForecastDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetWeatherForecastQuery): Promise<WeatherForecastWithLocation> {
    const { userLocationRepository, readWeatherForecast } = this.#dependencies;
    const location = await userLocationRepository.findByUserId(UserId.reconstitute(query.userId));
    if (location == null) {
      throw userLocationNotFound();
    }

    const forecast = await readWeatherForecast.execute({
      grid: location.requireForecastGrid(),
      target: query.target,
    });
    return { forecast, location };
  }
}
