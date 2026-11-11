import type { Coordinate } from "../../../shared/domain/coordinate.vo.js";

export interface ResolvedRegion {
  readonly timezone: string;
  /** 시간대가 여러 나라에 걸치면 대표 국가다. 바다·극지처럼 나라가 없으면 null이다. */
  readonly countryCode: string | null;
}

/** 좌표가 속한 IANA 시간대와 국가를 계산하는 경계. 칸 중심 좌표로 부르면 칸 단위 값이 된다. */
export abstract class TimezoneResolverPort {
  abstract resolve(coordinate: Coordinate): ResolvedRegion;
}
