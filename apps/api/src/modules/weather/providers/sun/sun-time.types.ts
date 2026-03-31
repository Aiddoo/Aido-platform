export const SUN_TIME_PROVIDER = Symbol("SUN_TIME_PROVIDER");

export interface SunTime {
	sunrise: string; // "HH:mm"
	sunset: string; // "HH:mm"
}

export interface SunTimeProvider {
	getSunTime(lat: number, lon: number, date: Date): Promise<SunTime | null>;
}
