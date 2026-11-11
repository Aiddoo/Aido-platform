import type {
  LifestyleIndex,
  LifestyleIndexProviderPort,
} from "#api/modules/weather/forecasts/application/ports/lifestyle-index-provider.port";

/**
 * 테스트용 FakeLifestyleIndexProvider
 *
 * 실제 기상청 생활기상지수 API를 호출하지 않고, 고정된 데이터를 반환합니다.
 */
export class FakeLifestyleIndexProvider implements LifestyleIndexProviderPort {
  #calls: Array<{
    lat: number;
    lon: number;
    date: Date;
    currentTemp: number;
    windSpeed: number;
  }> = [];

  async getIndex(
    lat: number,
    lon: number,
    date: Date,
    currentTemp: number,
    windSpeed: number,
  ): Promise<LifestyleIndex> {
    this.#calls.push({ lat, lon, date, currentTemp, windSpeed });
    return { feelsLikeTemperature: 12, uvIndex: 5 };
  }

  getCalls(): Array<{
    lat: number;
    lon: number;
    date: Date;
    currentTemp: number;
    windSpeed: number;
  }> {
    return [...this.#calls];
  }

  getCallCount(): number {
    return this.#calls.length;
  }

  clear(): void {
    this.#calls = [];
  }
}
