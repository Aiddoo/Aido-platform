import { Injectable } from "@nestjs/common";
import type { UserLocation } from "../../domain/entities/user-location.entity";
import type {
	WeatherConditions,
	WeatherForecast,
} from "../ports/weather-provider.port";
import { GetForecastsByGridBatchUseCase } from "../queries/get-forecasts-by-grid-batch/get-forecasts-by-grid-batch.use-case";
import { GetWeatherConditionsUseCase } from "../queries/get-weather-conditions/get-weather-conditions.use-case";
import {
	GetWeatherForecastUseCase,
	type WeatherForecastWithLocation,
} from "../queries/get-weather-forecast/get-weather-forecast.use-case";
import type { GridInput } from "../services/weather-forecast.reader";
import { UpsertLocationUseCase } from "../use-cases/upsert-location/upsert-location.use-case";

/**
 * 날씨 애플리케이션 서비스(Facade) — 컨트롤러와 크로스 모듈(스케줄러·ai-suggestion)의
 * 유일한 주입 대상. 명령/조회를 use-case 위임으로 흡수한다.
 */
@Injectable()
export class WeatherFacade {
	constructor(
		private readonly upsertLocationUseCase: UpsertLocationUseCase,
		private readonly getWeatherForecastUseCase: GetWeatherForecastUseCase,
		private readonly getWeatherConditionsUseCase: GetWeatherConditionsUseCase,
		private readonly getForecastsByGridBatchUseCase: GetForecastsByGridBatchUseCase,
	) {}

	upsertLocation(
		userId: string,
		latitude: number,
		longitude: number,
	): Promise<UserLocation> {
		return this.upsertLocationUseCase.execute({ userId, latitude, longitude });
	}

	getForecastForUser(
		userId: string,
		date: Date,
	): Promise<WeatherForecastWithLocation> {
		return this.getWeatherForecastUseCase.execute({ userId, date });
	}

	getConditionsForUser(userId: string, date: Date): Promise<WeatherConditions> {
		return this.getWeatherConditionsUseCase.execute({ userId, date });
	}

	getForecastsByGridBatch(
		grids: GridInput[],
		date: Date,
	): Promise<Map<string, WeatherForecast>> {
		return this.getForecastsByGridBatchUseCase.execute({ grids, date });
	}
}
