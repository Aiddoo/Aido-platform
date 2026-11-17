import type { LocationResponse } from "@aido/api/contracts/weather/v1";

import type { RegisterUserLocationResult } from "../../../application/use-cases/register-user-location.use-case.js";

export function toLocationResponse({ location }: RegisterUserLocationResult): LocationResponse {
  // v1 DTO가 한국 범위만 받으므로 격자는 항상 있다
  const grid = location.requireForecastGrid();
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    gridX: grid.gridX,
    gridY: grid.gridY,
  };
}
