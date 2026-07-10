import { Query } from "@nestjs/cqrs";
import type { UserLocation } from "../../domain/entities/user-location.entity";
import type { WeatherForecast } from "../ports/weather-provider.port";

/** 예보 + 위치 (컨트롤러가 좌표를 응답에 병합하기 위해 위치도 반환) */
export interface WeatherForecastWithLocation {
	forecast: WeatherForecast;
	location: UserLocation;
}

/**
 * 사용자 위치 기반 날씨 예보 조회 쿼리.
 */
export class GetWeatherForecastQuery extends Query<WeatherForecastWithLocation> {
	constructor(
		public readonly userId: string,
		public readonly date: Date,
	) {
		super();
	}
}
