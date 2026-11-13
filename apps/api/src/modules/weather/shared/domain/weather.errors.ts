import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export function invalidCoordinate(field: "latitude" | "longitude", value: number): DomainException {
  return new DomainException(ErrorCode.SYS_0002, { field, value });
}

export function invalidGridCoordinate(field: "gridX" | "gridY", value: number): DomainException {
  return new DomainException(ErrorCode.SYS_0002, { field, value });
}

/** KMA 예보가 덮지 않는 좌표다 */
export function coordinateOutsideKoreanWeather(
  field: "latitude" | "longitude",
  value: number,
): DomainException {
  return new DomainException(ErrorCode.SYS_0002, { field, value });
}
