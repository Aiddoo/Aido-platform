import type { WeatherForecast } from "./weather-provider.port.js";

export const WEATHER_FORECAST_READER = Symbol("WEATHER_FORECAST_READER");

/** 위치 조회 없이 예보를 묶어 읽는 소비자 계약. */
export interface GridInput {
  readonly gridX: number;
  readonly gridY: number;
  readonly lat: number;
  readonly lon: number;
}

/** 다른 Context에는 배치 예보 조회 하나만 공개한다. */
export interface WeatherForecastReaderPort {
  getForecastsByGridBatch(
    grids: readonly GridInput[],
    date: Date,
  ): Promise<Map<string, WeatherForecast>>;
}
