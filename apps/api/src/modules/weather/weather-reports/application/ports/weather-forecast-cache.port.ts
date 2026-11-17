import type { GridCoordinate } from "../../../shared/domain/grid-coordinate.vo.js";
import type {
  WeatherConditionsReadModel,
  WeatherForecastReadModel,
} from "../read-models/weather-forecast.read-model.js";
import type { ForecastTiming } from "./weather-forecast-provider.port.js";

/** v1 격자 예보 캐시. 정규 예보 3시간, latest 24시간, 부가 정보 1시간을 둔다. */
export abstract class WeatherForecastCachePort {
  abstract findForecast(
    grid: GridCoordinate,
    timing: ForecastTiming,
  ): Promise<WeatherForecastReadModel | null>;

  /**
   * 정규 예보가 없으면 load로 한 번만 불러 정규·latest에 저장한다. 같은 격자를 동시에 물으면
   * 공급자 호출 하나를 나눠 쓴다.
   */
  abstract getOrLoadForecast(
    grid: GridCoordinate,
    timing: ForecastTiming,
    load: () => Promise<WeatherForecastReadModel>,
  ): Promise<WeatherForecastReadModel>;

  /** 최근 1분 안에 공급자 조회가 실패한 격자인지 */
  abstract hasRecentForecastFailure(grid: GridCoordinate): Promise<boolean>;

  /** 격자 조회 실패를 1분 기억해 그동안 요청마다 공급자 시간 초과를 기다리지 않게 한다. */
  abstract markForecastFailure(grid: GridCoordinate): Promise<void>;

  /** 공급자 실패 때 돌려줄 마지막 예보 */
  abstract findLatestForecast(grid: GridCoordinate): Promise<WeatherForecastReadModel | null>;

  /** 부가 정보(체감온도·자외선·일출입·미세먼지)는 예보 지역의 달력 날짜마다 둔다. */
  abstract findConditions(
    grid: GridCoordinate,
    at: Temporal.Instant,
  ): Promise<WeatherConditionsReadModel | null>;

  abstract setConditions(
    grid: GridCoordinate,
    at: Temporal.Instant,
    conditions: WeatherConditionsReadModel,
  ): Promise<void>;
}
