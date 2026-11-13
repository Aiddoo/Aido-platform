import { Logger } from "@nestjs/common";
import { HttpClient } from "@nestjs/http-client";

import { WeatherReportCacheKey } from "#api/modules/weather/forecasts/infrastructure/cache/weather-report.keyspace";
import { Coordinate } from "#api/modules/weather/shared/domain/coordinate.vo";
import { GeoCell } from "#api/modules/weather/shared/domain/geo-cell.vo";
import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { FakeTimerClock } from "#test/doubles/platform/fake-timer-clock";
import { StubWeatherKitAttributionResolver } from "#test/doubles/weather/stub-weatherkit-attribution-resolver";
import { StubWeatherKitTokenResolver } from "#test/doubles/weather/stub-weatherkit-token-resolver";
import { createWeatherOutbound } from "#test/doubles/weather/weather-outbound";
import { WeatherKitReportFixture } from "#test/fixtures/weatherkit-report.fixture";

import { ForecastAlerts } from "../../application/forecasts.alerts.js";
import { WeatherKitReportAdapter, WeatherKitRequestError } from "./weatherkit-report.adapter.js";
import { WeatherKitNotConfiguredError } from "./weatherkit-token.adapter.js";

const USER_COORDINATE = Coordinate.create(37.5665, 126.978);
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

const networkFailure: StubResponse = () => {
  throw new TypeError("fetch failed");
};

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

describe("WeatherKitReportAdapter — 가용성·REST 요청과 실패 분류", () => {
  const cell = GeoCell.create(USER_COORDINATE);
  let memory: InMemoryCacheStore;
  let cacheService: InMemoryCacheStore;
  let tokenResolver: StubWeatherKitTokenResolver;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(WeatherKitReportFixture.fetchedAt));
    memory = new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 100 });
    cacheService = memory;
    tokenResolver = new StubWeatherKitTokenResolver();
    logSpy = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    warnSpy = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, "debug").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function createProvider(responses: readonly StubResponse[]) {
    const stub = createStubFetch(responses);
    const http = new HttpClient({ retry: false, throwOnHttpError: false, fetch: stub.fetch });
    const outbound = createWeatherOutbound(new FakeTimerClock());
    const provider = new WeatherKitReportAdapter(
      http,
      tokenResolver,
      cacheService,
      new StubWeatherKitAttributionResolver(),
      outbound.policies,
      outbound.usage,
      new FakeTimerClock(),
    );
    return { provider, requests: stub.requests, ...outbound };
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
    expect(report.fetchedAt).toEqual(Temporal.Instant.from("2026-11-02T10:36:08Z"));
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

  it("가용성 조회가 실패한 칸은 1분 동안 가용성을 다시 묻지 않고 기본 dataset으로 바로 진행한다", async () => {
    // Given 가용성 503 뒤 날씨 성공, 리포트 캐시는 없는 상태로 다시 부른다
    const { provider, requests } = createProvider([
      jsonResponse({ reason: "unavailable" }, 503),
      jsonResponse(WeatherKitReportFixture.seoulRain()),
      jsonResponse(WeatherKitReportFixture.seoulRain()),
      jsonResponse(WeatherKitReportFixture.availability()),
      jsonResponse(WeatherKitReportFixture.seoulRain()),
    ]);
    await provider.getReport(cell, REQUEST);
    // When
    await provider.getReport(cell, REQUEST);
    vi.setSystemTime(new Date("2026-11-02T06:21:01Z"));
    await provider.getReport(cell, REQUEST);
    // Then
    expect(requests.map(pathKind)).toEqual([
      "availability",
      "weather",
      "weather",
      "availability",
      "weather",
    ]);
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
    await vi.advanceTimersByTimeAsync(3999);
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

  describe("공급자 전체 장애 차단 (공용 weatherkit 회로)", () => {
    const cells = Array.from({ length: 6 }, (_, index) =>
      GeoCell.create(Coordinate.create(37.5665 + index * 0.1, 126.978)),
    );

    /** 장애 중에는 가용성 조회와 리포트 호출이 함께 실패한다. */
    function failingCell(response: StubResponse): StubResponse[] {
      return [response, response];
    }

    function healthyCell(): StubResponse[] {
      return [
        jsonResponse(WeatherKitReportFixture.availability()),
        jsonResponse(WeatherKitReportFixture.seoulRain()),
      ];
    }

    async function readCells(provider: WeatherKitReportAdapter, targets: readonly GeoCell[]) {
      for (const target of targets) {
        await provider.getReport(target, REQUEST).catch(() => undefined);
      }
    }

    function circuitEvents(spy: ReturnType<typeof vi.spyOn>, event: string) {
      return spy.mock.calls.filter(
        ([entry]: unknown[]) =>
          typeof entry === "object" && entry != null && "event" in entry && entry.event === event,
      );
    }

    it("5xx·네트워크 오류가 칸을 넘어 세 번 연달아 나면 회로를 열고 경고를 한 번만 남긴다", async () => {
      // Given
      const { provider, requests } = createProvider([
        ...failingCell(jsonResponse({}, 503)),
        networkFailure,
      ]);
      // When
      await readCells(provider, cells.slice(0, 3));
      // Then
      expect(requests).toHaveLength(3);
      expect(circuitEvents(warnSpy, "outbound.circuit.opened")).toEqual([
        [
          {
            event: "outbound.circuit.opened",
            policy: "weatherkit",
            breaker: "health",
            cooldownMs: 60_000,
            errorType: "HttpNetworkError",
          },
        ],
      ]);
    });

    it("회로가 열린 동안에는 공급자를 부르지 않고 칸별 실패와 같은 오류로 바로 실패한다", async () => {
      // Given
      const { provider, requests } = createProvider([
        ...failingCell(jsonResponse({}, 503)),
        ...failingCell(jsonResponse({}, 503)),
      ]);
      await readCells(provider, cells.slice(0, 2));
      const requestCount = requests.length;
      // When
      const results = await Promise.all(
        cells
          .slice(3)
          .map((target) => provider.getReport(target, REQUEST).catch((error: unknown) => error)),
      );
      const localizes = await provider.localizesContent(cells[3] ?? cell, REQUEST);
      // Then
      expect(requestCount).toBe(3);
      expect(requests).toHaveLength(requestCount);
      for (const result of results) {
        expect(result).toBeInstanceOf(WeatherKitRequestError);
        expect(result).toMatchObject({ reason: "provider_outage" });
      }
      expect(localizes).toBe(false);
      expect(
        await cacheService.has(WeatherReportCacheKey.availabilityFailure(cells[3]?.key ?? "")),
      ).toBe(false);
      expect(
        await cacheService.has(WeatherReportCacheKey.providerFailure(cells[3]?.key ?? "")),
      ).toBe(false);
    });

    it("차단 시간이 지나면 시험 호출로 다시 부르고 성공하면 회로를 닫는다", async () => {
      // Given
      const { provider, requests } = createProvider([
        ...failingCell(jsonResponse({}, 503)),
        jsonResponse({}, 503),
        ...healthyCell(),
      ]);
      await readCells(provider, cells.slice(0, 2));
      vi.setSystemTime(new Date("2026-11-02T06:21:01Z"));
      // When
      const recovered = await provider.getReport(cells[3] ?? cell, REQUEST);
      // Then
      expect(recovered.current.condition).toBe("RAIN");
      expect(circuitEvents(logSpy, "outbound.circuit.closed")).toEqual([
        [{ event: "outbound.circuit.closed", policy: "weatherkit", breaker: "health" }],
      ]);
      expect(requests).toHaveLength(5);
    });

    it("시험 호출도 실패하면 바로 다시 막는다", async () => {
      // Given
      const { provider, requests } = createProvider([
        ...failingCell(jsonResponse({}, 503)),
        jsonResponse({}, 503),
        jsonResponse({}, 502),
      ]);
      await readCells(provider, cells.slice(0, 2));
      vi.setSystemTime(new Date("2026-11-02T06:21:01Z"));
      // When
      await readCells(provider, cells.slice(3, 4));
      const next = provider.getReport(cells[4] ?? cell, REQUEST);
      // Then
      await expect(next).rejects.toMatchObject({ reason: "provider_outage" });
      expect(requests).toHaveLength(4);
    });

    it("성공이 끼면 연속 실패를 처음부터 다시 센다", async () => {
      // Given
      const { provider } = createProvider([
        jsonResponse({}, 503),
        jsonResponse({}, 503),
        ...healthyCell(),
        jsonResponse({}, 503),
        jsonResponse({}, 503),
        ...healthyCell(),
      ]);
      // When
      await readCells(provider, cells.slice(0, 3));
      const report = await provider.getReport(cells[3] ?? cell, REQUEST);
      // Then
      expect(report.current.condition).toBe("RAIN");
      expect(circuitEvents(warnSpy, "outbound.circuit.opened")).toEqual([]);
    });

    it("400·404 같은 요청 오류는 몇 번이 나도 전체 장애로 세지 않는다", async () => {
      // Given
      const { provider, requests } = createProvider([
        ...failingCell(jsonResponse({}, 400)),
        ...failingCell(jsonResponse({}, 404)),
        ...failingCell(jsonResponse({}, 400)),
        ...healthyCell(),
      ]);
      await readCells(provider, cells.slice(0, 3));
      // When
      const report = await provider.getReport(cells[3] ?? cell, REQUEST);
      // Then
      expect(report.current.condition).toBe("RAIN");
      expect(requests).toHaveLength(8);
      expect(circuitEvents(warnSpy, "outbound.circuit.opened")).toEqual([]);
    });
  });

  describe("WeatherKit 월 호출 계량", () => {
    it("실제로 보낸 가용성·리포트 호출을 이번 달 weatherkit.call에 센다", async () => {
      // Given
      const { provider, meter } = createProvider([
        jsonResponse(WeatherKitReportFixture.availability()),
        jsonResponse(WeatherKitReportFixture.seoulRain()),
      ]);
      // When
      await provider.getReport(cell, REQUEST);
      // Then
      expect(
        await meter.read([{ meter: "weatherkit.call", periodKey: "2026-11", subject: "*" }]),
      ).toEqual([2]);
    });

    it("무료 한도 60%(30만 회)에 닿은 호출 하나만 운영 경보를 올린다", async () => {
      // Given
      const { provider, meter, alert } = createProvider([
        jsonResponse(WeatherKitReportFixture.availability()),
        jsonResponse(WeatherKitReportFixture.seoulRain()),
      ]);
      await meter.add([
        { key: { meter: "weatherkit.call", periodKey: "2026-11", subject: "*" }, amount: 299_999 },
      ]);
      // When
      await provider.getReport(cell, REQUEST);
      // Then
      expect(alert.alerts).toEqual([
        {
          ...ForecastAlerts.WEATHERKIT_MONTHLY_CALLS,
          tags: { period: "2026-11" },
          details: { threshold: 300_000, total: 300_000 },
        },
      ]);
    });
  });
});
