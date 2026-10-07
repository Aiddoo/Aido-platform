import type { WeatherConditions, WeatherForecast } from "./weather-provider.port.js";

export const WEATHER_CACHE = Symbol("WEATHER_CACHE");

/** 격자 참조 (캐시 키 파생용). */
export interface WeatherGridRef {
  readonly gridX: number;
  readonly gridY: number;
}

/** 배치 예보 저장 항목. */
export interface WeatherForecastEntry extends WeatherGridRef {
  readonly forecast: WeatherForecast;
}

export interface WeatherCachePort {
  /** 정규 예보 단건 조회. */
  getForecast(gridX: number, gridY: number, date: Date): Promise<WeatherForecast | undefined>;

  /** 예보 단건 저장 (정규 3h + latest 24h). */
  saveForecast(gridX: number, gridY: number, date: Date, forecast: WeatherForecast): Promise<void>;

  /** latest 예보 단건 조회 (프로바이더 실패 시 폴백). */
  getLatestForecast(gridX: number, gridY: number): Promise<WeatherForecast | undefined>;

  /** 정규 예보 배치 조회 (입력 순서 보존). */
  getForecastBatch(
    grids: readonly WeatherGridRef[],
    date: Date,
  ): Promise<(WeatherForecast | undefined)[]>;

  /** 예보 배치 저장 (각 항목 정규 3h + latest 24h). */
  saveForecastBatch(entries: readonly WeatherForecastEntry[], date: Date): Promise<void>;

  /** latest 예보 배치 조회 (입력 순서 보존). */
  getLatestForecastBatch(
    grids: readonly WeatherGridRef[],
  ): Promise<(WeatherForecast | undefined)[]>;

  /** 날씨 부가정보(체감온도·자외선·일출입·미세먼지) 조회. */
  getConditions(gridX: number, gridY: number, date: Date): Promise<WeatherConditions | undefined>;

  /** 날씨 부가정보 저장 (1h TTL). */
  setConditions(
    gridX: number,
    gridY: number,
    date: Date,
    conditions: WeatherConditions,
  ): Promise<void>;

  /** 격자 캐시 전체 무효화 (정규 예보 패턴 + latest + conditions). */
  invalidateGrid(gridX: number, gridY: number): Promise<void>;
}
