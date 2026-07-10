import { Injectable } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import type { UserLocation } from "../../domain/entities/user-location.entity";
import type {
	WeatherConditions,
	WeatherForecast,
} from "../ports/weather-provider.port";
import { GetForecastsByGridBatchQuery } from "../queries/get-forecasts-by-grid-batch.query";
import { GetWeatherConditionsQuery } from "../queries/get-weather-conditions.query";
import {
	GetWeatherForecastQuery,
	type WeatherForecastWithLocation,
} from "../queries/get-weather-forecast.query";
import type { GridInput } from "../services/weather-forecast.reader";
import { UpsertLocationCommand } from "../use-cases/upsert-location/upsert-location.command";

/**
 * 날씨 애플리케이션 서비스(Facade) — 컨트롤러와 크로스 모듈(스케줄러·ai-suggestion)의
 * 유일한 주입 대상. 명령/조회를 CommandBus/QueryBus로 흡수한다.
 */
@Injectable()
export class WeatherFacade {
	constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
	) {}

	upsertLocation(
		userId: string,
		latitude: number,
		longitude: number,
	): Promise<UserLocation> {
		return this.commandBus.execute(
			new UpsertLocationCommand(userId, latitude, longitude),
		);
	}

	getForecastForUser(
		userId: string,
		date: Date,
	): Promise<WeatherForecastWithLocation> {
		return this.queryBus.execute(new GetWeatherForecastQuery(userId, date));
	}

	getConditionsForUser(userId: string, date: Date): Promise<WeatherConditions> {
		return this.queryBus.execute(new GetWeatherConditionsQuery(userId, date));
	}

	getForecastsByGridBatch(
		grids: GridInput[],
		date: Date,
	): Promise<Map<string, WeatherForecast>> {
		return this.queryBus.execute(new GetForecastsByGridBatchQuery(grids, date));
	}
}
