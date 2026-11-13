import {
  type SunTime,
  SunTimeProviderPort,
} from "#api/modules/weather/forecasts/application/ports/sun-time-provider.port";

export class StubSunTimeProvider extends SunTimeProviderPort {
  readonly calls: { lat: number; lon: number; at: Temporal.Instant }[] = [];
  readonly dates = new Map<string, SunTime | null>();
  result: SunTime | null = { sunrise: "05:23", sunset: "19:00" };
  failure: Error | null = null;

  /** 결과는 UTC 날짜(`YYYY-MM-DD`)별로 정할 수 있다 */
  async getSunTime(lat: number, lon: number, at: Temporal.Instant): Promise<SunTime | null> {
    this.calls.push({ lat, lon, at });
    if (this.failure !== null) {
      throw this.failure;
    }
    const key = at.toZonedDateTimeISO("UTC").toPlainDate().toString();
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
