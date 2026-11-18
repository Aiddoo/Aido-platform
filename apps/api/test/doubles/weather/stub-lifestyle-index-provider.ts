import {
  type LifestyleIndex,
  LifestyleIndexProviderPort,
  type LifestyleIndexQuery,
} from "#api/modules/weather/weather-reports/application/ports/lifestyle-index-provider.port";

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

  async getIndex(query: LifestyleIndexQuery): Promise<LifestyleIndex> {
    this.calls.push({ ...query });
    if (this.failure !== null) {
      throw this.failure;
    }
    return this.result === null
      ? { feelsLikeTemperature: query.currentTemp, uvIndex: 0 }
      : { ...this.result };
  }

  clear(): void {
    this.calls.length = 0;
    this.result = null;
    this.failure = null;
  }
}
