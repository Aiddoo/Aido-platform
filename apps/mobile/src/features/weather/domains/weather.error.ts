import { ErrorCode } from '@aido/api/errors';
import { isApiError, NetworkError, ServerError, TimeoutError } from '@src/shared/errors';

/** 클라이언트가 판단한 날씨 오류 사유. 오류 보고의 errorCode로만 쓴다. */
export const WeatherErrorCode = {
  LOCATION_UNAVAILABLE: 'WEATHER_LOCATION_UNAVAILABLE',
} as const;

const SERVICE_UNAVAILABLE_STATUS = 503;

/** 서버에 등록한 위치가 없을 때(WEATHER_1902)는 다시 시도 대신 위치 등록을 안내한다. */
export const isLocationNotRegisteredError = (error: unknown): boolean =>
  isApiError(error) && error.hasCode(ErrorCode.WEATHER_1902);

/** 공급자 장애(WEATHER_1901)는 503이라 HTTP 클라이언트가 ServerError로 던진다. */
export const isWeatherProviderUnavailableError = (error: unknown): boolean =>
  (error instanceof ServerError && error.statusCode === SERVICE_UNAVAILABLE_STATUS) ||
  (isApiError(error) && error.hasCode(ErrorCode.WEATHER_1901));

export const isConnectionError = (error: unknown): boolean =>
  error instanceof NetworkError || error instanceof TimeoutError;
