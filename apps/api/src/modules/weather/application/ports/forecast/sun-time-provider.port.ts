export const SUN_TIME_PROVIDER = Symbol("SUN_TIME_PROVIDER");

export interface SunTime {
  readonly sunrise: string; // "HH:mm"
  readonly sunset: string; // "HH:mm"
}

export interface SunTimeProvider {
  getSunTime(lat: number, lon: number, date: Date): Promise<SunTime | null>;
}
