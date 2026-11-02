import { Logger } from "@nestjs/common";
import { HttpClient } from "@nestjs/http-client";

import { Coordinate } from "#api/modules/weather/domain/value-objects/forecast/coordinate.vo";
import { GeoCell } from "#api/modules/weather/domain/value-objects/forecast/geo-cell.vo";
import { WeatherReportCacheKey } from "#api/modules/weather/infrastructure/cache/forecast/weather-report.keyspace";
import { InMemoryCacheAdapter } from "#api/platform/cache/adapters/in-memory-cache.adapter";
import { CacheService } from "#api/platform/cache/cache.service";
import { WeatherKitReportFixture } from "#test/fixtures/weatherkit-report.fixture";
import {
  StubWeatherKitAttributionResolver,
  StubWeatherKitTokenResolver,
} from "#test/mocks/ports/weather.stub";

import { WeatherKitReportProvider, WeatherKitRequestError } from "./weatherkit-report.provider.js";
import { WeatherKitNotConfiguredError } from "./weatherkit-token.resolver.js";

const USER_COORDINATE = Coordinate.of(37.5665, 126.978);
const REQUEST = { timezone: "Asia/Seoul", countryCode: "KR", language: "ko" } as const;
const ALL_DATA_SETS = [
  "currentWeather",
  "forecastNextHour",
  "forecastHourly",
  "forecastDaily",
  "weatherAlerts",
] as const;

type StubResponse = (signal: AbortSignal | null | undefined) => Response | Promise<Response>;

/** 준비한 순서대로 응답하고, 준비하지 않은 요청은 네트워크로 보내지 않고 실패시킨다. */
function createStubFetch(responses: readonly StubResponse[]) {
  const requests: Request[] = [];
  const queue = [...responses];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    requests.push(new Request(input, init));
    const next = queue.shift();
    if (next == null) {
      throw new Error("준비되지 않은 요청입니다.");
    }
    return next(init?.signal);
  };
  return { fetch, requests };
}

function jsonResponse(body: unknown, status = 200): StubResponse {
  return () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
}

const neverResponds: StubResponse = (signal) =>
  new Promise<Response>((_resolve, reject) => {
    signal?.addEventListener("abort", () => reject(signal.reason));
  });

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function pathKind(request: Request | undefined): string | undefined {
  return new URL(request?.url ?? "https://invalid.test/").pathname.split("/")[3];
}

describe("WeatherKitReportProvider — 가용성·REST 요청과 실패 분류", () => {
  const cell = GeoCell.fromCoordinate(USER_COORDINATE);
  let memory: InMemoryCacheAdapter;
  let cacheService: CacheService;
  let tokenResolver: StubWeatherKitTokenResolver;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(WeatherKitReportFixture.fetchedAt));
    memory = new InMemoryCacheAdapter({ defaultTtlMs: 60_000, maxItems: 100 });
    cacheService = new CacheService(memory);
    tokenResolver = new StubWeatherKitTokenResolver();
    logSpy = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    warnSpy = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, "debug").mockImplementation(() => undefined);
  });
  afterEach(() => {
    try {
      memory.onModuleDestroy();
    } finally {
      vi.useRealTimers();
    }
  });

  function createProvider(responses: readonly StubResponse[]) {
    const stub = createStubFetch(responses);
    const http = new HttpClient({ retry: false, throwOnHttpError: false, fetch: stub.fetch });
    const provider = new WeatherKitReportProvider(
      http,
      tokenResolver,
      cacheService,
      new StubWeatherKitAttributionResolver(),
    );
    return { provider, requests: stub.requests };
  }

  it("칸 중심 좌표로 가용성을 묻고 제공되는 dataset만 한 번에 요청한다", async () => {
    // Given
    const { provider, requests } = createProvider([
      jsonResponse(WeatherKitReportFixture.availability()),
      jsonResponse(WeatherKitReportFixture.seoulRain()),
    ]);
    const { latitude, longitude } = cell.center;
    // When
    const report = await provider.getReport(cell, REQUEST);
    // Then
    const [availability, weather] = requests.map((request) => new URL(request.url));
    expect(availability?.origin + (availability?.pathname ?? "")).toBe(
      `https://weatherkit.apple.com/api/v1/availability/${round4(latitude)}/${round4(longitude)}`,
    );
    expect(availability?.searchParams.get("country")).toBe("KR");
    expect(weather?.origin + (weather?.pathname ?? "")).toBe(
      `https://weatherkit.apple.com/api/v1/weather/ko/${round4(latitude)}/${round4(longitude)}`,
    );
    expect(Object.fromEntries(weather?.searchParams ?? [])).toEqual({
      dataSets: "currentWeather,forecastHourly,forecastDaily",
      timezone: "Asia/Seoul",
      countryCode: "KR",
      hourlyStart: "2026-11-02T06:00:00.000Z",
      hourlyEnd: "2026-11-03T12:00:00.000Z",
      dailyEnd: "2026-11-13T06:20:00.000Z",
    });
    expect(requests.some((request) => request.url.includes("37.5665"))).toBe(false);
    expect(requests.map((request) => request.headers.get("authorization"))).toEqual([
      "Bearer synthetic.jwt.token-1",
      "Bearer synthetic.jwt.token-1",
    ]);
    expect(report.nextHour).toBeNull();
    expect(report.alerts).toEqual([]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("실제 서울 응답은 분 단위 예보·특보 없이 경고 없이 매핑되고 fetchedAt은 공급자 readTime이다", async () => {
    // Given
    const { provider } = createProvider([
      jsonResponse(WeatherKitReportFixture.availability()),
      jsonResponse(WeatherKitReportFixture.seoulObserved()),
    ]);
    // When
    const report = await provider.getReport(cell, REQUEST);
    // Then
    expect(report.nextHour).toBeNull();
    expect(report.alerts).toEqual([]);
    expect(report.fetchedAt).toEqual(new Date("2026-11-02T10:36:08Z"));
    expect(report.daily[0]?.moonrise).toBeNull();
    expect(report.daily[0]?.restOfDay?.precipitationType).toBe("NONE");
    expect(report.daily[1]?.restOfDay).toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("실제 도쿄 응답의 맑음 구간은 precipitationType NONE이고 분 단위 예보를 모두 담는다", async () => {
    // Given
    const { provider } = createProvider([
      jsonResponse(WeatherKitReportFixture.availability(...ALL_DATA_SETS.slice(0, 4))),
      jsonResponse(WeatherKitReportFixture.tokyoObserved()),
    ]);
    // When
    const report = await provider.getReport(cell, { ...REQUEST, timezone: "Asia/Tokyo" });
    // Then
    expect(report.nextHour?.periods).toEqual([
      expect.objectContaining({ condition: "CLEAR", precipitationType: "NONE", endsAt: null }),
    ]);
    expect(report.nextHour?.minutes).toHaveLength(84);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("가용성은 칸별로 7일 캐시해 다음 요청은 날씨 한 번만 부른다", async () => {
    // Given
    const { provider, requests } = createProvider([
      jsonResponse(WeatherKitReportFixture.availability(...ALL_DATA_SETS)),
      jsonResponse(WeatherKitReportFixture.newYorkStorm()),
      jsonResponse(WeatherKitReportFixture.newYorkStorm()),
      jsonResponse(WeatherKitReportFixture.availability(...ALL_DATA_SETS)),
      jsonResponse(WeatherKitReportFixture.newYorkStorm()),
    ]);
    await provider.getReport(cell, REQUEST);
    // When
    vi.setSystemTime(new Date("2026-11-08T06:19:00Z"));
    await provider.getReport(cell, REQUEST);
    vi.setSystemTime(new Date("2026-11-09T06:21:00Z"));
    await provider.getReport(cell, REQUEST);
    // Then
    expect(requests.map(pathKind)).toEqual([
      "availability",
      "weather",
      "weather",
      "availability",
      "weather",
    ]);
    expect(new URL(requests[1]?.url ?? "").searchParams.get("dataSets")).toBe(
      ALL_DATA_SETS.join(","),
    );
  });

  it("가용성 조회가 실패하면 캐시하지 않고 기본 세 dataset으로 진행한다", async () => {
    // Given
    const { provider, requests } = createProvider([
      jsonResponse({ reason: "unavailable" }, 503),
      jsonResponse(WeatherKitReportFixture.seoulRain()),
    ]);
    // When
    const report = await provider.getReport(cell, REQUEST);
    // Then
    expect(new URL(requests[1]?.url ?? "").searchParams.get("dataSets")).toBe(
      "currentWeather,forecastHourly,forecastDaily",
    );
    expect(report.current.condition).toBe("RAIN");
    expect(warnSpy).toHaveBeenCalledWith({
      event: "weather.weatherkit.availability_failed",
      cellKey: cell.key,
      status: 503,
      errorType: "http_failure",
    });
    expect(await cacheService.has(WeatherReportCacheKey.availability(cell.key))).toBe(false);
  });

  it("국가를 모르면 country·countryCode 없이 요청한다", async () => {
    // Given
    const { provider, requests } = createProvider([
      jsonResponse(WeatherKitReportFixture.availability()),
      jsonResponse(WeatherKitReportFixture.tokyoClear()),
    ]);
    // When
    await provider.getReport(cell, { ...REQUEST, countryCode: null });
    // Then
    const [availability, weather] = requests.map((request) => new URL(request.url));
    expect(availability?.searchParams.has("country")).toBe(false);
    expect(weather?.searchParams.has("countryCode")).toBe(false);
  });

  it("성공 호출을 칸·상태·지연·받은 dataset으로 기록하고 토큰·좌표는 남기지 않는다", async () => {
    // Given
    const { provider } = createProvider([
      jsonResponse(WeatherKitReportFixture.availability()),
      jsonResponse(WeatherKitReportFixture.hanoiWithoutNextHour()),
    ]);
    // When
    await provider.getReport(cell, REQUEST);
    // Then
    expect(logSpy).toHaveBeenCalledWith({
      event: "weather.weatherkit.request_completed",
      cellKey: cell.key,
      status: 200,
      latencyMs: expect.any(Number),
      dataSets: ["currentWeather", "forecastHourly", "forecastDaily"],
    });
    const logged = JSON.stringify([...logSpy.mock.calls, ...warnSpy.mock.calls]);
    expect(logged).not.toContain("synthetic.jwt");
    expect(logged).not.toContain("37.5665");
  });

  it("요청한 dataset이 빠지거나 형태가 깨져 버려지면 이름만 경고로 남긴다", async () => {
    // Given
    const body = {
      ...WeatherKitReportFixture.newYorkStorm(),
      forecastNextHour: { summary: "broken" },
      weatherAlerts: undefined,
    };
    const { provider } = createProvider([
      jsonResponse(WeatherKitReportFixture.availability(...ALL_DATA_SETS)),
      jsonResponse(body),
    ]);
    // When
    const report = await provider.getReport(cell, REQUEST);
    // Then
    expect(report.nextHour).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith({
      event: "weather.weatherkit.dataset_dropped",
      cellKey: cell.key,
      dataSets: ["forecastNextHour", "weatherAlerts"],
    });
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain("broken");
  });

  it.each([429, 500, 503])(
    "날씨 요청이 HTTP %i이면 공급자 실패로 던지고 상태를 기록한다",
    async (status) => {
      // Given
      const { provider } = createProvider([
        jsonResponse(WeatherKitReportFixture.availability()),
        jsonResponse({ reason: "quota" }, status),
      ]);
      // When
      const result = provider.getReport(cell, REQUEST);
      // Then
      await expect(result).rejects.toBeInstanceOf(WeatherKitRequestError);
      expect(warnSpy).toHaveBeenCalledWith({
        event: "weather.weatherkit.request_failed",
        cellKey: cell.key,
        status,
        latencyMs: expect.any(Number),
        errorType: "http_failure",
      });
    },
  );

  it("401은 토큰을 버리고 한 번만 새 토큰으로 다시 보낸다", async () => {
    // Given
    const { provider, requests } = createProvider([
      jsonResponse(WeatherKitReportFixture.availability()),
      jsonResponse({ reason: "NOT_ENABLED" }, 401),
      jsonResponse(WeatherKitReportFixture.seoulRain()),
    ]);
    // When
    const report = await provider.getReport(cell, REQUEST);
    // Then
    expect(report.current.condition).toBe("RAIN");
    expect(tokenResolver.invalidations).toBe(1);
    expect(requests.map((request) => request.headers.get("authorization"))).toEqual([
      "Bearer synthetic.jwt.token-1",
      "Bearer synthetic.jwt.token-1",
      "Bearer synthetic.jwt.token-2",
    ]);
  });

  it("다시 보낸 요청도 403이면 반복하지 않고 auth_rejected로 실패한다", async () => {
    // Given
    const { provider, requests } = createProvider([
      jsonResponse(WeatherKitReportFixture.availability()),
      jsonResponse({}, 403),
      jsonResponse({}, 403),
    ]);
    // When
    const result = provider.getReport(cell, REQUEST);
    // Then
    await expect(result).rejects.toMatchObject({ reason: "auth_rejected", status: 403 });
    expect(requests).toHaveLength(3);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({ errorType: "auth_rejected", status: 403 }),
    );
  });

  it("4초 안에 응답이 없으면 요청을 중단하고 시간 초과로 실패한다", async () => {
    // Given
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date(WeatherKitReportFixture.fetchedAt));
    const { provider } = createProvider([
      jsonResponse(WeatherKitReportFixture.availability()),
      neverResponds,
    ]);
    // When
    const settled = provider.getReport(cell, REQUEST).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(3_999);
    const beforeTimeout = await Promise.race([settled, Promise.resolve("pending")]);
    await vi.advanceTimersByTimeAsync(1);
    // Then
    expect(beforeTimeout).toBe("pending");
    expect(await settled).toMatchObject({ name: "HttpTimeoutError" });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "weather.weatherkit.request_failed",
        status: null,
        errorType: "HttpTimeoutError",
      }),
    );
  });

  it("실패한 칸은 1분 동안 공급자를 부르지 않고 바로 실패해 폴백으로 넘긴다", async () => {
    // Given
    const { provider, requests } = createProvider([
      jsonResponse(WeatherKitReportFixture.availability()),
      jsonResponse({}, 503),
      jsonResponse(WeatherKitReportFixture.seoulRain()),
    ]);
    await provider.getReport(cell, REQUEST).catch(() => undefined);
    // When
    const duringOutage = provider.getReport(cell, REQUEST);
    await expect(duringOutage).rejects.toMatchObject({ reason: "recent_failure" });
    vi.setSystemTime(new Date("2026-11-02T06:21:01Z"));
    const afterOutage = await provider.getReport(cell, REQUEST);
    // Then
    expect(requests.map(pathKind)).toEqual(["availability", "weather", "weather"]);
    expect(afterOutage.current.condition).toBe("RAIN");
  });

  it("currentWeather가 없으면 missing_current로 실패한다", async () => {
    // Given
    const { provider } = createProvider([
      jsonResponse(WeatherKitReportFixture.availability()),
      jsonResponse({ forecastDaily: { days: [] } }),
    ]);
    // When
    const result = provider.getReport(cell, REQUEST);
    // Then
    await expect(result).rejects.toMatchObject({ reason: "missing_current" });
  });

  it("응답 형태가 깨지면 invalid_structure로 실패한다", async () => {
    // Given
    const { provider } = createProvider([
      jsonResponse(WeatherKitReportFixture.availability()),
      jsonResponse({ currentWeather: { temperature: "warm" } }),
    ]);
    // When
    const result = provider.getReport(cell, REQUEST);
    // Then
    await expect(result).rejects.toMatchObject({ reason: "invalid_structure" });
  });

  it("자격이 없으면 HTTP를 보내지 않고 설정 오류로 실패하며 장애 차단도 걸지 않는다", async () => {
    // Given
    tokenResolver.failure = new WeatherKitNotConfiguredError();
    const { provider, requests } = createProvider([]);
    // When
    const result = provider.getReport(cell, REQUEST);
    // Then
    await expect(result).rejects.toBeInstanceOf(WeatherKitNotConfiguredError);
    expect(requests).toEqual([]);
    expect(await cacheService.has(WeatherReportCacheKey.providerFailure(cell.key))).toBe(false);
  });
});
