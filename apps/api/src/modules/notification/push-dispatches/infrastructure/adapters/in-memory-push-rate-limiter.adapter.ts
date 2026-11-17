import { LRUCache } from "lru-cache";

import type {
  EngagementPushRateLimitRequest,
  GeneralPushRateLimitRequest,
  PushRateLimitRequest,
  PushRateLimiterPort,
} from "../../application/ports/push-rate-limiter.port.js";
import { PUSH_RATE_LIMIT_POLICY } from "../../domain/push-rate-limit.constants.js";

const { GENERAL, ENGAGEMENT } = PUSH_RATE_LIMIT_POLICY;

// 저장소마다의 키 상한. 넘치면 가장 오래 안 쓴 사용자의 기록을 잊어 그 사용자에게 한도를 한 번 더 허용할 뿐이다
export const PUSH_RATE_LIMIT_MAX_ENTRIES = 10_000;

function createWindowStore<V extends object | number>(ttlMs: number): LRUCache<string, V> {
  return new LRUCache<string, V>({
    max: PUSH_RATE_LIMIT_MAX_ENTRIES,
    ttl: ttlMs,
    // 만료를 Date.now로 재서 테스트의 가짜 시계(setSystemTime)를 그대로 따른다
    perf: { now: () => Date.now() },
    ttlResolution: 0,
  });
}

/**
 * 인메모리 푸시 Rate Limiter
 *
 * - 단일 인스턴스 개발/테스트 환경용
 * - 슬라이딩 윈도우와 dispatch 예약을 lru-cache에 두고, 창이 지난 키는 읽을 때 지운다
 */
export class InMemoryPushRateLimiterAdapter implements PushRateLimiterPort {
  /** userId → 일반 발송 시각. 마지막 기록 뒤 한 시간이 지나면 창 안에 남은 시각이 없다 */
  readonly #pushTimestamps = createWindowStore<number[]>(GENERAL.WINDOW_MS);
  /** `${userId}:${localDate}` → 참여 유도 발송 시각 */
  readonly #engagementTimestamps = createWindowStore<number[]>(ENGAGEMENT.RETENTION_MS);
  /** `${userId}:${reservationId}` → 예약 만료 시각 */
  readonly #generalReservations = createWindowStore<number>(ENGAGEMENT.RETENTION_MS);
  readonly #engagementReservations = createWindowStore<number>(ENGAGEMENT.RETENTION_MS);

  async reserveGeneral(request: GeneralPushRateLimitRequest): Promise<boolean> {
    return this.#reserveGeneral(request.userId, this.#reservationId(request.dispatchId));
  }

  async #reserveGeneral(userId: string, reservationId: string): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - GENERAL.WINDOW_MS;
    if (this.#hasReservation(this.#generalReservations, userId, reservationId, now)) {
      return false;
    }

    const filtered = (this.#pushTimestamps.get(userId) ?? []).filter((t) => t > windowStart);
    this.#pushTimestamps.set(userId, filtered);

    if (filtered.length >= GENERAL.MAX) {
      return true;
    }

    filtered.push(now);
    this.#saveReservation(
      this.#generalReservations,
      userId,
      reservationId,
      now + ENGAGEMENT.RETENTION_MS,
    );
    return false;
  }

  async reserveEngagement(request: EngagementPushRateLimitRequest): Promise<boolean> {
    return this.#reserveEngagement(
      request.userId,
      request.localDate,
      this.#reservationId(request.dispatchId),
    );
  }

  async #reserveEngagement(
    userId: string,
    localDate: string,
    reservationId: string,
  ): Promise<boolean> {
    const key = `${userId}:${localDate}`;
    const now = Date.now();
    if (this.#hasReservation(this.#engagementReservations, userId, reservationId, now)) {
      return false;
    }
    const timestamps = this.#engagementTimestamps.get(key) ?? [];
    const last = timestamps.at(-1);
    if (
      timestamps.length >= ENGAGEMENT.DAILY_MAX ||
      (last != null && now - last < ENGAGEMENT.MIN_INTERVAL_MS)
    ) {
      return true;
    }
    timestamps.push(now);
    this.#engagementTimestamps.set(key, timestamps);
    this.#saveReservation(
      this.#engagementReservations,
      userId,
      reservationId,
      now + ENGAGEMENT.RETENTION_MS,
    );
    return false;
  }

  async reserveBatch(requests: readonly PushRateLimitRequest[]): Promise<readonly boolean[]> {
    const results: boolean[] = [];
    for (const request of requests) {
      const now = Date.now();
      const reservationId = this.#reservationId(request.dispatchId);
      const engagementKey = request.engagementLocalDate
        ? `${request.userId}:${request.engagementLocalDate}`
        : null;
      const generalReserved = this.#hasReservation(
        this.#generalReservations,
        request.userId,
        reservationId,
        now,
      );
      const engagementReserved =
        engagementKey == null ||
        this.#hasReservation(this.#engagementReservations, request.userId, reservationId, now);

      const generalTimestamps = (this.#pushTimestamps.get(request.userId) ?? []).filter(
        (timestamp) => timestamp > now - GENERAL.WINDOW_MS,
      );
      this.#pushTimestamps.set(request.userId, generalTimestamps);
      if (!generalReserved && generalTimestamps.length >= GENERAL.MAX) {
        results.push(true);
        continue;
      }

      const engagementTimestamps = engagementKey
        ? (this.#engagementTimestamps.get(engagementKey) ?? [])
        : [];
      const lastEngagement = engagementTimestamps.at(-1);
      const engagementLimited =
        engagementKey != null &&
        !engagementReserved &&
        (engagementTimestamps.length >= ENGAGEMENT.DAILY_MAX ||
          (lastEngagement != null && now - lastEngagement < ENGAGEMENT.MIN_INTERVAL_MS));
      if (engagementLimited) {
        results.push(true);
        continue;
      }

      if (!generalReserved) {
        generalTimestamps.push(now);
      }
      if (engagementKey && !engagementReserved) {
        engagementTimestamps.push(now);
        this.#engagementTimestamps.set(engagementKey, engagementTimestamps);
      }
      if (!generalReserved) {
        this.#saveReservation(
          this.#generalReservations,
          request.userId,
          reservationId,
          now + ENGAGEMENT.RETENTION_MS,
        );
      }
      if (engagementKey && !engagementReserved) {
        this.#saveReservation(
          this.#engagementReservations,
          request.userId,
          reservationId,
          now + ENGAGEMENT.RETENTION_MS,
        );
      }
      results.push(false);
    }
    return results;
  }

  #hasReservation(
    reservations: LRUCache<string, number>,
    userId: string,
    reservationId: string,
    now: number,
  ): boolean {
    const expiresAt = reservations.get(`${userId}:${reservationId}`);
    return expiresAt != null && expiresAt > now;
  }

  #saveReservation(
    reservations: LRUCache<string, number>,
    userId: string,
    reservationId: string,
    expiresAt: number,
  ): void {
    reservations.set(`${userId}:${reservationId}`, expiresAt);
  }

  #reservationId(dispatchId: number): string {
    return `push-dispatch-${dispatchId}`;
  }
}
