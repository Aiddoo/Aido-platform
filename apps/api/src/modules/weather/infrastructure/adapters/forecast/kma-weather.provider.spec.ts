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
    [
      "공급자 실패 코드",
      () =>
        new Response(
          JSON.stringify({ response: { header: { resultCode: "03", resultMsg: "NO_DATA" } } }),
        ),
    ],
    ["잘못된 응답 구조", () => new Response(JSON.stringify({ response: {} }))],
  ])("%s는 기존 WEATHER_1901 오류이며 retry하지 않는다", async (_description, response) => {
    // Given
    fetchSpy.mockResolvedValue(response());
    // When / Then
    await expect(
      provider.getForecast(37.5665, 126.978, new Date("2026-07-23T00:00:00Z")),
    ).rejects.toMatchObject({ errorCode: ErrorCode.WEATHER_1901 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
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
    const errorLog = vi.spyOn(Logger.prototype, "error").mockImplementation(() => {});
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({ response: { header: { resultCode: "03", resultMsg: secret } } }),
      ),
    );

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
        },
      ],
    ]);
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(secret);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
