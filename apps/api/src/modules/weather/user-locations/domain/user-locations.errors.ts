import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

/** v1 예보 경로는 격자 없는 해외 위치를 "위치 없음"과 같은 WEATHER_1902로 다룬다 */
export function forecastGridUnavailable(): DomainException {
  return new DomainException(ErrorCode.WEATHER_1902);
}
