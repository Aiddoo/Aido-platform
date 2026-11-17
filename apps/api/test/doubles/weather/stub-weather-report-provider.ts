import type { GeoCell } from "#api/modules/weather/shared/domain/geo-cell.vo";
import {
  WeatherReportProviderPort,
  type WeatherReportRequest,
} from "#api/modules/weather/weather-reports/application/ports/weather-report-provider.port";
import type { WeatherReportAttributionReadModel } from "#api/modules/weather/weather-reports/application/read-models/weather-report-attribution.read-model";
import type { WeatherReportLanguage } from "#api/modules/weather/weather-reports/domain/weather-report-language.domain-service";
import type { WeatherReport } from "#api/modules/weather/weather-reports/domain/weather-report.aggregate";
import { weatherAttributionFixture } from "#test/fixtures/weather.fixture";
import { createWeatherReportFixture } from "#test/fixtures/weather/weather-report.fixture";

export class StubWeatherReportProvider extends WeatherReportProviderPort {
  readonly calls: { cellKey: string; request: WeatherReportRequest }[] = [];
  readonly attributionLanguages: WeatherReportLanguage[] = [];
  report: WeatherReport = createWeatherReportFixture();
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

  async getAttribution(
    language: WeatherReportLanguage,
  ): Promise<WeatherReportAttributionReadModel> {
    this.attributionLanguages.push(language);
    return weatherAttributionFixture(language);
  }

  clear(): void {
    this.calls.length = 0;
    this.attributionLanguages.length = 0;
    this.report = createWeatherReportFixture();
    this.failure = null;
    this.localizationFailure = null;
  }
}
