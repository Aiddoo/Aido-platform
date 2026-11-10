import type { WeatherForecast } from "../read-models/weather-forecast.read-model.js";

/** 옛 Symbol 토큰. 클래스 토큰과 같은 인스턴스를 가리키며 소비 Context가 옮기면 지운다. */
export const WEATHER_FORECAST_READER = Symbol("WEATHER_FORECAST_READER");

/** 위치 조회 없이 예보를 묶어 읽는 소비자 계약. */
export interface GridInput {
  readonly gridX: number;
  readonly gridY: number;
  readonly lat: number;
  readonly lon: number;
}

/** 다른 Context에는 배치 예보 조회 하나만 공개한다. */
export abstract class WeatherForecastReaderPort {
  abstract getForecastsByGridBatch(
    grids: readonly GridInput[],
    date: Date,
  ): Promise<Map<string, WeatherForecast>>;
}
