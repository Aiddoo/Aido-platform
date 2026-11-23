export interface SunTime {
  readonly sunrise: string; // "HH:mm"
  readonly sunset: string; // "HH:mm"
}

export abstract class SunTimeProviderPort {
  abstract findSunTime(lat: number, lon: number, at: Temporal.Instant): Promise<SunTime | null>;
}
