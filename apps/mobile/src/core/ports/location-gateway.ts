export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export interface LocationGateway {
  getPermission(): Promise<{ granted: boolean; canAskAgain: boolean }>;
  requestPermission(): Promise<{ granted: boolean; canAskAgain: boolean }>;
  getCoordinates(signal: AbortSignal): Promise<LocationCoordinates>;
  getPlace(
    coordinates: LocationCoordinates,
    signal: AbortSignal,
  ): Promise<{ countryCode: string | null; name: string | null }>;
}
