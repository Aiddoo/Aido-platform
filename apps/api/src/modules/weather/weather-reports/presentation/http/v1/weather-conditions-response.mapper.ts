import type { WeatherConditions as WeatherConditionsResponse } from "@aido/api/contracts/weather";

import type { WeatherConditionsReadModel } from "../../../application/read-models/weather-forecast.read-model.js";

export function toWeatherConditionsResponse(
  conditions: WeatherConditionsReadModel,
): WeatherConditionsResponse {
  return { ...conditions };
}
