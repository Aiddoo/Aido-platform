import type { WeatherReportAttributionReadModel } from "#api/modules/weather/weather-reports/application/read-models/weather-report-attribution.read-model";
import { weatherAttributionFixture } from "#test/fixtures/weather.fixture";

export class StubWeatherKitAttributionResolver {
  readonly languages: string[] = [];

  async resolve(language: string): Promise<WeatherReportAttributionReadModel> {
    this.languages.push(language);
    return weatherAttributionFixture(language);
  }
}
