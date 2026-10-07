import { Injectable } from "@nestjs/common";

import type { WeatherGridResolverPort } from "../../../application/ports/forecast/weather-grid-resolver.port.js";
import { KoreanWeatherCoveragePolicy } from "../../../domain/policies/forecast/korean-weather-coverage.policy.js";
import type { Coordinate } from "../../../domain/value-objects/forecast/coordinate.vo.js";
import { GridCoordinate } from "../../../domain/value-objects/forecast/grid-coordinate.vo.js";
import { convertToGrid } from "./lambert-projection.js";

@Injectable()
export class KmaWeatherGridResolver implements WeatherGridResolverPort {
  resolveGrid(coordinate: Coordinate): GridCoordinate {
    KoreanWeatherCoveragePolicy.assertSupported(coordinate);
    const { nx, ny } = convertToGrid(coordinate.latitude, coordinate.longitude);
    return GridCoordinate.of(nx, ny);
  }
}
