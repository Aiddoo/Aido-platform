import type { WeatherReportAttributionReadModel } from "#api/modules/weather/weather-reports/application/read-models/weather-report-attribution.read-model";
import { createWeatherAttributionFixture } from "#test/fixtures/weather/weather.fixture";

export class StubWeatherKitAttributionResolver {
  readonly languages: string[] = [];

  async resolve(language: string): Promise<WeatherReportAttributionReadModel> {
    this.languages.push(language);
    return createWeatherAttributionFixture(language);
  }
}
