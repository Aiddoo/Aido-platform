import { Query } from "@nestjs/cqrs";
import type { WeatherConditions } from "../ports/weather-provider.port";

/**
 * 사용자 위치 기반 날씨 부가 정보(체감온도·자외선·일출/일몰·미세먼지) 조회 쿼리.
 */
export class GetWeatherConditionsQuery extends Query<WeatherConditions> {
	constructor(
		public readonly userId: string,
		public readonly date: Date,
	) {
		super();
	}
}
