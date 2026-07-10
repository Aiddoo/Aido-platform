import type { Logger } from "@nestjs/common";

/**
 * Redis 에러 로그 샘플러
 *
 * fail-fast 클라이언트는 Redis 장애 중 요청마다 즉시 에러를 내므로,
 * 어댑터가 에러를 그대로 로깅하면 로그가 폭발한다. 윈도우(기본 30초)당
 * 1회만 warn을 남기고 나머지는 억제 카운트로 집계해 다음 로그에
 * `(+N suppressed)`로 덧붙인다.
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

		const suffix =
			this.#suppressed > 0 ? ` (+${this.#suppressed} suppressed)` : "";
		this.#logger.warn(
			`Redis ${operation} failed (fail-open): ${toMessage(error)}${suffix}`,
		);
		this.#windowStartedAt = now;
		this.#suppressed = 0;
	}
}

function toMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
