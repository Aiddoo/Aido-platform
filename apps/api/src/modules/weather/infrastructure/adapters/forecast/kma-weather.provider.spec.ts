import { ErrorCode } from "@aido/api/errors";
import { Logger } from "@nestjs/common";
import { HttpClient, getHttpClientToken } from "@nestjs/http-client";
import { TestBed } from "@suites/unit";
import type { Mocked, MockInstance } from "vitest";

import { TypedConfigService } from "#api/platform/config/services/config.service";

import { WeatherProviderLogEvent } from "../../observability/forecast/weather-provider-log.events.js";
import { KmaWeatherProvider } from "./kma-weather.provider.js";

describe("KMA 예보 HTTP 요청·오류 계약", () => {
  let provider: KmaWeatherProvider;
  let config: Mocked<TypedConfigService>;
  let fetchSpy: MockInstance<typeof globalThis.fetch>;

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(KmaWeatherProvider)
      .mock(getHttpClientToken("weather"))
      .final(new HttpClient({ retry: false, throwOnHttpError: false }))
      .compile();
    provider = unit;
    config = unitRef.get(TypedConfigService);
    Object.defineProperty(config, "dataGoKrApiKey", {
      get: () => "test-api-key",
      configurable: true,
    });
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  it("실제 HTTP client가 KST 발표 시각·격자를 보내고 반환 Date를 유지한다", async () => {
    // Given
    const date = new Date("2026-07-23T00:00:00Z");
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
    const result = await provider.getForecast(37.5665, 126.978, date);
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
    expect(result.date).toBe(date);
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
    // When / Then
    await expect(
      provider.getForecast(37.5665, 126.978, new Date("2026-07-23T00:00:00Z")),
    ).rejects.toMatchObject({ errorCode: ErrorCode.WEATHER_1901 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("현재 발표가 실패 코드이면 직전 발표로 한 번 재요청하고 대상일 예보를 반환한다", async () => {
    // Given
    const date = new Date("2026-07-23T00:00:00Z");
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
    const result = await provider.getForecast(37.5665, 126.978, date);
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
    // When / Then
    await expect(
      provider.getForecast(37.5665, 126.978, new Date("2026-07-23T00:00:00Z")),
    ).rejects.toMatchObject({
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

  it("credential 미설정은 isConfigured false이며 한국 지역 미지원 판정이 아니다", () => {
    // Given
    Object.defineProperty(config, "dataGoKrApiKey", { get: () => undefined });
    // When / Then
    expect(provider.isConfigured()).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("공급자 응답 원문은 로그에 노출하지 않고 기존 1901 details 계약을 유지한다", async () => {
    // Given
    const secret = "PRIVATE_KEY=secret&latitude=37.5665&longitude=126.978 BODY_SECRET";
    const warnLog = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    const errorLog = vi.spyOn(Logger.prototype, "error").mockImplementation(() => {});
    fetchSpy.mockImplementation(async () => providerResultResponse("03", secret));

    // When / Then
    await expect(
      provider.getForecast(37.5665, 126.978, new Date("2026-07-23T00:00:00Z")),
    ).rejects.toMatchObject({
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
