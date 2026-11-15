import type { Logger } from "@nestjs/common";

import { PlatformLogEvent } from "#api/platform/logging/platform.log-events";

// DB가 끊기면 큐 워커마다 폴링 주기로 같은 연결 오류를 낸다(2026-11-16 RDS 점검 2분에 약 700줄).
// 창마다 한 번만 남기고 나머지는 다음 로그의 `suppressed`로 센다.
export class PgBossErrorLogSampler {
  readonly #logger: Pick<Logger, "error">;
  readonly #intervalMs: number;
  #windowStartedAt = Number.NEGATIVE_INFINITY;
  #suppressed = 0;

  constructor(logger: Pick<Logger, "error">, intervalMs = 30_000) {
    this.#logger = logger;
    this.#intervalMs = intervalMs;
  }

  error(error: unknown): void {
    const now = Date.now();
    if (now - this.#windowStartedAt < this.#intervalMs) {
      this.#suppressed++;
      return;
    }
    this.#logger.error({
      event: PlatformLogEvent.JOB_RUNTIME_ERRORED,
      backend: "postgres",
      ...describeRuntimeError(error),
      suppressed: this.#suppressed,
    });
    this.#windowStartedAt = now;
    this.#suppressed = 0;
  }
}

// 워커 오류는 pg-boss가 Error를 일반 객체로 펼쳐 넘겨 name이 빠진다. message에는 DB 주소가 있어 남기지 않는다
function describeRuntimeError(error: unknown) {
  const source: object = Object(error);
  const name: unknown = Reflect.get(source, "name");
  const code: unknown = Reflect.get(source, "code");
  const queue: unknown = Reflect.get(source, "queue");
  // PostgreSQL이 보낸 오류만 severity가 있고 그 code는 SQLSTATE다. 나머지 code는 Node 네트워크 오류다
  const isServerError = typeof Reflect.get(source, "severity") === "string";
  return {
    errorType: typeof name === "string" ? name : "UnknownError",
    ...(typeof code === "string" && isServerError && { sqlState: code }),
    ...(typeof code === "string" && !isServerError && { networkCode: code }),
    ...(typeof queue === "string" && { queue }),
  };
}
