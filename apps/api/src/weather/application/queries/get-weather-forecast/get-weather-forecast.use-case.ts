import { ErrorCode } from "@aido/errors";
import { Inject, Injectable } from "@nestjs/common";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import type { UserLocation } from "../../../domain/entities/user-location.entity";
import {
	WEATHER_LOCATION_REPOSITORY,
	type WeatherLocationRepositoryPort,
} from "../../ports/weather-location.repository.port";
import type { WeatherForecast } from "../../ports/weather-provider.port";
import { WeatherForecastReader } from "../../services/weather-forecast.reader";

/** 예보 + 위치 (컨트롤러가 좌표를 응답에 병합하기 위해 위치도 반환) */
export interface WeatherForecastWithLocation {
	forecast: WeatherForecast;
	location: UserLocation;
}

/**
 * 사용자 위치 기반 날씨 예보 조회 입력.
 */
export interface GetWeatherForecastInput {
	userId: string;
	date: Date;
}

@Injectable()
export class GetWeatherForecastUseCase {
	constructor(
		@Inject(WEATHER_LOCATION_REPOSITORY)
		private readonly repository: WeatherLocationRepositoryPort,
		private readonly forecastReader: WeatherForecastReader,
	) {}

	async execute(
		input: GetWeatherForecastInput,
	): Promise<WeatherForecastWithLocation> {
		const location = await this.repository.findByUserId(input.userId);
		if (!location) {
			throw new ApplicationException(ErrorCode.WEATHER_1902);
		}

		const forecast = await this.forecastReader.fetchForLocation(
			location,
			input.date,
		);
		return { forecast, location };
	}
}
