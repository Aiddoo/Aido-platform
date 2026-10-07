export const LIFESTYLE_INDEX_PROVIDER = Symbol("LIFESTYLE_INDEX_PROVIDER");

export interface LifestyleIndex {
  readonly feelsLikeTemperature: number;
  readonly uvIndex: number | null;
}

export interface LifestyleIndexProvider {
  getIndex(
    lat: number,
    lon: number,
    date: Date,
    currentTemp: number,
    windSpeed: number,
  ): Promise<LifestyleIndex>;
}
