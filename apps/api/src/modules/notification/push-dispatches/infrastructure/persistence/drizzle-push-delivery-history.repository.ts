import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, gte, inArray, lt, notExists } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import {
  notification,
  pushDispatch,
  pushRateLimitReservation,
} from "#api/platform/database/schema/index";

import type {
  DeleteFinishedPushDispatchesQuery,
  PushDeliveryHistoryRepositoryPort,
} from "../../application/ports/push-delivery-history.repository.port.js";

@Injectable()
export class DrizzlePushDeliveryHistoryRepository implements PushDeliveryHistoryRepositoryPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#transactionHost = transactionHost;
  }

  get #db() {
    return this.#transactionHost.tx;
  }

  // (status, scheduledAt) 인덱스를 시간 순서로 읽어 보관 기간 경계에서 멈춘다.
  // 끝난 시각(updatedAt)은 예약 시각보다 늦으므로 예약 시각 조건은 인덱스 범위만 좁힌다
  async deleteFinishedDispatches(query: DeleteFinishedPushDispatchesQuery): Promise<{
    readonly deletedCount: number;
    readonly lastScheduledAt: Temporal.Instant | null;
  }> {
    const candidates = this.#db
      .select({ id: pushDispatch.id })
      .from(pushDispatch)
      .where(
        and(
          eq(pushDispatch.status, query.status),
          lt(pushDispatch.scheduledAt, query.finishedBefore),
          query.scheduledFrom == null
            ? undefined
            : gte(pushDispatch.scheduledAt, query.scheduledFrom),
          lt(pushDispatch.updatedAt, query.finishedBefore),
          notExists(
            this.#db
              .select({ id: notification.id })
              .from(notification)
              .where(
                and(
                  eq(notification.id, pushDispatch.notificationId),
                  eq(notification.type, "ADMIN_BROADCAST"),
                ),
              ),
          ),
        ),
      )
      .orderBy(asc(pushDispatch.scheduledAt))
      .limit(query.limit);
    const deleted = await this.#db
      .delete(pushDispatch)
      .where(inArray(pushDispatch.id, candidates))
      .returning({ scheduledAt: pushDispatch.scheduledAt });
    const lastScheduledAt = deleted
      .map(({ scheduledAt }) => scheduledAt)
      .toSorted(Temporal.Instant.compare)
      .at(-1);
    return { deletedCount: deleted.length, lastScheduledAt: lastScheduledAt ?? null };
  }

  // 예약은 한도 창이 끝나면 모두 지우므로 남는 행이 없어 순서 없이 limit개씩 지운다
  async deleteRateLimitReservations(query: {
    readonly reservedBefore: Temporal.Instant;
    readonly limit: number;
  }): Promise<number> {
    const candidates = this.#db
      .select({ dispatchId: pushRateLimitReservation.dispatchId })
      .from(pushRateLimitReservation)
      .where(lt(pushRateLimitReservation.reservedAt, query.reservedBefore))
      .limit(query.limit);
    const deleted = await this.#db
      .delete(pushRateLimitReservation)
      .where(
        and(
          inArray(pushRateLimitReservation.dispatchId, candidates),
          lt(pushRateLimitReservation.reservedAt, query.reservedBefore),
        ),
      )
      .returning({ dispatchId: pushRateLimitReservation.dispatchId });
    return deleted.length;
  }
}
