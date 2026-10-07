/** 다른 Context에는 예보 read model과 최소 배치 조회 capability만 공개한다. */
export { WEATHER_FORECAST_READER } from "./application/ports/forecast/weather-forecast.reader.port.js";
export type {
  GridInput,
  WeatherForecastReaderPort,
} from "./application/ports/forecast/weather-forecast.reader.port.js";
export type { WeatherForecast } from "./application/ports/forecast/weather-provider.port.js";
export { WeatherForecastModule } from "./weather-forecast.module.js";
