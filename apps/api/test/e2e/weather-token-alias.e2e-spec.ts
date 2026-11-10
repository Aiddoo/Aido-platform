import {
  WEATHER_FORECAST_READER,
  WeatherForecastReaderPort,
} from "#api/modules/weather/forecasts/weather-forecasts.public";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

describe("날씨 옛 Symbol 토큰 별칭 (e2e)", () => {
  let ctx: E2eTestContext;

  beforeAll(async () => {
    ctx = await createE2eApp();
  }, 60_000);

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  it("예보 reader의 옛 토큰과 클래스 토큰은 같은 인스턴스다", () => {
    // Given
    const app = ctx.module;

    // When
    const legacy = app.get(WEATHER_FORECAST_READER, { strict: false });
    const current = app.get(WeatherForecastReaderPort, { strict: false });

    // Then
    expect(legacy).toBe(current);
  });
});
