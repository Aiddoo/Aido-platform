import {
  type AirQuality,
  AirQualityProviderPort,
} from "#api/modules/weather/forecasts/application/ports/air-quality-provider.port";

export class StubAirQualityProvider extends AirQualityProviderPort {
  readonly calls: { lat: number; lon: number }[] = [];
  result: AirQuality | null = { pm10: 0, pm25: 0 };
  failure: Error | null = null;

  async getAirQuality(lat: number, lon: number): Promise<AirQuality | null> {
    this.calls.push({ lat, lon });
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
