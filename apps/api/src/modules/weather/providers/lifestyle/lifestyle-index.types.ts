export const LIFESTYLE_INDEX_PROVIDER = Symbol("LIFESTYLE_INDEX_PROVIDER");

export interface LifestyleIndex {
	feelsLikeTemperature: number;
	uvIndex: number;
}

export interface LifestyleIndexProvider {
	getIndex(
		lat: number,
		lon: number,
		date: Date,
		currentTemp: number,
		windSpeed: number,
	): Promise<LifestyleIndex | null>;
}
