import { ErrorCode } from "@aido/api/errors";
import { LATITUDE_RANGE, LONGITUDE_RANGE } from "@aido/api/vocabulary";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

import type { Coordinate } from "./coordinate.vo.js";

/** 한국 공급자(KMA 격자·AirKorea)를 쓸 수 있는 범위. WGS84 자체의 유효 범위와 구분한다. */
export function isKoreanWeatherCovered(coordinate: Coordinate): boolean {
  const { latitude, longitude } = coordinate;
  return (
    latitude >= LATITUDE_RANGE.MIN &&
    latitude <= LATITUDE_RANGE.MAX &&
    longitude >= LONGITUDE_RANGE.MIN &&
    longitude <= LONGITUDE_RANGE.MAX
  );
}

export function assertKoreanWeatherCovered(coordinate: Coordinate): void {
  const { latitude, longitude } = coordinate;
  if (latitude < LATITUDE_RANGE.MIN || latitude > LATITUDE_RANGE.MAX) {
    throw new DomainException(ErrorCode.SYS_0002, { field: "latitude", value: latitude });
  }
  if (longitude < LONGITUDE_RANGE.MIN || longitude > LONGITUDE_RANGE.MAX) {
    throw new DomainException(ErrorCode.SYS_0002, { field: "longitude", value: longitude });
  }
}
