import type { Coordinate } from "../../../domain/value-objects/forecast/coordinate.vo.js";
import type { GridCoordinate } from "../../../domain/value-objects/forecast/grid-coordinate.vo.js";

export const WEATHER_GRID_RESOLVER = Symbol("WEATHER_GRID_RESOLVER");

/** 지원 좌표를 영속·캐시용 예보 격자로 변환하는 경계. */
export interface WeatherGridResolverPort {
  resolveGrid(coordinate: Coordinate): GridCoordinate;
}
