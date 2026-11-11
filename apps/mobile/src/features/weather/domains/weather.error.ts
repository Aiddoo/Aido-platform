import { ErrorCode } from '@aido/api/errors';
import { isApiError, NetworkError, ServerError, TimeoutError } from '@src/shared/errors';

/** 클라이언트가 판단한 날씨 오류 사유. 오류 보고의 errorCode로만 쓴다. */
export const WEATHER_ERROR_CODE = {
  LOCATION_UNAVAILABLE: 'WEATHER_LOCATION_UNAVAILABLE',
} as const;

// oxlint-disable-next-line aido/http-status-literal -- 1.15.2 전환 #1400
const SERVICE_UNAVAILABLE_STATUS = 503;

/** 서버에 등록한 위치가 없을 때(WEATHER_1902)는 다시 시도 대신 위치 등록을 안내한다. */
export function isLocationNotRegisteredError(error: unknown): boolean {
  return isApiError(error) && error.hasCode(ErrorCode.WEATHER_1902);
}

/** 공급자 장애(WEATHER_1901)는 503이라 HTTP 클라이언트가 ServerError로 던진다. */
export function isWeatherProviderUnavailableError(error: unknown): boolean {
  return (
    (error instanceof ServerError && error.statusCode === SERVICE_UNAVAILABLE_STATUS) ||
    (isApiError(error) && error.hasCode(ErrorCode.WEATHER_1901))
  );
}

/** 연결이 정말 끊긴 경우만이다. 응답이 늦은 시간 초과는 연결 문제로 안내하지 않는다. */
export function isOfflineError(error: unknown): boolean {
  return error instanceof NetworkError;
}

export function isTimeoutError(error: unknown): boolean {
  return error instanceof TimeoutError;
}
