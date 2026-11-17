export interface LifestyleIndex {
  readonly feelsLikeTemperature: number;
  readonly uvIndex: number | null;
}

export interface LifestyleIndexQuery {
  readonly lat: number;
  readonly lon: number;
  readonly at: Temporal.Instant;
  readonly currentTemp: number;
  readonly windSpeed: number;
}

export abstract class LifestyleIndexProviderPort {
  abstract getIndex(query: LifestyleIndexQuery): Promise<LifestyleIndex>;
}
