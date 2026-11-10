import { WeatherForecastProviderPort } from "#api/modules/weather/forecasts/application/ports/weather-forecast-provider.port";
import type { WeatherForecast } from "#api/modules/weather/forecasts/application/read-models/weather-forecast.read-model";
import type { KmaForecastTiming } from "#api/modules/weather/forecasts/domain/kma-forecast-availability.domain-service";
import { weatherForecastFixture } from "#test/fixtures/weather.fixture";

export interface RecordedForecastCall {
  readonly lat: number;
  readonly lon: number;
  readonly date: Date;
  readonly issuance: Date;
}

/** 기본 예보를 돌려주고 호출을 기록한다. 좌표별 결과나 실패를 미리 정할 수 있다. */
export class StubWeatherForecastProvider extends WeatherForecastProviderPort {
  readonly name = "fixture";
  readonly timeZone: string;
  readonly calls: RecordedForecastCall[] = [];
  readonly results = new Map<string, WeatherForecast | Error>();
  failure: Error | null = null;
  forecast = weatherForecastFixture();

  constructor(timeZone = "Asia/Seoul") {
    super();
    this.timeZone = timeZone;
  }

  async getForecast(
    lat: number,
    lon: number,
    { target, issuance }: KmaForecastTiming,
  ): Promise<WeatherForecast> {
    this.calls.push({ lat, lon, date: new Date(target), issuance: new Date(issuance) });
    const result = this.results.get(`${lat}:${lon}`) ?? this.failure ?? this.forecast;
    if (result instanceof Error) {
      throw result;
    }
    return weatherForecastFixture({ ...result, date: new Date(target) });
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
