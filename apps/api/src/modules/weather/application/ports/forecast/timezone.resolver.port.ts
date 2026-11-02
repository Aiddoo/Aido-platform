import type { Coordinate } from "../../../domain/value-objects/forecast/coordinate.vo.js";

export const TIMEZONE_RESOLVER = Symbol("TIMEZONE_RESOLVER");

export interface ResolvedRegion {
  readonly timezone: string;
  /** 시간대가 여러 나라에 걸치면 대표 국가다. 바다·극지처럼 나라가 없으면 null이다. */
  readonly countryCode: string | null;
}

export interface TimezoneResolverPort {
  resolve(coordinate: Coordinate): ResolvedRegion;
}
