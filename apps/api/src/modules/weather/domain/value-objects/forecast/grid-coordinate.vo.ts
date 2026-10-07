import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

/** 저장된 예보 격자 식별자. 투영 방식과 공급자 범위는 소유하지 않는다. */
export class GridCoordinate {
  readonly #gridX: number;
  readonly #gridY: number;

  private constructor(gridX: number, gridY: number) {
    this.#gridX = gridX;
    this.#gridY = gridY;
  }

  static of(gridX: number, gridY: number): GridCoordinate {
    if (!Number.isSafeInteger(gridX)) {
      throw new DomainException(ErrorCode.SYS_0002, { field: "gridX", value: gridX });
    }
    if (!Number.isSafeInteger(gridY)) {
      throw new DomainException(ErrorCode.SYS_0002, { field: "gridY", value: gridY });
    }
    return new GridCoordinate(gridX, gridY);
  }

  get gridX(): number {
    return this.#gridX;
  }

  get gridY(): number {
    return this.#gridY;
  }

  equals(other: GridCoordinate): boolean {
    return this.#gridX === other.#gridX && this.#gridY === other.#gridY;
  }
}
