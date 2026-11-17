import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";

/** 위치를 등록하지 않았다. 한국 밖 위치로 v1 예보를 부를 때(격자 없음)와 같은 코드다. */
export function userLocationNotFound(): ApplicationException {
  return new ApplicationException(ErrorCode.WEATHER_1902);
}
