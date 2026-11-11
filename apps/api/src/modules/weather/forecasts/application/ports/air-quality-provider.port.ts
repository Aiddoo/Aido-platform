export interface AirQuality {
  readonly pm10: number | null;
  readonly pm25: number | null;
}

export abstract class AirQualityProviderPort {
  abstract getAirQuality(lat: number, lon: number): Promise<AirQuality | null>;
}
