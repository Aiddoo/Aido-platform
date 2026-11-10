import { Logger } from "@nestjs/common";
import { HttpClient } from "@nestjs/http-client";
import type { MockInstance } from "vitest";
/**
 * KasiSunTimeAdapter 단위 테스트
 *
 * @description
 * KASI 일출/일몰 API 호출 및 시각 포맷 변환 검증.
 * fetch를 전역 spy로 Mock.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/server test kasi-sun-time.provider.spec
 * ```
 */
import { vi } from "vitest";

import { FakeTimerClock } from "#test/doubles/platform/fake-timer-clock";
import { createWeatherOutbound } from "#test/doubles/weather/weather-outbound";

import { WeatherProviderLogEvent } from "../weather-provider.log-events.js";
import { KasiSunTimeAdapter } from "./kasi-sun-time.adapter.js";

describe("KasiSunTimeAdapter — KASI 일출일몰 프로바이더", () => {
  let provider: KasiSunTimeAdapter;
  const config: { kmaApiKey: string | undefined; weatherKit: null } = {
    kmaApiKey: "test-api-key",
    weatherKit: null,
  };
  let fetchSpy: MockInstance<typeof globalThis.fetch>;

  beforeEach(() => {
    config.kmaApiKey = "test-api-key";
    provider = new KasiSunTimeAdapter(
      config,
      new HttpClient({ retry: false, throwOnHttpError: false }),
      createWeatherOutbound(new FakeTimerClock()).policies,
    );

    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getSunTime", () => {
    const lat = 37.5;
    const lon = 126.9;
    const date = new Date("2024-07-15");

    it('정상 응답 시 일출/일몰 시각을 "HH:mm" 형식으로 반환해야 한다', async () => {
      // Given - API 키 설정 및 정상 일출/일몰 응답 준비
      config.kmaApiKey = "test-api-key";
      fetchSpy.mockResolvedValue(
        new Response(
          JSON.stringify({
            response: {
              header: { resultCode: "00" },
              body: {
                items: {
                  item: {
                    sunrise: "0532",
                    sunset: "1945",
                  },
                },
              },
            },
          }),
        ),
      );

      // When - 일출/일몰 시각 조회
      const result = await provider.getSunTime(lat, lon, date);

      // Then - HH:mm 형식으로 반환 확인
      expect(result).not.toBeNull();
      expect(result?.sunrise).toBe("05:32");
      expect(result?.sunset).toBe("19:45");
    });

    it("API 키가 없으면 null을 반환해야 한다", async () => {
      // Given - API 키 미설정
      config.kmaApiKey = undefined;

      // When - 일출/일몰 시각 조회
      const result = await provider.getSunTime(lat, lon, date);

      // Then - null 반환 및 fetch 미호출
      expect(result).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("API 에러 시 null을 반환해야 한다", async () => {
      // Given - API 키 설정 및 fetch 실패
      config.kmaApiKey = "test-api-key";
      fetchSpy.mockResolvedValue(
        new Response(null, {
          status: 500,
          statusText: "Internal Server Error",
        }),
      );

      // When - 일출/일몰 시각 조회
      const result = await provider.getSunTime(lat, lon, date);

      // Then - null 반환
      expect(result).toBeNull();
    });

    it("빈 응답 시 null을 반환해야 한다", async () => {
      // Given - API 키 설정 및 item이 없는 응답
      config.kmaApiKey = "test-api-key";
      fetchSpy.mockResolvedValue(
        new Response(
          JSON.stringify({
            response: {
              header: { resultCode: "00" },
              body: {
                items: {},
              },
            },
          }),
        ),
      );

      // When - 일출/일몰 시각 조회
      const result = await provider.getSunTime(lat, lon, date);

      // Then - null 반환
      expect(result).toBeNull();
    });
  });
  it("한국 날짜 locdate는 서버 TZ와 무관하게 KST 자정 뒤 날짜를 보낸다", async () => {
    // Given
    config.kmaApiKey = "test-api-key";
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          response: {
            header: { resultCode: "00" },
            body: { items: { item: { sunrise: "0524", sunset: "1900" } } },
          },
        }),
      ),
    );
    // When
    const result = await provider.getSunTime(37.5665, 126.978, new Date("2026-07-23T16:00:00Z"));
    // Then
    expect(result).toEqual({ sunrise: "05:24", sunset: "19:00" });
    const request = fetchSpy.mock.calls[0]?.[0];
    expect(new URL(String(request)).searchParams.get("locdate")).toBe("20260724");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("요청 오류의 원문·이름·query를 로그에 노출하지 않고 null fallback을 유지한다", async () => {
    // Given
    const secret = "https://private.test/?serviceKey=SECRET&latitude=37.5665 BODY_SECRET";
    config.kmaApiKey = "SECRET";
    const error = new Error(secret, { cause: { headers: { authorization: "HEADER_SECRET" } } });
    error.name = "NAME_SECRET";
    fetchSpy.mockRejectedValue(error);
    const warnLog = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});

    // When
    const result = await provider.getSunTime(37.5665, 126.978, new Date("2026-07-23T00:00:00Z"));

    // Then
    expect(result).toBeNull();
    expect(warnLog.mock.calls).toEqual([
      [
        {
          event: WeatherProviderLogEvent.REQUEST_FAILED,
          provider: "kasi",
          operation: "sun_time",
          errorType: "error",
        },
      ],
    ]);
    const logged = JSON.stringify(warnLog.mock.calls);
    expect(logged).not.toMatch(/SECRET|37\.5665|126\.978|https:/);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
