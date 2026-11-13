import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, gt, inArray, isNull, lte } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { tupleGreaterThan } from "#api/platform/database/keyset";
import { subscription } from "#api/platform/database/schema/billing.schema";

import type { ListDueBillingNoticesParams } from "../../../shared/application/ports/billing-notice.repository.port.js";
import { TrialEndingNoticeRepositoryPort } from "../../application/ports/trial-ending-notice.repository.port.js";
import type { TrialEndingNotice } from "../../domain/trial-ending-notice.entity.js";
import { toTrialEndingNotice } from "./trial-ending-notice-row.mapper.js";

@Injectable()
export class DrizzleTrialEndingNoticeRepository extends TrialEndingNoticeRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async listDue(
    params: ListDueBillingNoticesParams<TrialEndingNotice>,
  ): Promise<TrialEndingNotice[]> {
    const rows = await this.#db
      .select({
        id: subscription.id,
        userId: subscription.userId,
        startedAt: subscription.startedAt,
        expiresAt: subscription.expiresAt,
        status: subscription.status,
        productId: subscription.productId,
      })
      .from(subscription)
      .where(
        and(
          eq(subscription.periodType, "TRIAL"),
          isNull(subscription.trialEndingNotifiedAt),
          isNull(subscription.deletedAt),
          inArray(subscription.status, ["ACTIVE", "CANCELLED"]),
          gt(subscription.expiresAt, params.now),
          lte(subscription.expiresAt, params.endsBefore),
          params.after == null
            ? undefined
            : tupleGreaterThan(
                [subscription.expiresAt, subscription.id],
                [params.after.expiresAt, params.after.id.value],
              ),
        ),
      )
      .orderBy(asc(subscription.expiresAt), asc(subscription.id))
      .limit(params.limit);
    return rows.map(toTrialEndingNotice);
  }

  async claim(
    notices: readonly TrialEndingNotice[],
    claimedAt: Temporal.Instant,
  ): Promise<TrialEndingNotice[]> {
    if (notices.length === 0) {
      return [];
    }
    const claimed = await this.#db
      .update(subscription)
      .set({ trialEndingNotifiedAt: claimedAt, updatedAt: claimedAt })
      .where(
        and(
          inArray(
            subscription.id,
            notices.map((notice) => notice.id.value),
          ),
          isNull(subscription.trialEndingNotifiedAt),
          eq(subscription.periodType, "TRIAL"),
        ),
      )
      .returning({ id: subscription.id });
    const claimedIds = new Set(claimed.map((row) => row.id));
    return notices.filter((notice) => claimedIds.has(notice.id.value));
  }
}
