import { GetForecastsByGridBatchUseCase } from "./queries/get-forecasts-by-grid-batch/get-forecasts-by-grid-batch.use-case";
import { GetWeatherConditionsUseCase } from "./queries/get-weather-conditions/get-weather-conditions.use-case";
import { GetWeatherForecastUseCase } from "./queries/get-weather-forecast/get-weather-forecast.use-case";
import { UpsertLocationUseCase } from "./use-cases/upsert-location/upsert-location.use-case";

export const WEATHER_PROVIDERS = [
	GetWeatherForecastUseCase,
	GetWeatherConditionsUseCase,
	GetForecastsByGridBatchUseCase,
	UpsertLocationUseCase,
] as const;
