import type { WeatherForecast } from "../../ports/forecast/weather-provider.port.js";
import type { GridInput } from "../../services/forecast/weather-forecast.reader.js";
import type { GetForecastsByGridBatch } from "../../use-cases/forecast/get-forecasts-by-grid-batch.use-case.js";

/** 스케줄러와 AI 컨텍스트가 공유하는 격자 단위 예보 조회 경계. */
export class WeatherForecastAccess {
  constructor(private readonly getForecastsByGridBatchUseCase: GetForecastsByGridBatch) {}

  getForecastsByGridBatch(grids: GridInput[], date: Date): Promise<Map<string, WeatherForecast>> {
    return this.getForecastsByGridBatchUseCase.execute({ grids, date });
  }
}
