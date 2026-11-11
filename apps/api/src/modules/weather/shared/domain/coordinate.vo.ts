import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { ValueObject } from "#api/shared/domain/model/value-object";

interface CoordinateValue {
  readonly latitude: number;
  readonly longitude: number;
}

/** 유한한 WGS84 좌표. 지역 지원과 공급자 격자 계산은 별도 경계가 소유한다. */
export class Coordinate extends ValueObject<CoordinateValue> {
  static create(latitude: number, longitude: number): Coordinate {
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new DomainException(ErrorCode.SYS_0002, { field: "latitude", value: latitude });
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new DomainException(ErrorCode.SYS_0002, { field: "longitude", value: longitude });
    }
    return new Coordinate({ latitude, longitude });
  }

  static reconstitute(latitude: number, longitude: number): Coordinate {
    return new Coordinate({ latitude, longitude });
  }

  get latitude(): number {
    return this.value.latitude;
  }

  get longitude(): number {
    return this.value.longitude;
  }
}
