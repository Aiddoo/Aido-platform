import { ErrorCode } from "@aido/api/errors";
import { Logger } from "@nestjs/common";
import { HttpClient } from "@nestjs/http-client";
import type { MockInstance } from "vitest";

import { FakeTimerClock } from "#test/doubles/platform/fake-timer-clock";
import { createWeatherOutbound } from "#test/doubles/weather/weather-outbound";
import { forecastTimingFixture } from "#test/fixtures/weather.fixture";

import { GridCoordinate } from "../../../shared/domain/grid-coordinate.vo.js";
import { KmaWeatherForecastAdapter } from "./kma-weather-forecast.adapter.js";
import { WeatherProviderLogEvent } from "./weather-provider.log-events.js";

const SEOUL_GRID = GridCoordinate.create(60, 127);
const TARGET = Temporal.Instant.from("2026-07-23T00:00:00Z");

describe("KMA 예보 HTTP 요청·오류 계약", () => {
  let provider: KmaWeatherForecastAdapter;
  const config: { kmaApiKey: string | undefined; weatherKit: null } = {
    kmaApiKey: "test-api-key",
    weatherKit: null,
  };
  let fetchSpy: MockInstance<typeof globalThis.fetch>;

  beforeEach(() => {
    config.kmaApiKey = "test-api-key";
    provider = new KmaWeatherForecastAdapter(
      config,
      new HttpClient({ retry: false, throwOnHttpError: false }),
      createWeatherOutbound(new FakeTimerClock()).policies,
    );
    config.kmaApiKey = "test-api-key";
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  it("실제 HTTP client가 KST 발표 시각·격자를 보내고 대상 순간을 그대로 싣는다", async () => {
    // Given
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          response: {
            header: { resultCode: "00", resultMsg: "NORMAL_SERVICE" },
            body: {
              items: {
                item: [
                  { category: "TMP", fcstDate: "20260723", fcstTime: "0900", fcstValue: "25" },
                ],
              },
            },
          },
        }),
      ),
    );
    // When
    const result = await provider.getForecast(SEOUL_GRID, forecastTimingFixture(TARGET));
    // Then
    const url = new URL(String(fetchSpy.mock.calls[0]?.[0]));
    expect(url.pathname).toBe("/1360000/VilageFcstInfoService_2.0/getVilageFcst");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      serviceKey: "test-api-key",
      base_date: "20260723",
      base_time: "0800",
      nx: "60",
      ny: "127",
      pageNo: "1",
      numOfRows: "1000",
      dataType: "JSON",
    });
    expect(result.date).toBe(TARGET);
    expect(result.hourlyForecasts[0]?.temperature).toBe(25);
    expect(provider.timeZone).toBe("Asia/Seoul");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["HTTP 실패", () => new Response(null, { status: 503 })],
    ["잘못된 응답 구조", () => new Response(JSON.stringify({ response: {} }))],
    [
      "검증을 통과하지 못하는 item 형식",
      () =>
        new Response(
          JSON.stringify({
            response: {
              header: { resultCode: "00" },
              body: { items: { item: [{ category: 1 }] } },
            },
          }),
        ),
    ],
    ["JSON이 아닌 HTTP 실패 본문", () => new Response("<html>Bad Gateway</html>", { status: 502 })],
  ])("%s는 기존 WEATHER_1901 오류이며 retry하지 않는다", async (_description, response) => {
    // Given
    fetchSpy.mockResolvedValue(response());
    // When
    const result = provider.getForecast(SEOUL_GRID, forecastTimingFixture(TARGET));
    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.WEATHER_1901 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("현재 발표가 실패 코드이면 직전 발표로 한 번 재요청하고 대상일 예보를 반환한다", async () => {
    // Given
    const warnLog = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    const errorLog = vi.spyOn(Logger.prototype, "error").mockImplementation(() => {});
    fetchSpy.mockResolvedValueOnce(providerResultResponse("03")).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          response: {
            header: { resultCode: "00", resultMsg: "NORMAL_SERVICE" },
            body: {
              items: {
                item: [
                  { category: "TMP", fcstDate: "20260723", fcstTime: "0900", fcstValue: "24" },
                ],
              },
            },
          },
        }),
      ),
    );
    // When
    const result = await provider.getForecast(SEOUL_GRID, forecastTimingFixture(TARGET));
    // Then
    const [current, previous] = fetchSpy.mock.calls.map(
      ([url]) => new URL(String(url)).searchParams,
    );
    expect([current?.get("base_date"), current?.get("base_time")]).toEqual(["20260723", "0800"]);
    expect([previous?.get("base_date"), previous?.get("base_time")]).toEqual(["20260723", "0500"]);
    expect(result.hourlyForecasts[0]?.temperature).toBe(24);
    expect(warnLog.mock.calls).toEqual([
      [
        {
          event: WeatherProviderLogEvent.PREVIOUS_BASE_RETRIED,
          provider: "kma",
          operation: "forecast",
          resultCode: "03",
        },
      ],
    ]);
    expect(errorLog).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("직전 발표도 실패 코드이면 더 재요청하지 않고 마지막 실패 코드로 WEATHER_1901을 던진다", async () => {
    // Given
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    const errorLog = vi.spyOn(Logger.prototype, "error").mockImplementation(() => {});
    fetchSpy
      .mockResolvedValueOnce(providerResultResponse("03"))
      .mockResolvedValueOnce(providerResultResponse("99"));
    // When
    const result = provider.getForecast(SEOUL_GRID, forecastTimingFixture(TARGET));
    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.WEATHER_1901,
      details: { code: "99", message: "UNKNOWN_ERROR" },
    });
    expect(errorLog.mock.calls).toEqual([
      [
        {
          event: WeatherProviderLogEvent.RESPONSE_UNAVAILABLE,
          provider: "kma",
          operation: "forecast",
          errorType: "provider_result",
          resultCode: "99",
        },
      ],
    ]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("공급자 응답 원문은 로그에 노출하지 않고 기존 1901 details 계약을 유지한다", async () => {
    // Given
    const secret = "PRIVATE_KEY=secret&latitude=37.5665&longitude=126.978 BODY_SECRET";
    const warnLog = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    const errorLog = vi.spyOn(Logger.prototype, "error").mockImplementation(() => {});
    fetchSpy.mockImplementation(async () => providerResultResponse("03", secret));

    // When
    const result = provider.getForecast(SEOUL_GRID, forecastTimingFixture(TARGET));
    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.WEATHER_1901,
      details: { code: "03", message: secret },
    });
    expect(errorLog.mock.calls).toEqual([
      [
        {
          event: WeatherProviderLogEvent.RESPONSE_UNAVAILABLE,
          provider: "kma",
          operation: "forecast",
          errorType: "provider_result",
          resultCode: "03",
        },
      ],
    ]);
    expect(JSON.stringify([warnLog.mock.calls, errorLog.mock.calls])).not.toContain(secret);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

function providerResultResponse(resultCode: string, resultMsg = "UNKNOWN_ERROR"): Response {
  return new Response(JSON.stringify({ response: { header: { resultCode, resultMsg } } }));
}
