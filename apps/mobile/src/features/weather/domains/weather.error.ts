import { ErrorCode } from '@aido/api/errors';
import { isApiError, type BusinessError } from '@src/shared/errors';
import { t } from '@src/shared/i18n';

export const WeatherErrorCode = {
  LOCATION_UNAVAILABLE: 'WEATHER_LOCATION_UNAVAILABLE',
} as const;

export type WeatherErrorCode = (typeof WeatherErrorCode)[keyof typeof WeatherErrorCode];

export class WeatherError extends Error implements BusinessError {
  override readonly name = 'WeatherError';

  constructor(
    public readonly code: WeatherErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export const WeatherErrors = {
  locationUnavailable: () =>
    new WeatherError(
      WeatherErrorCode.LOCATION_UNAVAILABLE,
      t('weather:errors.locationUnavailable'),
    ),
} as const;

export const isWeatherError = (error: unknown): error is WeatherError =>
  error instanceof WeatherError;

/** 서버에 등록한 위치가 없을 때(WEATHER_1902)는 다시 시도 대신 위치 등록을 안내한다. */
export const isLocationNotRegisteredError = (error: unknown): boolean =>
  isApiError(error) && error.hasCode(ErrorCode.WEATHER_1902);
