export interface LifestyleIndex {
  readonly feelsLikeTemperature: number;
  readonly uvIndex: number | null;
}

export abstract class LifestyleIndexProviderPort {
  abstract getIndex(
    lat: number,
    lon: number,
    at: Temporal.Instant,
    currentTemp: number,
    windSpeed: number,
  ): Promise<LifestyleIndex>;
}
