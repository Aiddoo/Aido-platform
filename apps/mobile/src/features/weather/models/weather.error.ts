import type { BusinessError } from '@src/shared/errors';

export const WeatherErrorCode = {
  LOCATION_NOT_REGISTERED: 'WEATHER_LOCATION_NOT_REGISTERED',
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
  locationNotRegistered: () =>
    new WeatherError(WeatherErrorCode.LOCATION_NOT_REGISTERED, '위치 정보가 등록되지 않았습니다'),
} as const;

export const isWeatherError = (error: unknown): error is WeatherError =>
  error instanceof WeatherError;
