import { ErrorCode } from '@aido/api/errors';
import { isApiError, NetworkError, ServerError, TimeoutError } from '@src/shared/errors';

export const WEATHER_ERROR_CODE = {
  LOCATION_UNAVAILABLE: 'WEATHER_LOCATION_UNAVAILABLE',
} as const;

const SERVICE_UNAVAILABLE_STATUS = 503;

/** 서버에 등록한 위치가 없을 때(WEATHER_1902)는 다시 시도 대신 위치 등록을 안내한다. */
export function isLocationNotRegisteredError(error: unknown): boolean {
  return isApiError(error) && error.hasCode(ErrorCode.WEATHER_1902);
}

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
