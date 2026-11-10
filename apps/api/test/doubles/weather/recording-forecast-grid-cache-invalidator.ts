import { ForecastGridCacheInvalidatorPort } from "#api/modules/weather/locations/application/ports/forecast-grid-cache-invalidator.port";
import type { GridCoordinate } from "#api/modules/weather/shared/domain/grid-coordinate.vo";

export class RecordingForecastGridCacheInvalidator extends ForecastGridCacheInvalidatorPort {
  readonly invalidated: { gridX: number; gridY: number }[] = [];

  async invalidateGrid(grid: GridCoordinate): Promise<void> {
    this.invalidated.push({ gridX: grid.gridX, gridY: grid.gridY });
  }
}
