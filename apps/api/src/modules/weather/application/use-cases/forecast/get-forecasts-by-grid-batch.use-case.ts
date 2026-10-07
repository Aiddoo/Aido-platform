import type { WeatherForecast } from "../../ports/forecast/weather-provider.port.js";
import type { WeatherForecastReader } from "../../services/forecast/weather-forecast.reader.js";
import { type GridInput } from "../../services/forecast/weather-forecast.reader.js";

/**
 * 여러 격자의 예보를 배치 조회하는 입력 (스케줄러·ai-suggestion용, N+1 방지).
 * 결과 Map 키는 "gridX:gridY".
 */
export interface GetForecastsByGridBatchInput {
  grids: GridInput[];
  date: Date;
}

interface GetForecastsByGridBatchDependencies {
  readonly forecastReader: WeatherForecastReader;
}

export class GetForecastsByGridBatch {
  readonly #dependencies: GetForecastsByGridBatchDependencies;

  constructor(dependencies: GetForecastsByGridBatchDependencies) {
    this.#dependencies = dependencies;
  }

  execute(input: GetForecastsByGridBatchInput): Promise<Map<string, WeatherForecast>> {
    return this.#dependencies.forecastReader.fetchBatch(input.grids, input.date);
  }
}
