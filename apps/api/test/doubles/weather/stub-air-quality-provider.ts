import type { GeoCell } from "#api/modules/weather/shared/domain/geo-cell.vo";
import {
  type AirQuality,
  AirQualityProviderPort,
} from "#api/modules/weather/weather-reports/application/ports/air-quality-provider.port";

export class StubAirQualityProvider extends AirQualityProviderPort {
  readonly calls: { cellKey: string }[] = [];
  result: AirQuality | null = { pm10: 0, pm25: 0 };
  failure: Error | null = null;

  async findAirQuality(cell: GeoCell): Promise<AirQuality | null> {
    this.calls.push({ cellKey: cell.key });
    if (this.failure !== null) {
      throw this.failure;
    }
    return this.result === null ? null : { ...this.result };
  }

  clear(): void {
    this.calls.length = 0;
    this.result = { pm10: 0, pm25: 0 };
    this.failure = null;
  }
}
