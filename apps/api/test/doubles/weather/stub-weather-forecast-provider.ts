import {
  type ForecastAvailability,
  type ForecastTiming,
  WeatherForecastProviderPort,
} from "#api/modules/weather/forecasts/application/ports/weather-forecast-provider.port";
import type { WeatherForecast } from "#api/modules/weather/forecasts/application/read-models/weather-forecast.read-model";
import { resolveKmaForecastAvailability } from "#api/modules/weather/forecasts/infrastructure/adapters/kma-issuance.mapper";
import type { GridCoordinate } from "#api/modules/weather/shared/domain/grid-coordinate.vo";
import { weatherForecastFixture } from "#test/fixtures/weather.fixture";

export interface RecordedForecastCall {
  readonly gridX: number;
  readonly gridY: number;
  readonly target: Temporal.Instant;
  readonly issuance: Temporal.Instant;
}

/** 기본 예보를 돌려주고 호출을 기록한다. 격자(`gridX:gridY`)별 결과나 실패를 미리 정할 수 있다. 제공 범위는 실제 기상청 규칙이다. */
export class StubWeatherForecastProvider extends WeatherForecastProviderPort {
  readonly name = "fixture";
  readonly timeZone: string;
  readonly calls: RecordedForecastCall[] = [];
  readonly results = new Map<string, WeatherForecast | Error>();
  failure: Error | null = null;
  forecast = weatherForecastFixture();

  constructor(timeZone = "Asia/Seoul") {
    super();
    this.timeZone = timeZone;
  }

  resolveAvailability(params: {
    readonly target: Temporal.Instant;
    readonly now: Temporal.Instant;
  }): ForecastAvailability {
    return resolveKmaForecastAvailability(params);
  }

  async getForecast(
    grid: GridCoordinate,
    { target, issuance }: ForecastTiming,
  ): Promise<WeatherForecast> {
    this.calls.push({ gridX: grid.gridX, gridY: grid.gridY, target, issuance });
    const result = this.results.get(`${grid.gridX}:${grid.gridY}`) ?? this.failure ?? this.forecast;
    if (result instanceof Error) {
      throw result;
    }
    return weatherForecastFixture({ ...result, date: target });
  }

  clear(): void {
    this.calls.length = 0;
    this.results.clear();
    this.failure = null;
    this.forecast = weatherForecastFixture();
  }
}
