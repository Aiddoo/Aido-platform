import { Injectable } from "@nestjs/common";
import tzLookup from "@photostructure/tz-lookup";
import { getCountryForTimezone } from "countries-and-timezones";

import type { Coordinate } from "../../../shared/domain/coordinate.vo.js";
import type {
  ResolvedRegion,
  TimezoneResolverPort,
} from "../../application/ports/timezone-resolver.port.js";

/**
 * 좌표 → IANA 시간대는 내장 경계 데이터로 계산한다(네트워크 없음). 국가는 시간대의 대표 국가라
 * 여러 나라가 한 시간대를 쓰는 지역(예: Asia/Bangkok의 베트남)에서는 실제 국가와 다를 수 있다.
 */
@Injectable()
export class TzLookupTimezoneResolverAdapter implements TimezoneResolverPort {
  resolve(coordinate: Coordinate): ResolvedRegion {
    const timezone = tzLookup(coordinate.latitude, coordinate.longitude);
    return { timezone, countryCode: getCountryForTimezone(timezone)?.id ?? null };
  }
}
