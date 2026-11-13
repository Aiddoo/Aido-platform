import type {
  ForecastAvailability,
  ForecastTiming,
  WeatherForecastProviderPort,
} from "#api/modules/weather/forecasts/application/ports/weather-forecast-provider.port";
import type { WeatherForecast } from "#api/modules/weather/forecasts/application/read-models/weather-forecast.read-model";
import { resolveKmaForecastAvailability } from "#api/modules/weather/forecasts/infrastructure/adapters/kma-issuance.mapper";
import type { GridCoordinate } from "#api/modules/weather/shared/domain/grid-coordinate.vo";

/**
 * 테스트용 FakeWeatherProvider
 *
 * 실제 기상청(KMA) API를 호출하지 않고, 고정된 예보 데이터를 반환합니다. 제공 범위는 실제 기상청 규칙이다.
 */
export class FakeWeatherProvider implements WeatherForecastProviderPort {
  readonly name = "fake";
  readonly timeZone = "Asia/Seoul";
  #calls: Array<{ grid: GridCoordinate; target: Temporal.Instant }> = [];

  resolveAvailability(params: {
    readonly target: Temporal.Instant;
    readonly now: Temporal.Instant;
  }): ForecastAvailability {
    return resolveKmaForecastAvailability(params);
  }

  async getForecast(grid: GridCoordinate, { target }: ForecastTiming): Promise<WeatherForecast> {
    this.#calls.push({ grid, target });
    return {
      date: target,
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
          date: target.toZonedDateTimeISO("UTC").toPlainDate().toString(),
          skyCondition: "CLEAR",
          precipitationType: "NONE",
          precipitationProbability: 10,
          temperatureMin: 8,
          temperatureMax: 20,
        },
      ],
    };
  }

  getCalls(): Array<{ grid: GridCoordinate; target: Temporal.Instant }> {
    return [...this.#calls];
  }

  getCallCount(): number {
    return this.#calls.length;
  }

  clear(): void {
    this.#calls = [];
  }
}
