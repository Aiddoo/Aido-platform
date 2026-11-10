import type { Coordinate } from "../../../shared/domain/coordinate.vo.js";
import type { GridCoordinate } from "../../../shared/domain/grid-coordinate.vo.js";

/** 지원 좌표를 영속·캐시용 예보 격자로 변환하는 경계. */
export abstract class WeatherGridResolverPort {
  abstract resolveGrid(coordinate: Coordinate): GridCoordinate;
}
