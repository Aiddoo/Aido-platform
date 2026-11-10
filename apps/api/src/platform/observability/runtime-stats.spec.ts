import {
  evaluateRuntimeSample,
  newlyBreached,
  RUNTIME_THRESHOLDS,
  type RuntimeSample,
} from "./runtime-stats.js";

const MB = 1024 * 1024;

function sample(overrides: Partial<RuntimeSample> = {}): RuntimeSample {
  return {
    sampledAtMs: 1_000_000,
    eventLoopDelayP99Ms: 12,
    heapUsedBytes: 100 * MB,
    heapLimitBytes: 384 * MB,
    rssBytes: 200 * MB,
    pool: { totalCount: 3, idleCount: 2, waitingCount: 0 },
    ...overrides,
  };
}

describe("evaluateRuntimeSample — 런타임 포화 판정", () => {
  it("모든 값이 기준 안이면 경보가 없고 풀 대기 시작 시각도 없다", () => {
    // When
    const result = evaluateRuntimeSample(sample(), { poolWaitingSinceMs: null });

    // Then
    expect(result).toEqual({ breaches: [], poolWaitingSinceMs: null });
  });

  it("풀 대기가 처음 보이면 시작 시각만 기록하고 아직 경보하지 않는다", () => {
    // Given
    const waiting = sample({ pool: { totalCount: 10, idleCount: 0, waitingCount: 4 } });

    // When
    const result = evaluateRuntimeSample(waiting, { poolWaitingSinceMs: null });

    // Then
    expect(result).toEqual({ breaches: [], poolWaitingSinceMs: 1_000_000 });
  });

  it.each([
    { name: "29초", elapsedMs: 29_999, breached: false },
    { name: "30초", elapsedMs: RUNTIME_THRESHOLDS.poolWaitingSustainedMs, breached: true },
  ])("풀 대기가 $name 이어지면 경보 여부는 $breached다", ({ elapsedMs, breached }) => {
    // Given
    const waiting = sample({
      sampledAtMs: 1_000_000 + elapsedMs,
      pool: { totalCount: 10, idleCount: 0, waitingCount: 4 },
    });

    // When
    const result = evaluateRuntimeSample(waiting, { poolWaitingSinceMs: 1_000_000 });

    // Then
    expect(result.breaches.some((breach) => breach.kind === "pool-waiting")).toBe(breached);
    expect(result.poolWaitingSinceMs).toBe(1_000_000);
  });

  it("풀 대기가 사라지면 시작 시각을 지운다", () => {
    // When
    const result = evaluateRuntimeSample(sample(), { poolWaitingSinceMs: 1000 });

    // Then
    expect(result.poolWaitingSinceMs).toBeNull();
  });

  it.each([
    { name: "루프 p99 200ms", overrides: { eventLoopDelayP99Ms: 200 }, breached: false },
    { name: "루프 p99 201ms", overrides: { eventLoopDelayP99Ms: 201 }, breached: true },
  ])("$name → 이벤트 루프 경보 $breached", ({ overrides, breached }) => {
    // When
    const result = evaluateRuntimeSample(sample(overrides), { poolWaitingSinceMs: null });

    // Then
    expect(result.breaches.some((breach) => breach.kind === "event-loop-delay")).toBe(breached);
  });

  it.each([
    { name: "힙 85%", heapUsedBytes: 384 * MB * 0.85, breached: false },
    { name: "힙 86%", heapUsedBytes: 384 * MB * 0.86, breached: true },
  ])("$name → 힙 경보 $breached", ({ heapUsedBytes, breached }) => {
    // When
    const result = evaluateRuntimeSample(sample({ heapUsedBytes }), { poolWaitingSinceMs: null });

    // Then
    expect(result.breaches.some((breach) => breach.kind === "heap-usage")).toBe(breached);
  });
});

describe("newlyBreached — 같은 포화의 경보 반복 막기", () => {
  it("직전 표본에서 이미 넘어 있던 종류는 다시 경보하지 않고 새로 넘은 것만 고른다", () => {
    // Given
    const previous = new Set(["heap-usage"] as const);
    const breaches = [
      { kind: "heap-usage", details: { heapUsedBytes: 1 } },
      { kind: "event-loop-delay", details: { eventLoopDelayP99Ms: 250 } },
    ] as const;

    // When
    const fresh = newlyBreached(previous, breaches);

    // Then
    expect(fresh.map((breach) => breach.kind)).toEqual(["event-loop-delay"]);
  });

  it("기준 아래로 내려갔다가 다시 넘으면 다시 경보한다", () => {
    // Given
    const recovered = new Set<never>();

    // When
    const fresh = newlyBreached(recovered, [{ kind: "heap-usage", details: { heapUsedBytes: 1 } }]);

    // Then
    expect(fresh).toHaveLength(1);
  });
});
