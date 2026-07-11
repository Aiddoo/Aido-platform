import type { OnModuleDestroy } from "@nestjs/common";
import type { IPushRateLimiter } from "../../application/ports/push-rate-limiter.port";

/** 1시간 윈도우 내 최대 푸시 횟수 */
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 15;

/**
 * 인메모리 푸시 Rate Limiter
 *
 * - 단일 인스턴스 개발/테스트 환경용
 * - Map 기반 슬라이딩 윈도우
 * - RATE_LIMIT_WINDOW_MS 주기로 zombie 엔트리 자동 정리
 */
export class InMemoryPushRateLimiter
	implements IPushRateLimiter, OnModuleDestroy
{
	private readonly pushTimestamps = new Map<string, number[]>();
	readonly #cleanupInterval: NodeJS.Timeout;

	constructor() {
		this.#cleanupInterval = setInterval(
			() => this.#cleanup(),
			RATE_LIMIT_WINDOW_MS,
		);
	}

	async isRateLimited(userId: string): Promise<boolean> {
		const now = Date.now();
		const windowStart = now - RATE_LIMIT_WINDOW_MS;

		let timestamps = this.pushTimestamps.get(userId);
		if (!timestamps) {
			timestamps = [];
			this.pushTimestamps.set(userId, timestamps);
		}

		// 윈도우 밖 타임스탬프 제거
		const filtered = timestamps.filter((t) => t > windowStart);
		this.pushTimestamps.set(userId, filtered);

		if (filtered.length >= RATE_LIMIT_MAX) {
			return true;
		}

		filtered.push(now);
		return false;
	}

	onModuleDestroy(): void {
		this.destroy();
	}

	destroy(): void {
		clearInterval(this.#cleanupInterval);
		this.pushTimestamps.clear();
	}

	#cleanup(): void {
		const windowStart = Date.now() - RATE_LIMIT_WINDOW_MS;

		for (const [userId, timestamps] of this.pushTimestamps.entries()) {
			const filtered = timestamps.filter((t) => t > windowStart);

			if (filtered.length === 0) {
				this.pushTimestamps.delete(userId);
			} else {
				this.pushTimestamps.set(userId, filtered);
			}
		}
	}
}
