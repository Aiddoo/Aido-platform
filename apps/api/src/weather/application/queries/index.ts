import { GetForecastsByGridBatchUseCase } from "./get-forecasts-by-grid-batch/get-forecasts-by-grid-batch.use-case";
import { GetWeatherConditionsUseCase } from "./get-weather-conditions/get-weather-conditions.use-case";
import { GetWeatherForecastUseCase } from "./get-weather-forecast/get-weather-forecast.use-case";

/** 모듈 등록용 쿼리 use-case 목록 */
export const WeatherQueryUseCases = [
	GetWeatherForecastUseCase,
	GetWeatherConditionsUseCase,
	GetForecastsByGridBatchUseCase,
];
