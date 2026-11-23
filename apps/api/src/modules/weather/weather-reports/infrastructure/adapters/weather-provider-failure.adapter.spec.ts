import { ErrorCode } from "@aido/api/errors";
import { HttpClient } from "@nestjs/http-client";

import { FakeTimerClock } from "#test/doubles/platform/fake-timer-clock";
import { NoCacheStore } from "#test/doubles/platform/no-cache-store";
import { createWeatherOutbound } from "#test/doubles/weather/weather-outbound";
import { createForecastTimingFixture } from "#test/fixtures/weather/weather.fixture";
import { suppressLogger } from "#test/setup/suppress-logger";

import { Coordinate } from "../../../shared/domain/coordinate.vo.js";
import { GeoCell } from "../../../shared/domain/geo-cell.vo.js";
import { GridCoordinate } from "../../../shared/domain/grid-coordinate.vo.js";
import { AirkoreaAirQualityAdapter } from "./airkorea-air-quality.adapter.js";
import { KasiSunTimeAdapter } from "./kasi-sun-time.adapter.js";
import { KmaLifestyleIndexAdapter } from "./kma-lifestyle-index.adapter.js";
import { KmaWeatherForecastAdapter } from "./kma-weather-forecast.adapter.js";

const CONFIG = { kmaApiKey: "test-api-key", weatherKit: null } as const;
const TIMEOUT_MS = 20;

type StubFetch = (signal: AbortSignal | null | undefined) => Response | Promise<Response>;

const rateLimited: StubFetch = () => new Response(null, { status: 429 });
const serverError: StubFetch = () => new Response("<html>Bad Gateway</html>", { status: 502 });
const unexpectedShape: StubFetch = () =>
  new Response(JSON.stringify({ response: "not-an-object" }), {
    headers: { "content-type": "application/json" },
  });
const neverResponds: StubFetch = (signal) =>
  new Promise<Response>((_resolve, reject) => {
    signal?.addEventListener("abort", () => reject(signal.reason));
  });

function createHttp(respond: StubFetch): HttpClient {
  return new HttpClient({
    retry: false,
    throwOnHttpError: false,
    timeout: TIMEOUT_MS,
    fetch: async (_input, init) => respond(init?.signal),
  });
}

function createPolicies() {
  return createWeatherOutbound(new FakeTimerClock()).policies;
}

const FAILURES = [
  ["429", rateLimited],
  ["5xx", serverError],
  ["응답 구조 불일치", unexpectedShape],
  ["시간 초과", neverResponds],
] as const;

describe("날씨 공급자 어댑터 — 실패 응답 처리", () => {
  beforeEach(() => {
    suppressLogger();
  });

  describe.each(FAILURES)("%s", (_name, respond) => {
    it("에어코리아는 측정값 없음(null)과 구분해 예외로 알린다", async () => {
      // Given
      const adapter = new AirkoreaAirQualityAdapter(
        CONFIG,
        createHttp(respond),
        createPolicies(),
        new NoCacheStore(),
      );

      // When
      const result = adapter.findAirQuality(GeoCell.create(Coordinate.create(37.5665, 126.978)));

      // Then
      await expect(result).rejects.toThrow();
    });

    it("천문연구원은 null 일출입으로 degrade한다", async () => {
      // Given
      const adapter = new KasiSunTimeAdapter(CONFIG, createHttp(respond), createPolicies());

      // When
      const result = await adapter.findSunTime(
        37.5665,
        126.978,
        Temporal.Instant.from("2026-07-23T00:00:00Z"),
      );

      // Then
      expect(result).toBeNull();
    });

    it("기상청 생활지수는 체감온도만 주고 자외선은 null이다", async () => {
      // Given
      const adapter = new KmaLifestyleIndexAdapter(CONFIG, createHttp(respond), createPolicies());

      // When
      const result = await adapter.getIndex({
        lat: 37.5665,
        lon: 126.978,
        at: Temporal.Instant.from("2026-07-23T00:00:00Z"),
        currentTemp: 20,
        windSpeed: 2,
      });

      // Then
      expect(result.uvIndex).toBeNull();
      expect(result.feelsLikeTemperature).toBe(20);
    });

    it("기상청 예보는 던져서 예보 reader가 latest 폴백으로 넘기게 한다", async () => {
      // Given
      const adapter = new KmaWeatherForecastAdapter(CONFIG, createHttp(respond), createPolicies());

      // When
      const outcome = adapter.getForecast(
        GridCoordinate.create(60, 127),
        createForecastTimingFixture(Temporal.Instant.from("2026-07-23T00:00:00Z")),
      );

      // Then
      await expect(outcome).rejects.toBeInstanceOf(Error);
    });
  });

  it("HTTP 오류와 응답 구조 불일치는 기존 WEATHER_1901 계약으로 던진다", async () => {
    // Given
    const adapter = new KmaWeatherForecastAdapter(
      CONFIG,
      createHttp(unexpectedShape),
      createPolicies(),
    );

    // When
    const outcome = adapter.getForecast(
      GridCoordinate.create(60, 127),
      createForecastTimingFixture(Temporal.Instant.from("2026-07-23T00:00:00Z")),
    );

    // Then
    await expect(outcome).rejects.toMatchObject({ errorCode: ErrorCode.WEATHER_1901 });
  });
});
