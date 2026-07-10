import { GetForecastsByGridBatchHandler } from "./get-forecasts-by-grid-batch.handler";
import { GetWeatherConditionsHandler } from "./get-weather-conditions.handler";
import { GetWeatherForecastHandler } from "./get-weather-forecast.handler";

/** 모듈 등록용 쿼리 핸들러 목록 */
export const QueryHandlers = [
	GetWeatherForecastHandler,
	GetWeatherConditionsHandler,
	GetForecastsByGridBatchHandler,
];
