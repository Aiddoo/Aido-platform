import type {
  AirQuality,
  AirQualityProviderPort,
} from "#api/modules/weather/forecasts/application/ports/air-quality-provider.port";

/**
 * 테스트용 FakeAirQualityProvider
 *
 * 실제 에어코리아 API를 호출하지 않고, 고정된 미세먼지 데이터를 반환합니다.
 */
export class FakeAirQualityProvider implements AirQualityProviderPort {
  #calls: Array<{ lat: number; lon: number }> = [];

  async getAirQuality(lat: number, lon: number): Promise<AirQuality | null> {
    this.#calls.push({ lat, lon });
    return { pm10: 45, pm25: 22 };
  }

  getCalls(): Array<{ lat: number; lon: number }> {
    return [...this.#calls];
  }

  getCallCount(): number {
    return this.#calls.length;
  }

  clear(): void {
    this.#calls = [];
  }
}
