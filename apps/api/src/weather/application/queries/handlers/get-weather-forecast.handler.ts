import { ErrorCode } from "@aido/errors";
import { Inject } from "@nestjs/common";
import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import {
	WEATHER_LOCATION_REPOSITORY,
	type WeatherLocationRepositoryPort,
} from "../../ports/weather-location.repository.port";
import { WeatherForecastReader } from "../../services/weather-forecast.reader";
import {
	GetWeatherForecastQuery,
	type WeatherForecastWithLocation,
} from "../get-weather-forecast.query";

@QueryHandler(GetWeatherForecastQuery)
export class GetWeatherForecastHandler
	implements IQueryHandler<GetWeatherForecastQuery, WeatherForecastWithLocation>
{
	constructor(
		@Inject(WEATHER_LOCATION_REPOSITORY)
		private readonly repository: WeatherLocationRepositoryPort,
		private readonly forecastReader: WeatherForecastReader,
	) {}

	async execute(
		query: GetWeatherForecastQuery,
	): Promise<WeatherForecastWithLocation> {
		const location = await this.repository.findByUserId(query.userId);
		if (!location) {
			throw new ApplicationException(ErrorCode.WEATHER_1902);
		}

		const forecast = await this.forecastReader.fetchForLocation(
			location,
			query.date,
		);
		return { forecast, location };
	}
}
