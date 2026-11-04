import type { WeatherReportLanguage } from "#api/modules/weather/application/models/forecast/weather-report-language";
import type { WeatherReportAttribution } from "#api/modules/weather/application/models/forecast/weather-report.model";
import type { WeatherReport } from "#api/modules/weather/application/models/forecast/weather-report.model";
import type {
  AirQuality,
  AirQualityProvider,
} from "#api/modules/weather/application/ports/forecast/air-quality-provider.port";
import type {
  LifestyleIndex,
  LifestyleIndexProvider,
} from "#api/modules/weather/application/ports/forecast/lifestyle-index-provider.port";
import type {
  SunTime,
  SunTimeProvider,
} from "#api/modules/weather/application/ports/forecast/sun-time-provider.port";
import type {
  ResolvedRegion,
  TimezoneResolverPort,
} from "#api/modules/weather/application/ports/forecast/timezone.resolver.port";
import type { WeatherGridResolverPort } from "#api/modules/weather/application/ports/forecast/weather-grid-resolver.port";
import type { WeatherLocationRepositoryPort } from "#api/modules/weather/application/ports/forecast/weather-location.repository.port";
import type {
  WeatherForecast,
  WeatherProvider,
} from "#api/modules/weather/application/ports/forecast/weather-provider.port";
import type {
  WeatherReportProviderPort,
  WeatherReportRequest,
} from "#api/modules/weather/application/ports/forecast/weather-report.provider.port";
import type { UserLocation } from "#api/modules/weather/domain/entities/forecast/user-location.entity";
import type { KmaForecastTiming } from "#api/modules/weather/domain/policies/forecast/kma-forecast-availability.policy";
import type { Coordinate } from "#api/modules/weather/domain/value-objects/forecast/coordinate.vo";
import type { GeoCell } from "#api/modules/weather/domain/value-objects/forecast/geo-cell.vo";
import { GridCoordinate } from "#api/modules/weather/domain/value-objects/forecast/grid-coordinate.vo";
import { WeatherKitUsageMeter } from "#api/modules/weather/infrastructure/adapters/forecast/weatherkit-usage.meter";
import { InMemoryUsageMeterAdapter } from "#api/platform/metering/adapters/in-memory-usage-meter.adapter";
import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";
import {
  weatherAttributionFixture,
  weatherForecastFixture,
  weatherReportFixture,
} from "#test/fixtures/weather.fixture";
import { RecordingOperationalAlert } from "#test/mocks/recording-operational-alert";

export class StubWeatherLocationRepository implements WeatherLocationRepositoryPort {
  readonly records = new Map<string, UserLocation>();
  readonly reads: string[] = [];
  readonly writes: UserLocation[] = [];
  saveFailure: Error | null = null;

  constructor(locations: readonly UserLocation[] = []) {
    for (const location of locations) {
      this.records.set(location.userId, location);
    }
  }

  async findByUserId(userId: string): Promise<UserLocation | null> {
    this.reads.push(userId);
    return this.records.get(userId) ?? null;
  }

  async upsert(location: UserLocation): Promise<UserLocation> {
    if (this.saveFailure !== null) {
      throw this.saveFailure;
    }
    this.writes.push(location);
    this.records.set(location.userId, location);
    return location;
  }
}

export class StubWeatherGridResolver implements WeatherGridResolverPort {
  readonly coordinates: Coordinate[] = [];
  readonly grids = new Map([
    ["37.5665:126.978", GridCoordinate.of(60, 127)],
    ["35.1796:129.0756", GridCoordinate.of(98, 76)],
  ]);

  resolveGrid(coordinate: Coordinate): GridCoordinate {
    this.coordinates.push(coordinate);
    const grid = this.grids.get(`${coordinate.latitude}:${coordinate.longitude}`);
    if (grid === undefined) {
      throw new Error("준비되지 않은 좌표의 격자입니다.");
    }
    return grid;
  }
}

export class StubWeatherProvider implements WeatherProvider {
  readonly name = "fixture";
  constructor(readonly timeZone = "Asia/Seoul") {}
  readonly calls: { lat: number; lon: number; date: Date; issuance: Date }[] = [];
  readonly results = new Map<string, WeatherForecast | Error>();
  failure: Error | null = null;
  forecast = weatherForecastFixture();

  async getForecast(
    lat: number,
    lon: number,
    { target: date, issuance }: KmaForecastTiming,
  ): Promise<WeatherForecast> {
    this.calls.push({ lat, lon, date: new Date(date), issuance: new Date(issuance) });
    const result = this.results.get(`${lat}:${lon}`) ?? this.failure ?? this.forecast;
    if (result instanceof Error) {
      throw result;
    }
    return weatherForecastFixture({ ...result, date: new Date(date) });
  }

  isConfigured(): boolean {
    return true;
  }
  clear(): void {
    this.calls.length = 0;
    this.results.clear();
    this.failure = null;
    this.forecast = weatherForecastFixture();
  }
}

export class StubAirQualityProvider implements AirQualityProvider {
  readonly calls: { lat: number; lon: number }[] = [];
  result: AirQuality | null = { pm10: 0, pm25: 0 };
  failure: Error | null = null;

  async getAirQuality(lat: number, lon: number): Promise<AirQuality | null> {
    this.calls.push({ lat, lon });
    if (this.failure !== null) {
      throw this.failure;
    }
    return this.result === null ? null : { ...this.result };
  }
  clear(): void {
    this.calls.length = 0;
    this.result = { pm10: 0, pm25: 0 };
    this.failure = null;
  }
}

export class StubLifestyleIndexProvider implements LifestyleIndexProvider {
  readonly calls: {
    lat: number;
    lon: number;
    date: Date;
    currentTemp: number;
    windSpeed: number;
  }[] = [];
  result: LifestyleIndex | null = null;
  failure: Error | null = null;

  async getIndex(
    lat: number,
    lon: number,
    date: Date,
    currentTemp: number,
    windSpeed: number,
  ): Promise<LifestyleIndex> {
    this.calls.push({ lat, lon, date: new Date(date), currentTemp, windSpeed });
    if (this.failure !== null) {
      throw this.failure;
    }
    return this.result === null
      ? { feelsLikeTemperature: currentTemp, uvIndex: 0 }
      : { ...this.result };
  }
  clear(): void {
    this.calls.length = 0;
    this.result = null;
    this.failure = null;
  }
}

export class StubSunTimeProvider implements SunTimeProvider {
  readonly calls: { lat: number; lon: number; date: Date }[] = [];
  readonly dates = new Map<string, SunTime | null>();
  result: SunTime | null = { sunrise: "05:23", sunset: "19:00" };
  failure: Error | null = null;

  async getSunTime(lat: number, lon: number, date: Date): Promise<SunTime | null> {
    this.calls.push({ lat, lon, date: new Date(date) });
    if (this.failure !== null) {
      throw this.failure;
    }
    const key = date.toISOString().slice(0, 10);
    const result = this.dates.has(key) ? this.dates.get(key) : this.result;
    return result == null ? null : { ...result };
  }
  clear(): void {
    this.calls.length = 0;
    this.dates.clear();
    this.result = { sunrise: "05:23", sunset: "19:00" };
    this.failure = null;
  }
}

export class StubTimezoneResolver implements TimezoneResolverPort {
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

export class StubWeatherReportProvider implements WeatherReportProviderPort {
  readonly calls: { cellKey: string; request: WeatherReportRequest }[] = [];
  readonly attributionLanguages: WeatherReportLanguage[] = [];
  report: WeatherReport = weatherReportFixture();
  failure: Error | null = null;
  localizationFailure: Error | null = null;
  hasLocalizedContent = false;

  async localizesContent(): Promise<boolean> {
    if (this.localizationFailure !== null) {
      throw this.localizationFailure;
    }
    return this.hasLocalizedContent;
  }

  async getReport(cell: GeoCell, request: WeatherReportRequest): Promise<WeatherReport> {
    this.calls.push({ cellKey: cell.key, request: { ...request } });
    if (this.failure !== null) {
      throw this.failure;
    }
    return this.report;
  }

  async getAttribution(language: WeatherReportLanguage): Promise<WeatherReportAttribution> {
    this.attributionLanguages.push(language);
    return weatherAttributionFixture(language);
  }

  clear(): void {
    this.calls.length = 0;
    this.attributionLanguages.length = 0;
    this.report = weatherReportFixture();
    this.failure = null;
    this.localizationFailure = null;
  }
}

/** 서명 대신 순서대로 토큰을 내주고 무효화 횟수를 기록한다. */
export class StubWeatherKitTokenResolver {
  readonly issued: string[] = [];
  invalidations = 0;
  failure: Error | null = null;

  async resolve(): Promise<string> {
    if (this.failure !== null) {
      throw this.failure;
    }
    const token = `synthetic.jwt.token-${this.invalidations + 1}`;
    this.issued.push(token);
    return token;
  }

  invalidate(): void {
    this.invalidations += 1;
  }
}

export class StubWeatherKitAttributionResolver {
  readonly languages: string[] = [];

  async resolve(language: string): Promise<WeatherReportAttribution> {
    this.languages.push(language);
    return weatherAttributionFixture(language);
  }
}

/**
 * 날씨 공급자 어댑터가 쓰는 공용 회로·계량을 메모리로 만든다. 테스트마다 새로 만들어 회로를 나누지 않는다.
 */
export function createWeatherOutbound() {
  const alert = new RecordingOperationalAlert();
  const meter = new InMemoryUsageMeterAdapter();
  return {
    alert,
    meter,
    policies: new OutboundPolicyRegistry(alert),
    usage: new WeatherKitUsageMeter(meter, alert),
  };
}
