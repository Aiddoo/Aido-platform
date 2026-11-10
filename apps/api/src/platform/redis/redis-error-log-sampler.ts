import type { Logger } from "@nestjs/common";

import { PlatformLogEvent } from "#api/platform/logging/platform.log-events";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

/**
 * Redis 에러 로그 샘플러
 *
 * fail-fast 클라이언트는 Redis 장애 중 요청마다 즉시 에러를 내므로,
 * 어댑터가 에러를 그대로 로깅하면 로그가 폭발한다. 윈도우(기본 30초)당
 * 1회만 warn을 남기고 나머지는 억제 카운트로 집계해 다음 로그의
 * `suppressed`로 남긴다.
 */
export class RedisErrorLogSampler {
  readonly #logger: Pick<Logger, "warn">;
  readonly #intervalMs: number;
  #windowStartedAt = Number.NEGATIVE_INFINITY;
  #suppressed = 0;

  constructor(logger: Pick<Logger, "warn">, intervalMs = 30_000) {
    this.#logger = logger;
    this.#intervalMs = intervalMs;
  }

  warn(operation: string, error: unknown): void {
    const now = Date.now();

    if (now - this.#windowStartedAt < this.#intervalMs) {
      this.#suppressed++;
      return;
    }

    const code: unknown = Reflect.get(Object(error), "code");
    this.#logger.warn({
      event: PlatformLogEvent.REDIS_OPERATION_FAILED,
      operation,
      errorType: toErrorType(error),
      ...(typeof code === "string" && { networkCode: code }),
      suppressed: this.#suppressed,
    });
    this.#windowStartedAt = now;
    this.#suppressed = 0;
  }
}
