import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, gte, inArray, lt, sql } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { pushDispatch, pushRateLimitReservation } from "#api/platform/database/schema/index";

import type {
  DeleteFinishedPushDispatchesQuery,
  PushDeliveryHistoryRepositoryPort,
} from "../../application/ports/push-delivery-history.repository.port.js";
import { ADMIN_BROADCAST_CAMPAIGN_KEY_PREFIX } from "../../domain/push-delivery-history-retention.constants.js";

// 남기는 관리자 캠페인 발송을 발송 칸으로 가려 부분 인덱스로 지울 행만 읽는다(알림 anti-join은 남긴 공지 발송을 매일 다시 훑는다).
// 바인드 값은 일반 계획에서 부분 인덱스 조건을 증명하지 못해 상수로 싣는다
const OUTSIDE_ADMIN_BROADCAST_CAMPAIGN = sql`(${pushDispatch.campaignKey} IS NULL OR ${pushDispatch.campaignKey} NOT LIKE ${sql.raw(`'${ADMIN_BROADCAST_CAMPAIGN_KEY_PREFIX}%'`)})`;

@Injectable()
export class DrizzlePushDeliveryHistoryRepository implements PushDeliveryHistoryRepositoryPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#transactionHost = transactionHost;
  }

  // 관리자 캠페인 발송을 뺀 (status, scheduledAt) 부분 인덱스를 시간 순서로 읽어 보관 기간 경계에서 멈춘다.
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
          OUTSIDE_ADMIN_BROADCAST_CAMPAIGN,
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

  get #db() {
    return this.#transactionHost.tx;
  }
}
