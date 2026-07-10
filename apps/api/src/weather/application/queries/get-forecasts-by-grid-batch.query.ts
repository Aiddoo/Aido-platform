import { Query } from "@nestjs/cqrs";
import type { WeatherForecast } from "../ports/weather-provider.port";
import type { GridInput } from "../services/weather-forecast.reader";

/**
 * 여러 격자의 예보를 배치 조회하는 쿼리 (스케줄러·ai-suggestion용, N+1 방지).
 * 결과 Map 키는 "gridX:gridY".
 */
export class GetForecastsByGridBatchQuery extends Query<
	Map<string, WeatherForecast>
> {
	constructor(
		public readonly grids: GridInput[],
		public readonly date: Date,
	) {
		super();
	}
}
