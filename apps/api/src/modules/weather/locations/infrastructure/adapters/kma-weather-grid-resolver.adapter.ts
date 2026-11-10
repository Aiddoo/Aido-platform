import { Injectable } from "@nestjs/common";

import type { Coordinate } from "../../../shared/domain/coordinate.vo.js";
import { GridCoordinate } from "../../../shared/domain/grid-coordinate.vo.js";
import { convertToGrid } from "../../../shared/domain/kma-grid-projection.domain-service.js";
import { KoreanWeatherCoveragePolicy } from "../../../shared/domain/korean-weather-coverage.domain-service.js";
import type { WeatherGridResolverPort } from "../../application/ports/weather-grid-resolver.port.js";

@Injectable()
export class KmaWeatherGridResolver implements WeatherGridResolverPort {
  resolveGrid(coordinate: Coordinate): GridCoordinate {
    KoreanWeatherCoveragePolicy.assertSupported(coordinate);
    const { nx, ny } = convertToGrid(coordinate.latitude, coordinate.longitude);
    return GridCoordinate.of(nx, ny);
  }
}
