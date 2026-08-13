import type { WeatherForecast } from "../ports/weather-provider.port";
import { GetForecastsByGridBatchUseCase } from "../queries/get-forecasts-by-grid-batch/get-forecasts-by-grid-batch.use-case";
import type { GridInput } from "../services/weather-forecast.reader";

/** 스케줄러와 AI 컨텍스트가 공유하는 격자 단위 예보 조회 경계. */
export class WeatherForecastAccess {
	constructor(
		private readonly getForecastsByGridBatchUseCase: GetForecastsByGridBatchUseCase,
	) {}

	getForecastsByGridBatch(
		grids: GridInput[],
		date: Date,
	): Promise<Map<string, WeatherForecast>> {
		return this.getForecastsByGridBatchUseCase.execute({ grids, date });
	}
}
