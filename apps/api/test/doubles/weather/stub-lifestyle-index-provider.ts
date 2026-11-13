import {
  type LifestyleIndex,
  LifestyleIndexProviderPort,
} from "#api/modules/weather/forecasts/application/ports/lifestyle-index-provider.port";

export class StubLifestyleIndexProvider extends LifestyleIndexProviderPort {
  readonly calls: {
    lat: number;
    lon: number;
    at: Temporal.Instant;
    currentTemp: number;
    windSpeed: number;
  }[] = [];
  result: LifestyleIndex | null = null;
  failure: Error | null = null;

  async getIndex(
    lat: number,
    lon: number,
    at: Temporal.Instant,
    currentTemp: number,
    windSpeed: number,
  ): Promise<LifestyleIndex> {
    this.calls.push({ lat, lon, at, currentTemp, windSpeed });
    if (this.failure !== null) {
      throw this.failure;
    }
    return this.result === null
      ? { feelsLikeTemperature: currentTemp, uvIndex: 0 }
      : { ...this.result };
  }

  clear(): void {
    this.calls.length = 0;
    this.result = null;
    this.failure = null;
  }
}
