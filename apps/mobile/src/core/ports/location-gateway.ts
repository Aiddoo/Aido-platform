import { AppError } from '@src/core/errors/app-error';

import type { OsPermission } from './os-permission';

export class LocationUnavailableError extends AppError {
  override readonly name = 'LocationUnavailableError';
}

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

/** 큰 제목은 도시, 작은 위치 줄은 동네를 쓴다. */
export interface PlaceName {
  city: string;
  district: string | null;
}

export interface LocationGateway {
  getPermission(): Promise<OsPermission>;
  requestPermission(): Promise<OsPermission>;
  /** 이미 허용한 사용자의 권한을 앱을 켠 직후에 다시 확인한다. 처음 묻는 요청은 `requestPermission`이다. */
  recheckPermission(): Promise<OsPermission>;
  getCoordinates(signal: AbortSignal): Promise<LocationCoordinates>;
  getPlace(
    coordinates: LocationCoordinates,
    signal: AbortSignal,
  ): Promise<{ countryCode: string | null; name: PlaceName | null }>;
}
