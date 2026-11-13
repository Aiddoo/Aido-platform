import type { WeatherForecast } from "../read-models/weather-forecast.read-model.js";

/** 다른 Context가 저장해 둔 예보 격자 */
export interface GridInput {
  readonly gridX: number;
  readonly gridY: number;
}

export interface ReadWeatherForecastsQuery {
  readonly grids: readonly GridInput[];
  readonly target: Temporal.Instant;
}

/** 다른 Context에는 위치 조회 없는 격자 묶음 예보 조회 하나만 연다. 결과 키는 `gridX:gridY`다. */
export abstract class WeatherForecastReaderPort {
  abstract readForecasts(query: ReadWeatherForecastsQuery): Promise<Map<string, WeatherForecast>>;
}
