export type TestStateResetter = () => Promise<unknown> | unknown;

const RESETTER_TIMEOUT_MS = 20_000;

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function withDeadline(
  label: string,
  resetter: TestStateResetter,
  timeoutMs: number,
): TestStateResetter {
  return async () => {
    let expire: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
      expire = setTimeout(() => {
        reject(new Error(`[e2e-reset] ${label}가 ${timeoutMs}ms를 넘겼다`));
      }, timeoutMs);
      expire.unref?.();
    });

    try {
      return await Promise.race([Promise.resolve(resetter()), deadline]);
    } finally {
      clearTimeout(expire);
    }
  };
}

interface E2eTestStateDependencies {
  drainBackgroundWork?: TestStateResetter;
  cleanupDatabase: TestStateResetter;
  resetCache: TestStateResetter;
  flushRedis: TestStateResetter;
  sharedResetters: readonly TestStateResetter[];
  additionalResetters?: readonly TestStateResetter[];
  /** 단계별 시간 상한. 이 계약을 검증하는 테스트가 짧게 좁혀 쓴다. */
  timeoutMs?: number;
}

export function createE2eTestStateResetter({
  drainBackgroundWork,
  cleanupDatabase,
  resetCache,
  flushRedis,
  sharedResetters,
  additionalResetters = [],
  timeoutMs = RESETTER_TIMEOUT_MS,
}: E2eTestStateDependencies): () => Promise<void> {
  const named = (label: string, resetter: TestStateResetter) =>
    withDeadline(label, resetter, timeoutMs);
  const nonDatabaseResetters = [
    named("resetCache", resetCache),
    named("flushRedis", flushRedis),
    ...sharedResetters.map((resetter, index) => named(`sharedResetters[${index}]`, resetter)),
    ...additionalResetters.map((resetter, index) =>
      named(`additionalResetters[${index}]`, resetter),
    ),
  ];
  const drain = drainBackgroundWork ? named("drainBackgroundWork", drainBackgroundWork) : undefined;

  let failedReset: AggregateError | undefined;
  return async () => {
    if (failedReset) throw failedReset;
    const errors: Error[] = [];
    if (drain) {
      try {
        await drain();
      } catch (error) {
        errors.push(normalizeError(error));
      }
    }

    // drain 실패 여부와 무관하게 DB는 항상 정리한다 — TRUNCATE를 건너뛰면
    // 오염이 다음 테스트로 전파되어 실패가 연쇄된다. drain 에러는 아래
    // AggregateError로 함께 보고되므로 은폐되지 않는다.
    const resetters = [named("cleanupDatabase", cleanupDatabase), ...nonDatabaseResetters];
    const results = await Promise.allSettled(resetters.map(async (resetter) => resetter()));
    errors.push(
      ...results.flatMap((result) =>
        result.status === "rejected" ? [normalizeError(result.reason)] : [],
      ),
    );

    if (errors.length > 0) {
      // A timed-out task can still mutate state; prevent subsequent tests from sharing it.
      failedReset = new AggregateError(errors, "Failed to reset E2E test state");
      throw failedReset;
    }
  };
}
