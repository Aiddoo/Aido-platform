import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { TimeZone } from "#api/shared/domain/time/time-zone.vo";

import { Coordinate } from "../../../shared/domain/coordinate.vo.js";
import { GeoCell } from "../../../shared/domain/geo-cell.vo.js";
import { isKoreanWeatherCovered } from "../../../shared/domain/korean-weather-coverage.domain-service.js";
import { UserLocation } from "../../domain/user-location.entity.js";
import type { ForecastGridCacheInvalidatorPort } from "../ports/forecast-grid-cache-invalidator.port.js";
import type { TimezoneResolverPort } from "../ports/timezone-resolver.port.js";
import type { UserLocationRepositoryPort } from "../ports/user-location.repository.port.js";
import type { WeatherGridResolverPort } from "../ports/weather-grid-resolver.port.js";

/**
 * 사용자 위치 등록/수정 입력. v2 리포트 조회·날씨 알림과 같은 칸 중심 시간대를 함께 저장하고, 한국 범위 안이면 v1 예보와
 * AI 제안이 쓰는 KMA 격자도 저장한다. 날씨 알림은 모든 위치에서 v2 리포트를 쓴다.
 */
export interface UpsertUserLocationCommand {
  readonly userId: string;
  readonly latitude: number;
  readonly longitude: number;
}

export interface UpsertLocationResult {
  readonly location: UserLocation;
  /** 저장한 위치가 속한 칸 중심의 IANA 시간대. `GET /v2/weather`의 `location.timezone`과 같다. */
  readonly timezone: string;
}

export interface UpsertUserLocationDependencies {
  readonly userLocationRepository: Pick<UserLocationRepositoryPort, "findByUserId" | "save">;
  readonly gridCacheInvalidator: Pick<ForecastGridCacheInvalidatorPort, "invalidateGrid">;
  readonly weatherGridResolver: Pick<WeatherGridResolverPort, "resolveGrid">;
  readonly timezoneResolver: Pick<TimezoneResolverPort, "resolve">;
  readonly clock: ClockPort;
}

export class UpsertUserLocationUseCase {
  readonly #dependencies: UpsertUserLocationDependencies;

  constructor(dependencies: UpsertUserLocationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: UpsertUserLocationCommand): Promise<UpsertLocationResult> {
    const {
      userLocationRepository,
      gridCacheInvalidator,
      weatherGridResolver,
      timezoneResolver,
      clock,
    } = this.#dependencies;
    const userId = UserId.reconstitute(command.userId);
    const coordinate = Coordinate.create(command.latitude, command.longitude);
    const grid = isKoreanWeatherCovered(coordinate)
      ? weatherGridResolver.resolveGrid(coordinate)
      : null;
    const { timezone } = timezoneResolver.resolve(GeoCell.create(coordinate).center);
    const location = UserLocation.create({
      userId,
      coordinate,
      grid,
      timezone: TimeZone.create(timezone),
      now: clock.now(),
    });

    const previous = await userLocationRepository.findByUserId(userId);
    await userLocationRepository.save(location);

    // v1 격자 캐시는 사용자 이동 시 이전 격자를 비워 왔다. v2 리포트는 칸 단위 공유 캐시라 지우지 않는다.
    const previousGrid = previous?.grid;
    if (previousGrid != null && (location.grid == null || !previousGrid.equals(location.grid))) {
      await gridCacheInvalidator.invalidateGrid(previousGrid);
    }

    return { location, timezone };
  }
}
