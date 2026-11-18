import type {
  AirQuality,
  AirQualityProviderPort,
} from "#api/modules/weather/weather-reports/application/ports/air-quality-provider.port";

/** 에어코리아를 부르지 않고 고정된 미세먼지 값을 준다. */
export class FakeAirQualityProvider implements AirQualityProviderPort {
  async findAirQuality(): Promise<AirQuality | null> {
    return { pm10: 45, pm25: 22 };
  }
}
