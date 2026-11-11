import ngeohash from "ngeohash";

import { ValueObject } from "#api/shared/domain/model/value-object";

import { Coordinate } from "./coordinate.vo.js";

/** 약 4.9km 칸. 같은 칸의 사용자는 공급자 호출과 캐시를 공유한다. */
const GEO_CELL_PRECISION = 5;

/** geohash 칸. 공급자에는 사용자 좌표 대신 칸 중심을 보낸다. */
export class GeoCell extends ValueObject<string> {
  static create(coordinate: Coordinate): GeoCell {
    return new GeoCell(
      ngeohash.encode(coordinate.latitude, coordinate.longitude, GEO_CELL_PRECISION),
    );
  }

  static reconstitute(key: string): GeoCell {
    return new GeoCell(key);
  }

  get key(): string {
    return this.value;
  }

  get center(): Coordinate {
    const { latitude, longitude } = ngeohash.decode(this.value);
    return Coordinate.create(latitude, longitude);
  }
}
