import type { WeatherLocationResponse } from "@aido/api/contracts/weather";

import type { RegisterUserLocationResult } from "../../../application/use-cases/register-user-location.use-case.js";

export function toWeatherLocationResponse(
  result: RegisterUserLocationResult,
): WeatherLocationResponse {
  const { location, timezone } = result;
  return { latitude: location.latitude, longitude: location.longitude, timezone };
}
