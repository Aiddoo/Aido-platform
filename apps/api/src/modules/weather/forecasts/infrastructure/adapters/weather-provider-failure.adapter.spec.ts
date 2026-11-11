import { ErrorCode } from "@aido/api/errors";
import { HttpClient } from "@nestjs/http-client";

import { FakeTimerClock } from "#test/doubles/platform/fake-timer-clock";
import { createWeatherOutbound } from "#test/doubles/weather/weather-outbound";
import { kmaTimingFixture } from "#test/fixtures/weather.fixture";
import { suppressLogger } from "#test/setup/suppress-logger";

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
    it("에어코리아는 null 대기질로 degrade한다", async () => {
      // Given
      const adapter = new AirkoreaAirQualityAdapter(CONFIG, createHttp(respond), createPolicies());

      // When
      const result = await adapter.getAirQuality(37.5665, 126.978);

      // Then
      expect(result).toBeNull();
    });

    it("천문연구원은 null 일출입으로 degrade한다", async () => {
      // Given
      const adapter = new KasiSunTimeAdapter(CONFIG, createHttp(respond), createPolicies());

      // When
      const result = await adapter.getSunTime(37.5665, 126.978, new Date("2026-07-23T00:00:00Z"));

      // Then
      expect(result).toBeNull();
    });

    it("기상청 생활지수는 체감온도만 주고 자외선은 null이다", async () => {
      // Given
      const adapter = new KmaLifestyleIndexAdapter(CONFIG, createHttp(respond), createPolicies());

      // When
      const result = await adapter.getIndex(
        37.5665,
        126.978,
        new Date("2026-07-23T00:00:00Z"),
        20,
        2,
      );

      // Then
      expect(result.uvIndex).toBeNull();
      expect(result.feelsLikeTemperature).toBe(20);
    });

    it("기상청 예보는 던져서 예보 reader가 latest 폴백으로 넘기게 한다", async () => {
      // Given
      const adapter = new KmaWeatherForecastAdapter(CONFIG, createHttp(respond), createPolicies());

      // When
      const outcome = adapter.getForecast(
        37.5665,
        126.978,
        kmaTimingFixture(new Date("2026-07-23T00:00:00Z")),
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
      37.5665,
      126.978,
      kmaTimingFixture(new Date("2026-07-23T00:00:00Z")),
    );

    // Then
    await expect(outcome).rejects.toMatchObject({ errorCode: ErrorCode.WEATHER_1901 });
  });
});
