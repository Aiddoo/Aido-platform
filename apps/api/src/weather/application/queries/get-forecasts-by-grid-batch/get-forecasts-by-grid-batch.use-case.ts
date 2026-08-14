import { Injectable } from "@nestjs/common";

import type { WeatherForecast } from "../../ports/weather-provider.port";
import { type GridInput, WeatherForecastReader } from "../../services/weather-forecast.reader";

/**
 * 여러 격자의 예보를 배치 조회하는 입력 (스케줄러·ai-suggestion용, N+1 방지).
 * 결과 Map 키는 "gridX:gridY".
 */
export interface GetForecastsByGridBatchInput {
	grids: GridInput[];
	date: Date;
}

@Injectable()
export class GetForecastsByGridBatchUseCase {
	constructor(private readonly forecastReader: WeatherForecastReader) {}

	execute(input: GetForecastsByGridBatchInput): Promise<Map<string, WeatherForecast>> {
		return this.forecastReader.fetchBatch(input.grids, input.date);
	}
}
