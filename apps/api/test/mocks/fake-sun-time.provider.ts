import type {
  SunTime,
  SunTimeProviderPort,
} from "#api/modules/weather/forecasts/application/ports/sun-time-provider.port";

/**
 * 테스트용 FakeSunTimeProvider
 *
 * 실제 KASI(한국천문연구원) API를 호출하지 않고, 고정된 일출/일몰 데이터를 반환합니다.
 */
export class FakeSunTimeProvider implements SunTimeProviderPort {
  #calls: Array<{ lat: number; lon: number; at: Temporal.Instant }> = [];

  async getSunTime(lat: number, lon: number, at: Temporal.Instant): Promise<SunTime | null> {
    this.#calls.push({ lat, lon, at });
    return { sunrise: "06:15", sunset: "18:45" };
  }

  getCalls(): Array<{ lat: number; lon: number; at: Temporal.Instant }> {
    return [...this.#calls];
  }

  getCallCount(): number {
    return this.#calls.length;
  }

  clear(): void {
    this.#calls = [];
  }
}
