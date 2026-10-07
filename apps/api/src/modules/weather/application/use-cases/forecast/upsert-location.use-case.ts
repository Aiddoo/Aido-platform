import { UserLocation } from "../../../domain/entities/forecast/user-location.entity.js";
import { Coordinate } from "../../../domain/value-objects/forecast/coordinate.vo.js";
import { type WeatherCachePort } from "../../ports/forecast/weather-cache.port.js";
import { type WeatherLocationRepositoryPort } from "../../ports/forecast/weather-location.repository.port.js";

/**
 * 사용자 위치 등록/수정 입력. 좌표로부터 격자를 파생해 저장하고, 격자가 바뀌면
 * 이전 격자의 캐시를 무효화한다.
 */
export interface UpsertLocationInput {
  userId: string;
  latitude: number;
  longitude: number;
}

interface UpsertLocationDependencies {
  readonly repository: WeatherLocationRepositoryPort;
  readonly cache: WeatherCachePort;
}

export class UpsertLocation {
  readonly #dependencies: UpsertLocationDependencies;

  constructor(dependencies: UpsertLocationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpsertLocationInput): Promise<UserLocation> {
    // 좌표 불변식 검증 + 격자 파생은 도메인이 소유
    const location = UserLocation.create(
      input.userId,
      Coordinate.of(input.latitude, input.longitude),
    );

    const oldLocation = await this.#dependencies.repository.findByUserId(input.userId);
    const saved = await this.#dependencies.repository.upsert(location);

    // 격자가 변경되면 구 격자의 캐시 무효화
    if (oldLocation && !oldLocation.grid.equals(saved.grid)) {
      await this.#dependencies.cache.invalidateGrid(oldLocation.gridX, oldLocation.gridY);
    }

    return saved;
  }
}
