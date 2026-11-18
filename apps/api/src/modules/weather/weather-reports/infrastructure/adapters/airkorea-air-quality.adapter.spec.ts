import { HttpClient } from "@nestjs/http-client";

import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { FakeTimerClock } from "#test/doubles/platform/fake-timer-clock";
import { createWeatherOutbound } from "#test/doubles/weather/weather-outbound";
import { suppressLogger } from "#test/setup/suppress-logger";

import { Coordinate } from "../../../shared/domain/coordinate.vo.js";
import { GeoCell } from "../../../shared/domain/geo-cell.vo.js";
import { WeatherReportCacheKey } from "../cache/weather-report.keyspace.js";
import { AirkoreaAirQualityAdapter } from "./airkorea-air-quality.adapter.js";
import { AirkoreaRequestError } from "./airkorea.errors.js";

const CELL = GeoCell.create(Coordinate.create(37.5665, 126.978));
const STATION_KEY = WeatherReportCacheKey.airKoreaStation(CELL.key);
const DAY_MS = 24 * 60 * 60_000;

type StubResponse = () => Response;

function json(body: unknown, status = 200): StubResponse {
  return () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
}

const stationList = (stationName: string) =>
  json({ response: { header: { resultCode: "00" }, body: { items: [{ stationName }] } } });

const measurement = (pm10Value: string, pm25Value: string) =>
  json({ response: { header: { resultCode: "00" }, body: { items: [{ pm10Value, pm25Value }] } } });

const emptyMeasurement = json({ response: { header: { resultCode: "00" }, body: { items: [] } } });

/** 준비한 순서대로 응답하고 보낸 요청의 경로를 남긴다. 준비하지 않은 요청은 실패시킨다. */
function createRecordingFetch(responses: readonly StubResponse[]) {
  const paths: string[] = [];
  const queue = [...responses];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    paths.push(new URL(new Request(input, init).url).pathname.split("/").at(-1) ?? "");
    const next = queue.shift();
    if (next == null) {
      throw new TypeError("fetch failed");
    }
    return next();
  };
  return { fetch, paths };
}

describe("AirkoreaAirQualityAdapter — 측정소 캐시와 측정값 없음·실패 구분", () => {
  let memory: InMemoryCacheStore;
  let config: { kmaApiKey: string | undefined; weatherKit: null };

  beforeEach(() => {
    suppressLogger();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Temporal.Instant.from("2026-11-02T06:20:00Z").epochMilliseconds);
    memory = new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 100 });
    config = { kmaApiKey: "test-api-key", weatherKit: null };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createAdapter(responses: readonly StubResponse[]) {
    const recording = createRecordingFetch(responses);
    const adapter = new AirkoreaAirQualityAdapter(
      config,
      new HttpClient({ retry: false, throwOnHttpError: false, fetch: recording.fetch }),
      createWeatherOutbound(new FakeTimerClock()).policies,
      memory,
    );
    return { adapter, paths: recording.paths };
  }

  it("칸 중심의 가까운 측정소를 찾아 PM10·PM2.5를 돌려준다", async () => {
    // Given
    const { adapter, paths } = createAdapter([stationList("종로구"), measurement("45", "23")]);

    // When
    const result = await adapter.findAirQuality(CELL);

    // Then
    expect(result).toEqual({ pm10: 45, pm25: 23 });
    expect(paths).toEqual(["getNearbyMsrstnList", "getMsrstnAcctoRltmMesureDnsty"]);
  });

  it("측정소를 칸마다 30일 기억해 다음 조회는 측정값 호출 한 번만 보낸다", async () => {
    // Given
    const { adapter, paths } = createAdapter([
      stationList("종로구"),
      measurement("45", "23"),
      measurement("50", "25"),
    ]);
    await adapter.findAirQuality(CELL);

    // When
    const second = await adapter.findAirQuality(CELL);

    // Then
    expect(second).toEqual({ pm10: 50, pm25: 25 });
    expect(paths).toHaveLength(3);
    expect(paths[2]).toBe("getMsrstnAcctoRltmMesureDnsty");
    expect(await memory.ttl(STATION_KEY)).toBe(30 * DAY_MS);
  });

  it("측정소가 측정값을 주지 않으면 null이고 기억한 측정소를 지워 다음에 다시 찾는다", async () => {
    // Given
    const { adapter } = createAdapter([stationList("폐쇄된측정소"), emptyMeasurement]);

    // When
    const result = await adapter.findAirQuality(CELL);

    // Then
    expect(result).toBeNull();
    expect(await memory.has(STATION_KEY)).toBe(false);
  });

  it("측정값 없음 결과 코드(03)는 실패가 아닌 null이다", async () => {
    // Given
    const { adapter } = createAdapter([
      stationList("종로구"),
      json({ response: { header: { resultCode: "03" } } }),
    ]);

    // When
    const result = await adapter.findAirQuality(CELL);

    // Then
    expect(result).toBeNull();
  });

  it('측정값이 "-"이면 그 값만 null이다', async () => {
    // Given
    const { adapter } = createAdapter([stationList("종로구"), measurement("-", "-")]);

    // When
    const result = await adapter.findAirQuality(CELL);

    // Then
    expect(result).toEqual({ pm10: null, pm25: null });
  });

  it.each([
    { name: "HTTP 500", response: json({}, 500) },
    {
      name: "호출 한도 초과 결과 코드(22)",
      response: json({ response: { header: { resultCode: "22" } } }),
    },
  ])("측정소 조회가 $name이면 예외로 알리고 측정소를 기억하지 않는다", async ({ response }) => {
    // Given
    const { adapter, paths } = createAdapter([response]);

    // When
    const result = adapter.findAirQuality(CELL);

    // Then
    await expect(result).rejects.toBeInstanceOf(AirkoreaRequestError);
    expect(paths).toHaveLength(1);
    expect(await memory.has(STATION_KEY)).toBe(false);
  });

  it("측정값 호출이 네트워크 오류면 예외로 알리고 찾은 측정소는 남긴다", async () => {
    // Given
    const { adapter } = createAdapter([stationList("종로구")]);

    // When
    const result = adapter.findAirQuality(CELL);

    // Then
    await expect(result).rejects.toThrow();
    expect(await memory.has(STATION_KEY)).toBe(true);
  });

  it("공급자 오류 뒤 1분 동안 같은 칸은 부르지 않고 바로 실패로 알린다", async () => {
    // Given
    const { adapter, paths } = createAdapter([
      json({ response: { header: { resultCode: "22" } } }),
    ]);
    await expect(adapter.findAirQuality(CELL)).rejects.toBeInstanceOf(AirkoreaRequestError);
    // When
    const retried = adapter.findAirQuality(CELL);
    // Then
    await expect(retried).rejects.toMatchObject({ reason: "recent_failure" });
    expect(paths).toHaveLength(1);
    expect(await memory.ttl(WeatherReportCacheKey.airKoreaFailure(CELL.key))).toBe(60_000);
  });

  it('측정값이 모두 "-"이면 기억한 측정소를 지워 다음에 가까운 측정소를 다시 찾는다', async () => {
    // Given
    const { adapter } = createAdapter([stationList("중구"), measurement("-", "-")]);
    // When
    const result = await adapter.findAirQuality(CELL);
    // Then
    expect(result).toEqual({ pm10: null, pm25: null });
    expect(await memory.has(STATION_KEY)).toBe(false);
  });

  it("API 키가 없으면 부르지 않고 null이다", async () => {
    // Given
    config.kmaApiKey = undefined;
    const { adapter, paths } = createAdapter([]);

    // When
    const result = await adapter.findAirQuality(CELL);

    // Then
    expect(result).toBeNull();
    expect(paths).toEqual([]);
  });
});
