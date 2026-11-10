import type { GridCoordinate } from "../../../shared/domain/grid-coordinate.vo.js";

/** 사용자가 옮겨 가 쓰지 않게 된 격자의 예보 캐시를 비운다. */
export abstract class ForecastGridCacheInvalidatorPort {
  abstract invalidateGrid(grid: GridCoordinate): Promise<void>;
}
