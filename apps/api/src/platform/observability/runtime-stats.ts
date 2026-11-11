export interface PoolStats {
  readonly totalCount: number;
  readonly idleCount: number;
  readonly waitingCount: number;
}

export interface RuntimeSample {
  readonly sampledAtMs: number;
  readonly eventLoopDelayP99Ms: number;
  readonly heapUsedBytes: number;
  readonly heapLimitBytes: number;
  readonly rssBytes: number;
  readonly pool: PoolStats | null;
}

const RUNTIME_BREACH_KINDS = ["pool-waiting", "event-loop-delay", "heap-usage"] as const;

export type RuntimeBreachKind = (typeof RUNTIME_BREACH_KINDS)[number];

export interface RuntimeBreach {
  readonly kind: RuntimeBreachKind;
  readonly details: Readonly<Record<string, number>>;
}

/** 운영 컨테이너(512MB, 힙 384MiB, 풀 10) 기준. 넘으면 OperationalAlertPort로 올린다. */
export const RUNTIME_THRESHOLDS = {
  poolWaitingSustainedMs: 30_000,
  eventLoopDelayP99Ms: 200,
  heapUsedRatio: 0.85,
} as const;

export const RUNTIME_STATS_INTERVAL_MS = 60_000;

/**
 * 표본 하나로 경보할 포화를 고른다. 풀 대기는 순간 값이 흔하므로 처음 보인 시각을 이어 받아
 * 기준 시간 넘게 이어질 때만 경보한다.
 */
export function evaluateRuntimeSample(
  sample: RuntimeSample,
  previous: { readonly poolWaitingSinceMs: number | null },
): { readonly breaches: RuntimeBreach[]; readonly poolWaitingSinceMs: number | null } {
  const waitingCount = sample.pool?.waitingCount ?? 0;
  const poolWaitingSinceMs =
    waitingCount > 0 ? (previous.poolWaitingSinceMs ?? sample.sampledAtMs) : null;
  const heapUsedRatio = sample.heapUsedBytes / sample.heapLimitBytes;
  const breaches: RuntimeBreach[] = [];

  if (
    poolWaitingSinceMs != null &&
    sample.sampledAtMs - poolWaitingSinceMs >= RUNTIME_THRESHOLDS.poolWaitingSustainedMs
  ) {
    breaches.push({
      kind: "pool-waiting",
      details: { waitingCount, waitingForMs: sample.sampledAtMs - poolWaitingSinceMs },
    });
  }
  if (sample.eventLoopDelayP99Ms > RUNTIME_THRESHOLDS.eventLoopDelayP99Ms) {
    breaches.push({
      kind: "event-loop-delay",
      details: { eventLoopDelayP99Ms: sample.eventLoopDelayP99Ms },
    });
  }
  if (heapUsedRatio > RUNTIME_THRESHOLDS.heapUsedRatio) {
    breaches.push({
      kind: "heap-usage",
      details: { heapUsedBytes: sample.heapUsedBytes, heapLimitBytes: sample.heapLimitBytes },
    });
  }
  return { breaches, poolWaitingSinceMs };
}

/** 직전 표본에서 이미 넘어 있던 종류는 빼고 이번에 새로 넘은 것만 고른다. 넘은 상태가 이어져도 경보는 한 번이다. */
export function newlyBreached(
  previous: ReadonlySet<RuntimeBreachKind>,
  breaches: readonly RuntimeBreach[],
): RuntimeBreach[] {
  return breaches.filter((breach) => !previous.has(breach.kind));
}
