import { type WeatherCachePort } from "../../../forecasts/application/ports/weather-forecast-cache.port.js";
import { Coordinate } from "../../../shared/domain/coordinate.vo.js";
import { GeoCell } from "../../../shared/domain/geo-cell.vo.js";
import { KoreanWeatherCoveragePolicy } from "../../../shared/domain/korean-weather-coverage.domain-service.js";
import { UserLocation } from "../../domain/user-location.entity.js";
import type { TimezoneResolverPort } from "../ports/timezone-resolver.port.js";
import { type WeatherLocationRepositoryPort } from "../ports/user-location.repository.port.js";
import type { WeatherGridResolverPort } from "../ports/weather-grid-resolver.port.js";

/**
 * 사용자 위치 등록/수정 입력. v2 리포트 조회·날씨 알림과 같은 칸 중심 시간대를 함께 저장하고, 한국 범위 안이면 v1 예보와
 * AI 제안이 쓰는 KMA 격자도 저장한다. 날씨 알림은 모든 위치에서 v2 리포트를 쓴다.
 */
export interface UpsertLocationInput {
  readonly userId: string;
  readonly latitude: number;
  readonly longitude: number;
}

export interface UpsertLocationResult {
  readonly location: UserLocation;
  /** 저장한 위치가 속한 칸 중심의 IANA 시간대. `GET /v2/weather`의 `location.timezone`과 같다. */
  readonly timezone: string;
}

interface UpsertLocationDependencies {
  readonly weatherLocationRepository: Pick<
    WeatherLocationRepositoryPort,
    "findByUserId" | "upsert"
  >;
  readonly weatherCache: Pick<WeatherCachePort, "invalidateGrid">;
  readonly weatherGridResolver: Pick<WeatherGridResolverPort, "resolveGrid">;
  readonly timezoneResolver: Pick<TimezoneResolverPort, "resolve">;
}

export class UpsertLocation {
  readonly #dependencies: UpsertLocationDependencies;

  constructor(dependencies: UpsertLocationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpsertLocationInput): Promise<UpsertLocationResult> {
    const coordinate = Coordinate.of(input.latitude, input.longitude);
    const grid = KoreanWeatherCoveragePolicy.covers(coordinate)
      ? this.#dependencies.weatherGridResolver.resolveGrid(coordinate)
      : null;
    const { timezone } = this.#dependencies.timezoneResolver.resolve(
      GeoCell.fromCoordinate(coordinate).center,
    );
    const location = UserLocation.create({ userId: input.userId, coordinate, grid, timezone });

    const oldLocation = await this.#dependencies.weatherLocationRepository.findByUserId(
      input.userId,
    );
    const saved = await this.#dependencies.weatherLocationRepository.upsert(location);

    // v1 격자 캐시는 사용자 이동 시 이전 격자를 비워 왔다. v2 리포트는 칸 단위 공유 캐시라 지우지 않는다.
    const oldGrid = oldLocation?.grid;
    if (oldGrid != null && (saved.grid == null || !oldGrid.equals(saved.grid))) {
      await this.#dependencies.weatherCache.invalidateGrid(oldGrid.gridX, oldGrid.gridY);
    }

    return { location: saved, timezone };
  }
}
