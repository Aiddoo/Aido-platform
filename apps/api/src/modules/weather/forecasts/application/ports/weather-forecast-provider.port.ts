import type { GridCoordinate } from "../../../shared/domain/grid-coordinate.vo.js";
import type { WeatherForecast } from "../read-models/weather-forecast.read-model.js";

/** 예보 대상 순간과 그 예보를 받아 올 발표 순간. 둘은 다를 수 있다. */
export interface ForecastTiming {
  readonly target: Temporal.Instant;
  readonly issuance: Temporal.Instant;
}

export type ForecastAvailability =
  | { readonly kind: "AVAILABLE"; readonly timing: ForecastTiming }
  | { readonly kind: "UNAVAILABLE" };

/** 한국 예보 격자의 하루치 예보(v1). 새 지역 지원은 별도 작업이다. */
export abstract class WeatherForecastProviderPort {
  /** 로그에 남기는 공급자 식별자 */
  abstract readonly name: string;
  /** 정규화한 시간별 예보의 지역 시간대 */
  abstract readonly timeZone: string;
  /** 요청 순간의 예보를 줄 수 있는 발표를 고른다. 어느 발표에도 없는 날짜면 UNAVAILABLE이다. */
  abstract resolveAvailability(params: {
    readonly target: Temporal.Instant;
    readonly now: Temporal.Instant;
  }): ForecastAvailability;
  /** 예보 격자의 timing.target 날짜 예보를 timing.issuance 발표에서 받는다. */
  abstract getForecast(grid: GridCoordinate, timing: ForecastTiming): Promise<WeatherForecast>;
}
