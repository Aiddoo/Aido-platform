import { HttpClient } from "@nestjs/http-client";
import type { MockInstance } from "vitest";
/**
 * KmaLifestyleIndexAdapter 단위 테스트
 *
 * @description
 * UV 지수 API 호출 및 체감온도 계산 검증.
 * fetch를 전역 spy로 Mock.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/server test kma-lifestyle-index.provider.spec
 * ```
 */
import { vi } from "vitest";

import { FakeTimerClock } from "#test/doubles/platform/fake-timer-clock";
import { createWeatherOutbound } from "#test/doubles/weather/weather-outbound";

import { KmaLifestyleIndexAdapter } from "./kma-lifestyle-index.adapter.js";

describe("KmaLifestyleIndexAdapter — KMA 생활기상지수 프로바이더", () => {
  let provider: KmaLifestyleIndexAdapter;
  const config: { kmaApiKey: string | undefined; weatherKit: null } = {
    kmaApiKey: "test-api-key",
    weatherKit: null,
  };
  let fetchSpy: MockInstance<typeof globalThis.fetch>;

  beforeEach(() => {
    config.kmaApiKey = "test-api-key";
    provider = new KmaLifestyleIndexAdapter(
      config,
      new HttpClient({ retry: false, throwOnHttpError: false }),
      createWeatherOutbound(new FakeTimerClock()).policies,
    );

    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getIndex", () => {
    const lat = 37.5;
    const lon = 126.9;
    const date = Temporal.Instant.from("2024-07-15T12:00:00Z");
    const currentTemp = 30;
    const windSpeed = 5;

    it("정상 응답 시 UV 지수와 체감온도를 반환해야 한다", async () => {
      // Given
      config.kmaApiKey = "test-api-key";
      fetchSpy.mockResolvedValue(
        new Response(
          JSON.stringify({
            response: {
              header: { resultCode: "00" },
              body: {
                items: {
                  item: [{ h0: "7" }],
                },
              },
            },
          }),
        ),
      );

      // When
      const result = await provider.getIndex({ lat, lon, at: date, currentTemp, windSpeed });

      // Then
      expect(result).not.toBeNull();
      expect(result?.uvIndex).toBe(7);
      // temp > 10이므로 체감온도 = 기온 그대로
      expect(result?.feelsLikeTemperature).toBe(currentTemp);
    });

    it("API 키가 없으면 체감온도는 반환하고 uvIndex는 null이어야 한다", async () => {
      // Given
      config.kmaApiKey = undefined;

      // When
      const result = await provider.getIndex({ lat, lon, at: date, currentTemp, windSpeed });

      // Then
      expect(result.feelsLikeTemperature).toBe(currentTemp);
      expect(result.uvIndex).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("API 에러 시 체감온도는 반환하고 uvIndex는 null이어야 한다", async () => {
      // Given
      config.kmaApiKey = "test-api-key";
      fetchSpy.mockRejectedValue(new Error("Network error"));

      // When
      const result = await provider.getIndex({ lat, lon, at: date, currentTemp, windSpeed });

      // Then
      expect(result.feelsLikeTemperature).toBe(currentTemp);
      expect(result.uvIndex).toBeNull();
    });

    it("타임아웃 시 체감온도는 반환하고 uvIndex는 null이어야 한다", async () => {
      // Given
      config.kmaApiKey = "test-api-key";
      fetchSpy.mockRejectedValue(new DOMException("Aborted", "AbortError"));

      // When
      const result = await provider.getIndex({ lat, lon, at: date, currentTemp, windSpeed });

      // Then
      expect(result.feelsLikeTemperature).toBe(currentTemp);
      expect(result.uvIndex).toBeNull();
    });

    it("풍속과 기온 조건에 따라 체감온도를 올바르게 계산해야 한다", async () => {
      // Given
      // 체감온도 공식 적용 조건: temp <= 10, windSpeed(m/s) * 3.6 >= 1.3 km/h
      const coldTemp = 5;
      const highWindMs = 5.6; // m/s → 20.16 km/h
      config.kmaApiKey = "test-api-key";
      fetchSpy.mockResolvedValue(
        new Response(
          JSON.stringify({
            response: {
              header: { resultCode: "00" },
              body: {
                items: {
                  item: [{ h0: "3" }],
                },
              },
            },
          }),
        ),
      );

      // When
      const result = await provider.getIndex({
        lat,
        lon,
        at: date,
        currentTemp: coldTemp,
        windSpeed: highWindMs,
      });

      // Then
      expect(result).not.toBeNull();
      const windKmh = highWindMs * 3.6;
      const v016 = windKmh ** 0.16;
      const expectedFeelsLike = 13.12 + 0.6215 * coldTemp - 11.37 * v016 + 0.3965 * coldTemp * v016;
      expect(result.feelsLikeTemperature).toBeCloseTo(expectedFeelsLike, 2);
      expect(result.uvIndex).toBe(3);
    });
  });
  it("UV time은 서버 TZ와 무관하게 KST 날짜와 시각을 보낸다", async () => {
    // Given
    config.kmaApiKey = "test-api-key";
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          response: {
            header: { resultCode: "00" },
            body: { items: { item: [{ h0: "7" }] } },
          },
        }),
      ),
    );
    // When
    const result = await provider.getIndex({
      lat: 37.5665,
      lon: 126.978,
      at: Temporal.Instant.from("2026-07-23T16:00:00Z"),
      currentTemp: 25,
      windSpeed: 3,
    });
    // Then
    expect(result).toEqual({ feelsLikeTemperature: 25, uvIndex: 7 });
    const request = fetchSpy.mock.calls[0]?.[0];
    expect(new URL(String(request)).searchParams.get("time")).toBe("2026072401");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
