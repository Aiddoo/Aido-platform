import { Logger } from "@nestjs/common";
import { HttpClient } from "@nestjs/http-client";

import { InMemoryCacheAdapter } from "#api/platform/cache/adapters/in-memory-cache.adapter";
import { CacheService } from "#api/platform/cache/cache.service";

import { WeatherKitLogEvent } from "../../observability/forecast/weatherkit-log.events.js";
import { WeatherKitAttributionResolver } from "./weatherkit-attribution.resolver.js";

const OBSERVED_KO_ATTRIBUTION = {
  "logoDark@3x": "/assets/branding/ko/Apple_Weather_wht_ko_3X_090122.png",
  "logoLight@1x": "/assets/branding/ko/Apple_Weather_blk_ko_1X_090122.png",
  "logoDark@2x": "/assets/branding/ko/Apple_Weather_wht_ko_2X_090122.png",
  "logoDark@1x": "/assets/branding/ko/Apple_Weather_wht_ko_1X_090122.png",
  "logoLight@2x": "/assets/branding/ko/Apple_Weather_blk_ko_2X_090122.png",
  "logoLight@3x": "/assets/branding/ko/Apple_Weather_blk_ko_3X_090122.png",
  "logoSquare@2x": "/assets/branding/square-mark@2x.png",
  serviceName: "Apple Weather",
  "logoSquare@1x": "/assets/branding/square-mark.png",
  "logoSquare@3x": "/assets/branding/square-mark@3x.png",
};

function createResolver(responses: readonly (() => Response)[]) {
  const requests: Request[] = [];
  const queue = [...responses];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    requests.push(new Request(input, init));
    const next = queue.shift();
    if (next == null) {
      throw new Error("준비되지 않은 요청입니다.");
    }
    return next();
  };
  const http = new HttpClient({ retry: false, throwOnHttpError: false, fetch });
  const cacheService = new CacheService(
    new InMemoryCacheAdapter({ defaultTtlMs: 60_000, maxItems: 100 }),
  );
  return { resolver: new WeatherKitAttributionResolver(http, cacheService), requests };
}

const json =
  (body: unknown, status = 200) =>
  () =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("WeatherKitAttributionResolver — Apple 날씨 출처 표기", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  });

  it("언어별 공식 로고 경로를 절대 URL로 바꾸고 출처 고지 링크와 함께 돌려준다", async () => {
    // Given 실제 /attribution/ko 응답
    const { resolver, requests } = createResolver([json(OBSERVED_KO_ATTRIBUTION)]);

    // When
    const attribution = await resolver.resolve("ko");

    // Then
    expect(new URL(requests[0]?.url ?? "").pathname).toBe("/attribution/ko");
    expect(requests[0]?.headers.get("authorization")).toBeNull();
    expect(attribution).toEqual({
      provider: "APPLE_WEATHER",
      serviceName: "Apple Weather",
      legalPageUrl: "https://developer.apple.com/weatherkit/data-source-attribution/",
      logo: {
        light: {
          "1x": "https://weatherkit.apple.com/assets/branding/ko/Apple_Weather_blk_ko_1X_090122.png",
          "2x": "https://weatherkit.apple.com/assets/branding/ko/Apple_Weather_blk_ko_2X_090122.png",
          "3x": "https://weatherkit.apple.com/assets/branding/ko/Apple_Weather_blk_ko_3X_090122.png",
        },
        dark: {
          "1x": "https://weatherkit.apple.com/assets/branding/ko/Apple_Weather_wht_ko_1X_090122.png",
          "2x": "https://weatherkit.apple.com/assets/branding/ko/Apple_Weather_wht_ko_2X_090122.png",
          "3x": "https://weatherkit.apple.com/assets/branding/ko/Apple_Weather_wht_ko_3X_090122.png",
        },
      },
    });
  });

  it("같은 언어는 캐시를 써서 한 번만 요청한다", async () => {
    // Given
    const { resolver, requests } = createResolver([json(OBSERVED_KO_ATTRIBUTION)]);

    // When
    await resolver.resolve("ko");
    await resolver.resolve("ko");

    // Then
    expect(requests).toHaveLength(1);
  });

  it("조회에 실패하면 로고만 null로 두고 서비스 이름과 고지 링크는 유지한다", async () => {
    // Given 5xx 응답
    const { resolver } = createResolver([json({}, 503)]);

    // When
    const attribution = await resolver.resolve("en");

    // Then
    expect(attribution.logo).toBeNull();
    expect(attribution.serviceName).toBe("Apple Weather");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({ event: WeatherKitLogEvent.ATTRIBUTION_FAILED, language: "en" }),
    );
  });

  it("로고 경로 형식이 깨지면 로고를 버린다", async () => {
    // Given 상대 경로가 아닌 값
    const { resolver } = createResolver([
      json({ ...OBSERVED_KO_ATTRIBUTION, "logoDark@1x": "https://evil.example/logo.png" }),
    ]);

    // When
    const attribution = await resolver.resolve("ko");

    // Then
    expect(attribution.logo).toBeNull();
  });
});
