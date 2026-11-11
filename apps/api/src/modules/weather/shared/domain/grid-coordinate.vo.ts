import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { ValueObject } from "#api/shared/domain/model/value-object";

interface GridCoordinateValue {
  readonly gridX: number;
  readonly gridY: number;
}

/** 저장된 예보 격자 식별자. 투영 방식과 공급자 범위는 소유하지 않는다. */
export class GridCoordinate extends ValueObject<GridCoordinateValue> {
  static create(gridX: number, gridY: number): GridCoordinate {
    if (!Number.isSafeInteger(gridX)) {
      throw new DomainException(ErrorCode.SYS_0002, { field: "gridX", value: gridX });
    }
    if (!Number.isSafeInteger(gridY)) {
      throw new DomainException(ErrorCode.SYS_0002, { field: "gridY", value: gridY });
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
