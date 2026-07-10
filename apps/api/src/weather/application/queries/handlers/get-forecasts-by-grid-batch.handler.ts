import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import type { WeatherForecast } from "../../ports/weather-provider.port";
import { WeatherForecastReader } from "../../services/weather-forecast.reader";
import { GetForecastsByGridBatchQuery } from "../get-forecasts-by-grid-batch.query";

@QueryHandler(GetForecastsByGridBatchQuery)
export class GetForecastsByGridBatchHandler
	implements
		IQueryHandler<GetForecastsByGridBatchQuery, Map<string, WeatherForecast>>
{
	constructor(private readonly forecastReader: WeatherForecastReader) {}

	execute(
		query: GetForecastsByGridBatchQuery,
	): Promise<Map<string, WeatherForecast>> {
		return this.forecastReader.fetchBatch(query.grids, query.date);
	}
}
