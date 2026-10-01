import { GetForecastsByGridBatchUseCase } from "./queries/get-forecasts-by-grid-batch/get-forecasts-by-grid-batch.use-case.js";
import { GetWeatherConditionsUseCase } from "./queries/get-weather-conditions/get-weather-conditions.use-case.js";
import { GetWeatherForecastUseCase } from "./queries/get-weather-forecast/get-weather-forecast.use-case.js";
import { UpsertLocationUseCase } from "./use-cases/upsert-location/upsert-location.use-case.js";

export const WEATHER_PROVIDERS = [
	GetWeatherForecastUseCase,
	GetWeatherConditionsUseCase,
	GetForecastsByGridBatchUseCase,
	UpsertLocationUseCase,
] as const;
