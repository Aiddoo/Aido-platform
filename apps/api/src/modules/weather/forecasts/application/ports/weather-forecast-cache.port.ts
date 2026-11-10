import type { KmaForecastTiming } from "../../domain/kma-forecast-availability.domain-service.js";
import type { WeatherConditions, WeatherForecast } from "./weather-forecast-provider.port.js";

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

export interface WeatherForecastCachePort {
  /** 정규 예보 단건 조회. */
  getForecast(
    gridX: number,
    gridY: number,
    timing: KmaForecastTiming,
  ): Promise<WeatherForecast | undefined>;

  /**
   * 정규 예보가 없으면 load로 한 번만 불러 정규·latest에 저장한다. 같은 격자를 동시에 물으면
   * 공급자 호출 하나를 나눠 쓴다.
   */
  getOrLoadForecast(
    gridX: number,
    gridY: number,
    timing: KmaForecastTiming,
    load: () => Promise<WeatherForecast>,
  ): Promise<WeatherForecast>;

  /** 최근 1분 안에 공급자 조회가 실패한 격자인지 */
  hasRecentForecastFailure(gridX: number, gridY: number): Promise<boolean>;

  /** 격자 조회 실패를 1분 기억해 그동안 요청마다 공급자 시간 초과를 기다리지 않게 한다. */
  markForecastFailure(gridX: number, gridY: number): Promise<void>;

  /** latest 예보 단건 조회 (프로바이더 실패 시 폴백). */
  getLatestForecast(gridX: number, gridY: number): Promise<WeatherForecast | undefined>;

  /** 정규 예보 배치 조회 (입력 순서 보존). */
  getForecastBatch(
    grids: readonly WeatherGridRef[],
    timing: KmaForecastTiming,
  ): Promise<(WeatherForecast | undefined)[]>;

  /** 예보 배치 저장 (각 항목 정규 3h + latest 24h). */
  saveForecastBatch(
    entries: readonly WeatherForecastEntry[],
    timing: KmaForecastTiming,
  ): Promise<void>;

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
