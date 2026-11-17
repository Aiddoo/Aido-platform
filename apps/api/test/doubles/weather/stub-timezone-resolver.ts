import type { Coordinate } from "#api/modules/weather/shared/domain/coordinate.vo";
import {
  type ResolvedRegion,
  TimezoneResolverPort,
} from "#api/modules/weather/user-locations/application/ports/timezone-resolver.port";

export class StubTimezoneResolver extends TimezoneResolverPort {
  readonly coordinates: Coordinate[] = [];
  region: ResolvedRegion = { timezone: "Asia/Seoul", countryCode: "KR" };

  resolve(coordinate: Coordinate): ResolvedRegion {
    this.coordinates.push(coordinate);
    return { ...this.region };
  }

  clear(): void {
    this.coordinates.length = 0;
    this.region = { timezone: "Asia/Seoul", countryCode: "KR" };
  }
}
