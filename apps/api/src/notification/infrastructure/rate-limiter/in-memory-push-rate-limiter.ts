import type { OnModuleDestroy } from "@nestjs/common";

import type {
	EngagementPushRateLimitRequest,
	GeneralPushRateLimitRequest,
	PushRateLimitRequest,
	PushRateLimiterPort,
} from "../../application/ports/push-rate-limiter.port";
import { PUSH_RATE_LIMIT_POLICY } from "../../domain/services/push-rate-limit-policy";

const { GENERAL, ENGAGEMENT } = PUSH_RATE_LIMIT_POLICY;

interface LegacyPushRateLimitRequest {
	readonly userId: string;
	readonly reservationId?: string;
	readonly engagementLocalDate?: string;
}

/**
 * 인메모리 푸시 Rate Limiter
 *
 * - 단일 인스턴스 개발/테스트 환경용
 * - Map 기반 슬라이딩 윈도우
 * - RATE_LIMIT_WINDOW_MS 주기로 zombie 엔트리 자동 정리
 */
export class InMemoryPushRateLimiter implements PushRateLimiterPort, OnModuleDestroy {
	private readonly pushTimestamps = new Map<string, number[]>();
	private readonly engagementTimestamps = new Map<string, number[]>();
	private readonly generalReservations = new Map<string, Map<string, number>>();
	private readonly engagementReservations = new Map<string, Map<string, number>>();
	readonly #cleanupInterval: NodeJS.Timeout;

	constructor() {
		this.#cleanupInterval = setInterval(() => this.#cleanup(), GENERAL.WINDOW_MS);
	}

	async reserveGeneral(request: GeneralPushRateLimitRequest): Promise<boolean> {
		return this.#reserveGeneral(request.userId, this.#reservationId(request.dispatchId));
	}

	/** @deprecated 테스트 호환 전용. 애플리케이션 포트에서는 dispatchId 기반 API를 사용한다. */
	async isRateLimited(userId: string, reservationId?: string): Promise<boolean> {
		return this.#reserveGeneral(userId, reservationId);
	}

	async #reserveGeneral(userId: string, reservationId?: string): Promise<boolean> {
		const now = Date.now();
		const windowStart = now - GENERAL.WINDOW_MS;
		if (
			reservationId &&
			this.#hasReservation(this.generalReservations, userId, reservationId, now)
		) {
			return false;
		}

		let timestamps = this.pushTimestamps.get(userId);
		if (!timestamps) {
			timestamps = [];
			this.pushTimestamps.set(userId, timestamps);
		}

		// 윈도우 밖 타임스탬프 제거
		const filtered = timestamps.filter((t) => t > windowStart);
		this.pushTimestamps.set(userId, filtered);

		if (filtered.length >= GENERAL.MAX) {
			return true;
		}

		filtered.push(now);
		if (reservationId) {
			this.#saveReservation(
				this.generalReservations,
				userId,
				reservationId,
				now + ENGAGEMENT.RETENTION_MS,
			);
		}
		return false;
	}

	async reserveEngagement(request: EngagementPushRateLimitRequest): Promise<boolean> {
		return this.#reserveEngagement(
			request.userId,
			request.localDate,
			this.#reservationId(request.dispatchId),
		);
	}

	/** @deprecated 테스트 호환 전용. 애플리케이션 포트에서는 dispatchId 기반 API를 사용한다. */
	async isEngagementRateLimited(
		userId: string,
		localDate: string,
		reservationId?: string,
	): Promise<boolean> {
		return this.#reserveEngagement(userId, localDate, reservationId);
	}

	async #reserveEngagement(
		userId: string,
		localDate: string,
		reservationId?: string,
	): Promise<boolean> {
		const key = `${userId}:${localDate}`;
		const now = Date.now();
		if (
			reservationId &&
			this.#hasReservation(this.engagementReservations, userId, reservationId, now)
		) {
			return false;
		}
		const timestamps = this.engagementTimestamps.get(key) ?? [];
		const last = timestamps.at(-1);
		if (
			timestamps.length >= ENGAGEMENT.DAILY_MAX ||
			(last !== undefined && now - last < ENGAGEMENT.MIN_INTERVAL_MS)
		) {
			return true;
		}
		timestamps.push(now);
		this.engagementTimestamps.set(key, timestamps);
		if (reservationId) {
			this.#saveReservation(
				this.engagementReservations,
				userId,
				reservationId,
				now + ENGAGEMENT.RETENTION_MS,
			);
		}
		return false;
	}

	async reserveBatch(
		requests: readonly (PushRateLimitRequest | LegacyPushRateLimitRequest)[],
	): Promise<readonly boolean[]> {
		const results: boolean[] = [];
		for (const request of requests) {
			const now = Date.now();
			const reservationId =
				"dispatchId" in request ? this.#reservationId(request.dispatchId) : request.reservationId;
			const engagementKey = request.engagementLocalDate
				? `${request.userId}:${request.engagementLocalDate}`
				: null;
			const generalReserved =
				reservationId !== undefined &&
				this.#hasReservation(this.generalReservations, request.userId, reservationId, now);
			const engagementReserved =
				engagementKey === null ||
				(reservationId !== undefined &&
					this.#hasReservation(this.engagementReservations, request.userId, reservationId, now));

			const generalTimestamps = (this.pushTimestamps.get(request.userId) ?? []).filter(
				(timestamp) => timestamp > now - GENERAL.WINDOW_MS,
			);
			this.pushTimestamps.set(request.userId, generalTimestamps);
			if (!generalReserved && generalTimestamps.length >= GENERAL.MAX) {
				results.push(true);
				continue;
			}

			const engagementTimestamps = engagementKey
				? (this.engagementTimestamps.get(engagementKey) ?? [])
				: [];
			const lastEngagement = engagementTimestamps.at(-1);
			const engagementLimited =
				engagementKey !== null &&
				!engagementReserved &&
				(engagementTimestamps.length >= ENGAGEMENT.DAILY_MAX ||
					(lastEngagement !== undefined && now - lastEngagement < ENGAGEMENT.MIN_INTERVAL_MS));
			if (engagementLimited) {
				results.push(true);
				continue;
			}

			if (!generalReserved) generalTimestamps.push(now);
			if (engagementKey && !engagementReserved) {
				engagementTimestamps.push(now);
				this.engagementTimestamps.set(engagementKey, engagementTimestamps);
			}
			if (!generalReserved && reservationId !== undefined) {
				this.#saveReservation(
					this.generalReservations,
					request.userId,
					reservationId,
					now + ENGAGEMENT.RETENTION_MS,
				);
			}
			if (engagementKey && !engagementReserved && reservationId !== undefined) {
				this.#saveReservation(
					this.engagementReservations,
					request.userId,
					reservationId,
					now + ENGAGEMENT.RETENTION_MS,
				);
			}
			results.push(false);
		}
		return results;
	}

	onModuleDestroy(): void {
		this.destroy();
	}

	destroy(): void {
		clearInterval(this.#cleanupInterval);
		this.pushTimestamps.clear();
		this.engagementTimestamps.clear();
		this.generalReservations.clear();
		this.engagementReservations.clear();
	}

	#cleanup(): void {
		const currentTime = Date.now();
		const windowStart = currentTime - GENERAL.WINDOW_MS;

		for (const [userId, timestamps] of this.pushTimestamps.entries()) {
			const filtered = timestamps.filter((t) => t > windowStart);

			if (filtered.length === 0) {
				this.pushTimestamps.delete(userId);
			} else {
				this.pushTimestamps.set(userId, filtered);
			}
		}

		const engagementCutoff = currentTime - ENGAGEMENT.RETENTION_MS;
		for (const [key, timestamps] of this.engagementTimestamps.entries()) {
			if ((timestamps.at(-1) ?? 0) < engagementCutoff) {
				this.engagementTimestamps.delete(key);
			}
		}
		this.#removeExpiredReservations(this.generalReservations, currentTime);
		this.#removeExpiredReservations(this.engagementReservations, currentTime);
	}

	#hasReservation(
		reservations: Map<string, Map<string, number>>,
		key: string,
		reservationId: string,
		now: number,
	): boolean {
		const expiresAt = reservations.get(key)?.get(reservationId);
		return expiresAt !== undefined && expiresAt > now;
	}

	#saveReservation(
		reservations: Map<string, Map<string, number>>,
		key: string,
		reservationId: string,
		expiresAt: number,
	): void {
		const values = reservations.get(key) ?? new Map<string, number>();
		values.set(reservationId, expiresAt);
		reservations.set(key, values);
	}

	#removeExpiredReservations(reservations: Map<string, Map<string, number>>, now: number): void {
		for (const [key, values] of reservations) {
			for (const [reservationId, expiresAt] of values) {
				if (expiresAt <= now) values.delete(reservationId);
			}
			if (values.size === 0) reservations.delete(key);
		}
	}

	#reservationId(dispatchId: number): string {
		return `push-dispatch-${dispatchId}`;
	}
}
