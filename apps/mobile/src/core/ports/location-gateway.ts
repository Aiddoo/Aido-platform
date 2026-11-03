export class LocationUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LocationUnavailableError';
  }
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
  getPermission(): Promise<{ granted: boolean; canAskAgain: boolean }>;
  requestPermission(): Promise<{ granted: boolean; canAskAgain: boolean }>;
  getCoordinates(signal: AbortSignal): Promise<LocationCoordinates>;
  getPlace(
    coordinates: LocationCoordinates,
    signal: AbortSignal,
  ): Promise<{ countryCode: string | null; name: PlaceName | null }>;
}
