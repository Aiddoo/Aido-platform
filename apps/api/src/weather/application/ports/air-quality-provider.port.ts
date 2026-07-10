export const AIR_QUALITY_PROVIDER = Symbol("AIR_QUALITY_PROVIDER");

export interface AirQuality {
	pm10: number | null;
	pm25: number | null;
}

export interface AirQualityProvider {
	getAirQuality(lat: number, lon: number): Promise<AirQuality | null>;
}
