import type { OnModuleDestroy } from "@nestjs/common";
import type { IPushRateLimiter } from "../../application/ports/push-rate-limiter.port";

/** 1시간 윈도우 내 최대 푸시 횟수 */
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 15;
const ENGAGEMENT_MIN_INTERVAL_MS = 4 * 60 * 60 * 1000;
const ENGAGEMENT_DAILY_MAX = 2;
const ENGAGEMENT_RETENTION_MS = 48 * 60 * 60 * 1000;

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
	private readonly engagementTimestamps = new Map<string, number[]>();
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

	async isEngagementRateLimited(
		userId: string,
		localDate: string,
	): Promise<boolean> {
		const key = `${userId}:${localDate}`;
		const now = Date.now();
		const timestamps = this.engagementTimestamps.get(key) ?? [];
		const last = timestamps.at(-1);
		if (
			timestamps.length >= ENGAGEMENT_DAILY_MAX ||
			(last !== undefined && now - last < ENGAGEMENT_MIN_INTERVAL_MS)
		) {
			return true;
		}
		timestamps.push(now);
		this.engagementTimestamps.set(key, timestamps);
		return false;
	}

	onModuleDestroy(): void {
		this.destroy();
	}

	destroy(): void {
		clearInterval(this.#cleanupInterval);
		this.pushTimestamps.clear();
		this.engagementTimestamps.clear();
	}

	#cleanup(): void {
		const currentTime = Date.now();
		const windowStart = currentTime - RATE_LIMIT_WINDOW_MS;

		for (const [userId, timestamps] of this.pushTimestamps.entries()) {
			const filtered = timestamps.filter((t) => t > windowStart);

			if (filtered.length === 0) {
				this.pushTimestamps.delete(userId);
			} else {
				this.pushTimestamps.set(userId, filtered);
			}
		}

		const engagementCutoff = currentTime - ENGAGEMENT_RETENTION_MS;
		for (const [key, timestamps] of this.engagementTimestamps.entries()) {
			if ((timestamps.at(-1) ?? 0) < engagementCutoff) {
				this.engagementTimestamps.delete(key);
			}
		}
	}
}
