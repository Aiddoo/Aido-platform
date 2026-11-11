import type { WeatherForecastProviderPort } from "#api/modules/weather/forecasts/application/ports/weather-forecast-provider.port";
import type { WeatherForecast } from "#api/modules/weather/forecasts/application/read-models/weather-forecast.read-model";
import type { KmaForecastTiming } from "#api/modules/weather/forecasts/domain/kma-forecast-availability.domain-service";

/**
 * 테스트용 FakeWeatherProvider
 *
 * 실제 기상청(KMA) API를 호출하지 않고, 고정된 예보 데이터를 반환합니다.
 */
export class FakeWeatherProvider implements WeatherForecastProviderPort {
  readonly name = "fake";
  readonly timeZone = "Asia/Seoul";
  #calls: Array<{ lat: number; lon: number; date: Date }> = [];

  async getForecast(
    lat: number,
    lon: number,
    { target: date }: KmaForecastTiming,
  ): Promise<WeatherForecast> {
    this.#calls.push({ lat, lon, date });
    return {
      date,
      skyCondition: "CLEAR",
      precipitationType: "NONE",
      precipitationProbability: 10,
      temperatureMin: 8,
      temperatureMax: 20,
      humidity: 55,
      windSpeed: 3.5,
      hourlyForecasts: Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        temperature: 10 + Math.round(Math.sin((i / 24) * Math.PI) * 10),
        skyCondition: "CLEAR",
        precipitationProbability: 10,
        precipitationAmount: 0,
        snowAmount: 0,
      })),
      dailyForecasts: [
        {
          date: date.toISOString().slice(0, 10),
          skyCondition: "CLEAR",
          precipitationType: "NONE",
          precipitationProbability: 10,
          temperatureMin: 8,
          temperatureMax: 20,
        },
      ],
    };
  }

  isConfigured(): boolean {
    return true;
  }

  getCalls(): Array<{ lat: number; lon: number; date: Date }> {
    return [...this.#calls];
  }

  getCallCount(): number {
    return this.#calls.length;
  }

  clear(): void {
    this.#calls = [];
  }
}
