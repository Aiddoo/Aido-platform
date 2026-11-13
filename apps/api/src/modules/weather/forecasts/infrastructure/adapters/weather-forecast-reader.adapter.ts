import { Injectable } from "@nestjs/common";

import {
  type ReadWeatherForecastsQuery,
  WeatherForecastReaderPort,
} from "../../application/ports/weather-forecast.reader.port.js";
import type { WeatherForecast } from "../../application/read-models/weather-forecast.read-model.js";
import { ReadWeatherForecastsUseCase } from "../../application/use-cases/read-weather-forecasts.use-case.js";

// 다른 Context에 여는 문. 묶음 조회는 UseCase가 하고 이 어댑터는 포트 모양만 맞춘다
@Injectable()
export class WeatherForecastReaderAdapter extends WeatherForecastReaderPort {
  readonly #readWeatherForecasts: Pick<ReadWeatherForecastsUseCase, "execute">;

  constructor(readWeatherForecasts: ReadWeatherForecastsUseCase) {
    super();
    this.#readWeatherForecasts = readWeatherForecasts;
  }

  readForecasts(query: ReadWeatherForecastsQuery): Promise<Map<string, WeatherForecast>> {
    return this.#readWeatherForecasts.execute(query);
  }
}
