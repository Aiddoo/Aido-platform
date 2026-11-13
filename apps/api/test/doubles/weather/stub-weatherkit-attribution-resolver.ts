import type { WeatherReportAttribution } from "#api/modules/weather/forecasts/application/read-models/weather-report-attribution.read-model";
import { weatherAttributionFixture } from "#test/fixtures/weather.fixture";

export class StubWeatherKitAttributionResolver {
  readonly languages: string[] = [];

  async resolve(language: string): Promise<WeatherReportAttribution> {
    this.languages.push(language);
    return weatherAttributionFixture(language);
  }
}
