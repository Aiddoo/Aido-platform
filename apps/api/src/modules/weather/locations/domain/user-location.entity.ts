import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

import { Coordinate } from "../../shared/domain/coordinate.vo.js";
import { GridCoordinate } from "../../shared/domain/grid-coordinate.vo.js";

export class UserLocation {
  readonly #userId: string;
  readonly #coordinate: Coordinate;
  readonly #grid: GridCoordinate | null;
  readonly #timezone: string | null;

  constructor(
    userId: string,
    coordinate: Coordinate,
    grid: GridCoordinate | null,
    timezone: string | null,
  ) {
    this.#userId = userId;
    this.#coordinate = coordinate;
    this.#grid = grid;
    this.#timezone = timezone;
  }

  /** grid는 KMA 지원 범위 안의 좌표에만 있다. */
  static create(props: {
    readonly userId: string;
    readonly coordinate: Coordinate;
    readonly grid: GridCoordinate | null;
    readonly timezone: string;
  }): UserLocation {
    return new UserLocation(props.userId, props.coordinate, props.grid, props.timezone);
  }

  /** timezone은 v2 이전에 저장된 행에서 null이다. */
  static reconstitute(props: {
    readonly userId: string;
    readonly latitude: number;
    readonly longitude: number;
    readonly gridX: number | null;
    readonly gridY: number | null;
    readonly timezone: string | null;
  }): UserLocation {
    const grid =
      props.gridX == null || props.gridY == null
        ? null
        : GridCoordinate.of(props.gridX, props.gridY);
    return new UserLocation(
      props.userId,
      Coordinate.of(props.latitude, props.longitude),
      grid,
      props.timezone,
    );
  }

  get userId(): string {
    return this.#userId;
  }

  get coordinate(): Coordinate {
    return this.#coordinate;
  }

  get grid(): GridCoordinate | null {
    return this.#grid;
  }

  get timezone(): string | null {
    return this.#timezone;
  }

  get latitude(): number {
    return this.#coordinate.latitude;
  }

  get longitude(): number {
    return this.#coordinate.longitude;
  }

  /** v1 KMA 경로는 격자 없는 해외 위치를 "위치 없음"과 같은 WEATHER_1902로 다룬다. */
  requireKmaGrid(): GridCoordinate {
    if (this.#grid == null) {
      throw new DomainException(ErrorCode.WEATHER_1902);
    }
    return this.#grid;
  }
}
