import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";

/** 공급자 장애이고 돌려줄 이전 데이터도 없다. details는 공급자 상태 요약이며 본문·키를 담지 않는다. */
export function weatherServiceUnavailable(details?: unknown): ApplicationException {
  return new ApplicationException(ErrorCode.WEATHER_1901, details);
}

/** KMA가 줄 수 없는 날짜다. 공급자를 부르지 않고 거절한다. */
export function forecastDateUnsupported(): ApplicationException {
  return new ApplicationException(ErrorCode.SYS_0002, { field: "date" });
}
