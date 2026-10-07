import { Coordinate } from "../../value-objects/forecast/coordinate.vo.js";
import { GridCoordinate } from "../../value-objects/forecast/grid-coordinate.vo.js";

export class UserLocation {
  readonly #userId: string;
  readonly #coordinate: Coordinate;
  readonly #grid: GridCoordinate;

  private constructor(userId: string, coordinate: Coordinate, grid: GridCoordinate) {
    this.#userId = userId;
    this.#coordinate = coordinate;
    this.#grid = grid;
  }

  static create(userId: string, coordinate: Coordinate, grid: GridCoordinate): UserLocation {
    return new UserLocation(userId, coordinate, grid);
  }

  static reconstitute(props: {
    readonly userId: string;
    readonly latitude: number;
    readonly longitude: number;
    readonly gridX: number;
    readonly gridY: number;
  }): UserLocation {
    return new UserLocation(
      props.userId,
      Coordinate.of(props.latitude, props.longitude),
      GridCoordinate.of(props.gridX, props.gridY),
    );
  }

  get userId(): string {
    return this.#userId;
  }

  get coordinate(): Coordinate {
    return this.#coordinate;
  }

  get grid(): GridCoordinate {
    return this.#grid;
  }

  get latitude(): number {
    return this.#coordinate.latitude;
  }

  get longitude(): number {
    return this.#coordinate.longitude;
  }

  get gridX(): number {
    return this.#grid.gridX;
  }

  get gridY(): number {
    return this.#grid.gridY;
  }
}
