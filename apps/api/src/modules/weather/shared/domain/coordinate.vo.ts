import { ValueObject } from "#api/shared/domain/model/value-object";

import { invalidCoordinate } from "./weather.errors.js";

interface CoordinateValue {
  readonly latitude: number;
  readonly longitude: number;
}

/** 유한한 WGS84 좌표. 지역 지원과 공급자 격자 계산은 별도 경계가 소유한다. */
export class Coordinate extends ValueObject<CoordinateValue> {
  static create(latitude: number, longitude: number): Coordinate {
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw invalidCoordinate("latitude", latitude);
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw invalidCoordinate("longitude", longitude);
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
