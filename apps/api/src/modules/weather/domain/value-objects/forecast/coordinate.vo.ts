import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

/** 유한한 WGS84 좌표. 지역 지원과 공급자 격자 계산은 별도 경계가 소유한다. */
export class Coordinate {
  readonly #latitude: number;
  readonly #longitude: number;

  private constructor(latitude: number, longitude: number) {
    this.#latitude = latitude;
    this.#longitude = longitude;
  }

  static of(latitude: number, longitude: number): Coordinate {
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new DomainException(ErrorCode.SYS_0002, { field: "latitude", value: latitude });
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new DomainException(ErrorCode.SYS_0002, { field: "longitude", value: longitude });
    }
    return new Coordinate(latitude, longitude);
  }

  get latitude(): number {
    return this.#latitude;
  }

  get longitude(): number {
    return this.#longitude;
  }
}
