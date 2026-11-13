import { ValueObject } from "#api/shared/domain/model/value-object";

import { invalidGridCoordinate } from "./weather.errors.js";

interface GridCoordinateValue {
  readonly gridX: number;
  readonly gridY: number;
}

/** 저장된 예보 격자 식별자. 투영 방식과 공급자 범위는 소유하지 않는다. */
export class GridCoordinate extends ValueObject<GridCoordinateValue> {
  static create(gridX: number, gridY: number): GridCoordinate {
    if (!Number.isSafeInteger(gridX)) {
      throw invalidGridCoordinate("gridX", gridX);
    }
    if (!Number.isSafeInteger(gridY)) {
      throw invalidGridCoordinate("gridY", gridY);
    }
    return new GridCoordinate({ gridX, gridY });
  }

  static reconstitute(gridX: number, gridY: number): GridCoordinate {
    return new GridCoordinate({ gridX, gridY });
  }

  get gridX(): number {
    return this.value.gridX;
  }

  get gridY(): number {
    return this.value.gridY;
  }
}
