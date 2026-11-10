import type { WeatherLocationResponse } from "@aido/api/contracts/weather";

import type { UpsertLocationResult } from "../../../application/use-cases/upsert-user-location.use-case.js";

export function toWeatherLocationResponse(result: UpsertLocationResult): WeatherLocationResponse {
  const { location, timezone } = result;
  return { latitude: location.latitude, longitude: location.longitude, timezone };
}
