import {
  type SunTime,
  SunTimeProviderPort,
} from "#api/modules/weather/forecasts/application/ports/sun-time-provider.port";

export class StubSunTimeProvider extends SunTimeProviderPort {
  readonly calls: { lat: number; lon: number; date: Date }[] = [];
  readonly dates = new Map<string, SunTime | null>();
  result: SunTime | null = { sunrise: "05:23", sunset: "19:00" };
  failure: Error | null = null;

  async getSunTime(lat: number, lon: number, date: Date): Promise<SunTime | null> {
    this.calls.push({ lat, lon, date: new Date(date) });
    if (this.failure !== null) {
      throw this.failure;
    }
    const key = date.toISOString().slice(0, 10);
    const result = this.dates.has(key) ? this.dates.get(key) : this.result;
    return result == null ? null : { ...result };
  }

  clear(): void {
    this.calls.length = 0;
    this.dates.clear();
    this.result = { sunrise: "05:23", sunset: "19:00" };
    this.failure = null;
  }
}
