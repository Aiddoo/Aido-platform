export const AIR_QUALITY_PROVIDER = Symbol("AIR_QUALITY_PROVIDER");

export interface AirQuality {
  readonly pm10: number | null;
  readonly pm25: number | null;
}

export interface AirQualityProvider {
  getAirQuality(lat: number, lon: number): Promise<AirQuality | null>;
}
