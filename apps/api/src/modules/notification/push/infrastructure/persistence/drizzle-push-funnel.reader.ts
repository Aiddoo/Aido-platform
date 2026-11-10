import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, count, eq, isNotNull, type SQL, sql } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import {
  notification,
  pushDeliveryAttempt,
  pushDispatch,
} from "#api/platform/database/schema/index";
import { toIsoString } from "#api/shared/domain/time/instant";

import type {
  PushFunnel,
  PushFunnelQuery,
  PushFunnelReaderPort,
} from "../../application/ports/push-funnel.reader.port.js";
import { toSkippedByReason } from "./push-dispatch-skip-reason.mapper.js";

@Injectable()
export class DrizzlePushFunnelReader implements PushFunnelReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async summarize(query: PushFunnelQuery): Promise<PushFunnel> {
    const cohort = notificationCohort(query);
    const attemptsByDispatch = this.#db
      .select({
        dispatchId: pushDeliveryAttempt.dispatchId,
        delivered:
          sql<number>`count(*) filter (where ${pushDeliveryAttempt.status} = 'DELIVERED')`.as(
            "delivered",
          ),
        failed: sql<number>`count(*) filter (where ${pushDeliveryAttempt.status} = 'FAILED')`.as(
          "failed",
        ),
      })
      .from(pushDeliveryAttempt)
      .innerJoin(pushDispatch, eq(pushDispatch.id, pushDeliveryAttempt.dispatchId))
      .innerJoin(notification, eq(notification.id, pushDispatch.notificationId))
      .where(cohort)
      .groupBy(pushDeliveryAttempt.dispatchId)
      .as("attempts_by_dispatch");

    const [notificationRows, skipRows, receiptRows] = await Promise.all([
      this.#db
        .select({
          created: count(),
          opened: count(notification.openedAt),
        })
        .from(notification)
        .where(cohort),
      this.#db
        .select({ reason: pushDispatch.skipReason, total: count() })
        .from(pushDispatch)
        .innerJoin(notification, eq(notification.id, pushDispatch.notificationId))
        .where(and(cohort, eq(pushDispatch.status, "SKIPPED"), isNotNull(pushDispatch.skipReason)))
        .groupBy(pushDispatch.skipReason),
      this.#db
        .select({
          requested: count(),
          succeeded:
            sql<number>`count(*) filter (where ${attemptsByDispatch.delivered} > 0)`.mapWith(
              Number,
            ),
          failed:
            sql<number>`count(*) filter (where ${attemptsByDispatch.delivered} = 0 and ${attemptsByDispatch.failed} > 0)`.mapWith(
              Number,
            ),
        })
        .from(attemptsByDispatch),
    ]);
    const [notifications] = notificationRows;
    const [receipts] = receiptRows;
    return {
      created: notifications?.created ?? 0,
      skippedByReason: toSkippedByReason(skipRows),
      dispatchRequested: receipts?.requested ?? 0,
      receiptSucceeded: receipts?.succeeded ?? 0,
      receiptFailed: receipts?.failed ?? 0,
      opened: notifications?.opened ?? 0,
    };
  }
}

function notificationCohort(query: PushFunnelQuery): SQL | undefined {
  // timestamp(3)은 UTC 벽시계로 저장하므로 ISO 문자열을 같은 형으로 바꿔 비교한다
  return and(
    sql`${notification.createdAt} >= ${toIsoString(query.from)}::timestamp(3)`,
    sql`${notification.createdAt} < ${toIsoString(query.to)}::timestamp(3)`,
    query.campaignKey == null ? undefined : eq(notification.campaignKey, query.campaignKey),
    query.notificationType == null ? undefined : eq(notification.type, query.notificationType),
  );
}
