import { ErrorCode } from "@aido/api/errors";
import { LATITUDE_RANGE, LONGITUDE_RANGE } from "@aido/api/vocabulary";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

import type { Coordinate } from "../../value-objects/forecast/coordinate.vo.js";

/** 현재 상품의 한국 지원 범위. WGS84 자체의 유효 범위와 구분한다. */
export const KoreanWeatherCoveragePolicy = {
  assertSupported(coordinate: Coordinate): void {
    const { latitude, longitude } = coordinate;
    if (latitude < LATITUDE_RANGE.MIN || latitude > LATITUDE_RANGE.MAX) {
      throw new DomainException(ErrorCode.SYS_0002, { field: "latitude", value: latitude });
    }
    if (longitude < LONGITUDE_RANGE.MIN || longitude > LONGITUDE_RANGE.MAX) {
      throw new DomainException(ErrorCode.SYS_0002, { field: "longitude", value: longitude });
    }
  },
};
