import type { IPushRateLimiter } from "./push-rate-limiter.interface";

/** 1시간 윈도우 내 최대 푸시 횟수 */
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 15;

/**
 * 인메모리 푸시 Rate Limiter
 *
 * - 단일 인스턴스 개발/테스트 환경용
 * - Map 기반 슬라이딩 윈도우
 */
export class InMemoryPushRateLimiter implements IPushRateLimiter {
	private readonly pushTimestamps = new Map<string, number[]>();

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

	destroy(): void {
		this.pushTimestamps.clear();
	}
}
