import {
  WeatherReportProviderPort,
  type WeatherReportRequest,
} from "#api/modules/weather/forecasts/application/ports/weather-report-provider.port";
import type { WeatherReportLanguage } from "#api/modules/weather/forecasts/domain/weather-report-language.domain-service";
import type {
  WeatherReport,
  WeatherReportAttribution,
} from "#api/modules/weather/forecasts/domain/weather-report.vo";
import type { GeoCell } from "#api/modules/weather/shared/domain/geo-cell.vo";
import { weatherAttributionFixture, weatherReportFixture } from "#test/fixtures/weather.fixture";

export class StubWeatherReportProvider extends WeatherReportProviderPort {
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
