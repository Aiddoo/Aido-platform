import { UserLocation } from "../../../domain/entities/forecast/user-location.entity.js";
import { Coordinate } from "../../../domain/value-objects/forecast/coordinate.vo.js";
import { type WeatherCachePort } from "../../ports/forecast/weather-cache.port.js";
import type { WeatherGridResolverPort } from "../../ports/forecast/weather-grid-resolver.port.js";
import { type WeatherLocationRepositoryPort } from "../../ports/forecast/weather-location.repository.port.js";

/**
 * 사용자 위치 등록/수정 입력. 지원 좌표의 격자를 해결해 저장하고, 격자가 바뀌면
 * 이전 격자의 캐시를 무효화한다.
 */
export interface UpsertLocationInput {
  readonly userId: string;
  readonly latitude: number;
  readonly longitude: number;
}

interface UpsertLocationDependencies {
  readonly weatherLocationRepository: Pick<
    WeatherLocationRepositoryPort,
    "findByUserId" | "upsert"
  >;
  readonly weatherCache: Pick<WeatherCachePort, "invalidateGrid">;
  readonly weatherGridResolver: Pick<WeatherGridResolverPort, "resolveGrid">;
}

export class UpsertLocation {
  readonly #dependencies: UpsertLocationDependencies;

  constructor(dependencies: UpsertLocationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpsertLocationInput): Promise<UserLocation> {
    const coordinate = Coordinate.of(input.latitude, input.longitude);
    const grid = this.#dependencies.weatherGridResolver.resolveGrid(coordinate);
    const location = UserLocation.create(input.userId, coordinate, grid);

    const oldLocation = await this.#dependencies.weatherLocationRepository.findByUserId(
      input.userId,
    );
    const saved = await this.#dependencies.weatherLocationRepository.upsert(location);

    // 격자가 변경되면 구 격자의 캐시 무효화
    if (oldLocation !== null && !oldLocation.grid.equals(saved.grid)) {
      await this.#dependencies.weatherCache.invalidateGrid(oldLocation.gridX, oldLocation.gridY);
    }

    return saved;
  }
}
