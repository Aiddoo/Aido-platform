import { Inject, Injectable } from "@nestjs/common";
import { and, count, eq, gt, inArray, max } from "drizzle-orm";
import { retry } from "es-toolkit";

import { isTransactionWriteConflict } from "#api/platform/database/database-error.util";
import { DRIZZLE, type Database } from "#api/platform/database/database.client";
import { pushDispatch, pushRateLimitReservation } from "#api/platform/database/schema/index";
import { toDateString } from "#api/shared/domain/date/utils/format";

import type {
  EngagementPushRateLimitRequest,
  GeneralPushRateLimitRequest,
  PushRateLimitRequest,
  PushRateLimiterPort,
} from "../../application/ports/push-rate-limiter.port.js";
import { PUSH_RATE_LIMIT_POLICY } from "../../domain/push-rate-limit.constants.js";

type PushRateLimitPhase = typeof pushRateLimitReservation.$inferSelect.phase;

const { GENERAL, ENGAGEMENT } = PUSH_RATE_LIMIT_POLICY;
const MAX_TRANSACTION_ATTEMPTS = 5;
/**
 * Serializable 충돌 재시도 대기의 기준값. 시도마다 두 배로 늘린다.
 * 충돌 상대가 커밋하기 전에 즉시 재시도하면 같은 snapshot에서 같은 pivot 충돌이 반복되므로,
 * 상대 트랜잭션이 끝날 시간을 준 뒤 새 snapshot으로 다시 판정한다.
 */
const TRANSACTION_RETRY_BASE_DELAY_MS = 20;

/**
 * n번째 실패 뒤 다음 시도까지 기다릴 시간(equal jitter 지수 백오프).
 * 절반은 고정해 최소 대기를 보장하고, 나머지 절반은 무작위로 둬 경합자끼리 같은 박자로 재충돌하지 않게 한다.
 */
export function transactionRetryDelayMs(failedAttempt: number, random: () => number): number {
  const ceiling = TRANSACTION_RETRY_BASE_DELAY_MS * 2 ** (failedAttempt - 1);
  return ceiling / 2 + (ceiling / 2) * random();
}

interface ReservationRequest extends PushRateLimitRequest {
  readonly reserveGeneral: boolean;
}

interface ReservationRecord {
  readonly dispatchId: number;
  readonly phase: PushRateLimitPhase;
  readonly userId: string;
  readonly localDate: Date | null;
}

/** Drizzle ORM과 Serializable 트랜잭션으로 구현한 영속 푸시 rate limiter. */
@Injectable()
export class PostgresPushRateLimiterAdapter implements PushRateLimiterPort {
  readonly #db: Database;

  constructor(@Inject(DRIZZLE) db: Database) {
    this.#db = db;
  }

  async reserveGeneral(request: GeneralPushRateLimitRequest): Promise<boolean> {
    const [limited] = await this.#reserve([{ ...request, reserveGeneral: true }]);
    return this.#requiredDecision(limited, request.dispatchId);
  }

  async reserveEngagement(request: EngagementPushRateLimitRequest): Promise<boolean> {
    const [limited] = await this.#reserve([
      {
        dispatchId: request.dispatchId,
        userId: request.userId,
        reserveGeneral: false,
        engagementLocalDate: request.localDate,
      },
    ]);
    return this.#requiredDecision(limited, request.dispatchId);
  }

  async reserveBatch(requests: readonly PushRateLimitRequest[]): Promise<readonly boolean[]> {
    return this.#reserve(requests.map((request) => ({ ...request, reserveGeneral: true })));
  }

  async #reserve(requests: readonly ReservationRequest[]): Promise<readonly boolean[]> {
    if (requests.length === 0) {
      return [];
    }
    this.#assertRequests(requests);
    return retry(
      () =>
        this.#db.transaction(
          async (transaction) => {
            const dispatchIds = requests.map((request) => request.dispatchId);
            const userIds = requests.map((request) => request.userId);
            const generalWindowStart = new Date(Date.now() - GENERAL.WINDOW_MS);
            const engagementDates = requests.flatMap((request) =>
              request.engagementLocalDate != null
                ? [this.#toDate(request.engagementLocalDate)]
                : [],
            );
            const dispatches = await transaction
              .select({ id: pushDispatch.id, userId: pushDispatch.userId })
              .from(pushDispatch)
              .where(inArray(pushDispatch.id, dispatchIds));
            const existing = await transaction
              .select({
                dispatchId: pushRateLimitReservation.dispatchId,
                phase: pushRateLimitReservation.phase,
              })
              .from(pushRateLimitReservation)
              .where(inArray(pushRateLimitReservation.dispatchId, dispatchIds));
            const generalStats = await transaction
              .select({ userId: pushRateLimitReservation.userId, count: count() })
              .from(pushRateLimitReservation)
              .where(
                and(
                  eq(pushRateLimitReservation.phase, "GENERAL"),
                  inArray(pushRateLimitReservation.userId, userIds),
                  gt(pushRateLimitReservation.reservedAt, generalWindowStart),
                ),
              )
              .groupBy(pushRateLimitReservation.userId);
            const engagementStats = await transaction
              .select({
                userId: pushRateLimitReservation.userId,
                localDate: pushRateLimitReservation.localDate,
                count: count(),
                lastReservedAt: max(pushRateLimitReservation.reservedAt),
              })
              .from(pushRateLimitReservation)
              .where(
                and(
                  eq(pushRateLimitReservation.phase, "ENGAGEMENT"),
                  inArray(pushRateLimitReservation.userId, userIds),
                  inArray(pushRateLimitReservation.localDate, engagementDates),
                ),
              )
              .groupBy(pushRateLimitReservation.userId, pushRateLimitReservation.localDate);
            this.#assertDispatchOwnership(requests, dispatches);
            const decisions = this.#decide(requests, existing, generalStats, engagementStats);
            if (decisions.reservations.length > 0) {
              await transaction
                .insert(pushRateLimitReservation)
                .values([...decisions.reservations]);
            }
            return decisions.limited;
          },
          { isolationLevel: "serializable" },
        ),
      {
        retries: MAX_TRANSACTION_ATTEMPTS - 1,
        shouldRetry: (error) => isTransactionWriteConflict(error),
        delay: (failedAttempts) => transactionRetryDelayMs(failedAttempts + 1, Math.random),
      },
    );
  }

  #decide(
    requests: readonly ReservationRequest[],
    existing: readonly { dispatchId: number; phase: PushRateLimitPhase }[],
    generalStats: readonly { userId: string; count: number }[],
    engagementStats: readonly {
      userId: string;
      localDate: Date | null;
      count: number;
      lastReservedAt: Date | null;
    }[],
  ): { readonly limited: readonly boolean[]; readonly reservations: readonly ReservationRecord[] } {
    const existingKeys = new Set(existing.map(({ dispatchId, phase }) => `${dispatchId}:${phase}`));
    const generalByUser = new Map(generalStats.map((row) => [row.userId, row.count]));
    const engagementByUserDate = new Map(
      engagementStats.map((row) => [
        this.#engagementKey(row.userId, row.localDate),
        { count: row.count, lastReservedAt: row.lastReservedAt },
      ]),
    );
    const reservations: ReservationRecord[] = [];
    const now = Date.now();
    const limited = requests.map((request) => {
      const generalReserved = existingKeys.has(`${request.dispatchId}:GENERAL`);
      const engagementReserved = existingKeys.has(`${request.dispatchId}:ENGAGEMENT`);
      const localDate = request.engagementLocalDate
        ? this.#toDate(request.engagementLocalDate)
        : null;
      const engagement = localDate
        ? engagementByUserDate.get(this.#engagementKey(request.userId, localDate))
        : undefined;
      const isLimited =
        (request.reserveGeneral &&
          !generalReserved &&
          (generalByUser.get(request.userId) ?? 0) >= GENERAL.MAX) ||
        (localDate != null &&
          !engagementReserved &&
          ((engagement?.count ?? 0) >= ENGAGEMENT.DAILY_MAX ||
            (engagement?.lastReservedAt != null &&
              now - engagement.lastReservedAt.getTime() < ENGAGEMENT.MIN_INTERVAL_MS)));
      if (isLimited) {
        return true;
      }

      if (request.reserveGeneral && !generalReserved) {
        reservations.push({
          dispatchId: request.dispatchId,
          phase: "GENERAL",
          userId: request.userId,
          localDate: null,
        });
      }
      if (localDate && !engagementReserved) {
        reservations.push({
          dispatchId: request.dispatchId,
          phase: "ENGAGEMENT",
          userId: request.userId,
          localDate,
        });
      }
      return false;
    });
    return { limited, reservations };
  }

  #assertRequests(requests: readonly ReservationRequest[]): void {
    const dispatchIds = new Set<number>();
    const userIds = new Set<string>();
    for (const request of requests) {
      if (!Number.isSafeInteger(request.dispatchId) || request.dispatchId <= 0) {
        throw new Error(`Invalid push dispatch id: ${request.dispatchId}`);
      }
      if (request.userId.length === 0) {
        throw new Error("Push rate limit user id is required");
      }
      if (dispatchIds.has(request.dispatchId)) {
        throw new Error(`Duplicate push dispatch id: ${request.dispatchId}`);
      }
      if (userIds.has(request.userId)) {
        throw new Error(`Duplicate push rate limit user in batch: ${request.userId}`);
      }
      dispatchIds.add(request.dispatchId);
      userIds.add(request.userId);
    }
  }

  #assertDispatchOwnership(
    requests: readonly ReservationRequest[],
    dispatches: readonly { id: number; userId: string }[],
  ): void {
    const ownerByDispatchId = new Map(dispatches.map(({ id, userId }) => [id, userId]));
    for (const request of requests) {
      if (ownerByDispatchId.get(request.dispatchId) !== request.userId) {
        throw new Error(`Push rate limit dispatch ownership mismatch: ${request.dispatchId}`);
      }
    }
  }

  #engagementKey(userId: string, localDate: Date | null): string {
    return `${userId}:${localDate == null ? "none" : toDateString(localDate)}`;
  }

  #toDate(localDate: string): Date {
    return new Date(`${localDate}T00:00:00.000Z`);
  }

  #requiredDecision(value: boolean | undefined, dispatchId: number): boolean {
    if (value == null) {
      throw new Error(`Push rate limit reservation result missing: dispatchId=${dispatchId}`);
    }
    return value;
  }
}
