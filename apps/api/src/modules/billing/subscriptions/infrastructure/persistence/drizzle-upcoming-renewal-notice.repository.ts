import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { groupBy, uniq } from "es-toolkit";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { tupleGreaterThan } from "#api/platform/database/keyset";
import { subscription } from "#api/platform/database/schema/billing.schema";

import type { FindDueBillingNoticesParams } from "../../../premium-grants/application/ports/billing-notice.port.js";
import { currentStoreChainOf } from "../../../shared/premium-access.domain-service.js";
import { storeProductIdsOfPlan } from "../../../shared/subscription-plan.domain-service.js";
import {
  type UpcomingRenewalNotice,
  UpcomingRenewalNoticeRepositoryPort,
} from "../../application/ports/upcoming-renewal-notice.repository.port.js";
import { toStorePeriodType } from "../../domain/subscription-lifecycle.domain-service.js";

@Injectable()
export class DrizzleUpcomingRenewalNoticeRepository extends UpcomingRenewalNoticeRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async listDue(
    params: FindDueBillingNoticesParams<UpcomingRenewalNotice>,
  ): Promise<UpcomingRenewalNotice[]> {
    const rows = await this.#db
      .select({
        subscriptionId: subscription.id,
        storeSubscriptionId: subscription.revenueCatId,
        userId: subscription.userId,
        expiresAt: subscription.expiresAt,
      })
      .from(subscription)
      .where(
        and(
          eq(subscription.status, "ACTIVE"),
          isNull(subscription.deletedAt),
          or(isNull(subscription.periodType), eq(subscription.periodType, "NORMAL")),
          gt(subscription.expiresAt, params.now),
          lte(subscription.expiresAt, params.endsBefore),
          sql`${subscription.renewalNoticeExpiresAt} IS DISTINCT FROM ${subscription.expiresAt}`,
          // 예약한 상품 변경이 있으면 다음 결제는 그 상품이다(Subscription.renewingPlanType과 같은 규칙)
          inArray(
            sql`split_part(coalesce(${subscription.nextProductId}, ${subscription.productId}), ':', 1)`,
            storeProductIdsOfPlan("ANNUAL"),
          ),
          params.after == null
            ? undefined
            : tupleGreaterThan(
                [subscription.expiresAt, subscription.id],
                [params.after.expiresAt, params.after.subscriptionId],
              ),
        ),
      )
      .orderBy(asc(subscription.expiresAt), asc(subscription.id))
      .limit(params.limit);
    const currentChains = await this.#currentChainsOf(
      rows.map((row) => row.userId),
      params.now,
    );
    return rows.map(({ storeSubscriptionId, ...row }) => ({
      ...row,
      isCurrentChain: currentChains.get(row.userId) === storeSubscriptionId,
    }));
  }

  // 현재 체인은 /me와 같은 도메인 규칙으로 고른다. 사용자 묶음을 한 번에 읽는다
  async #currentChainsOf(
    userIds: readonly string[],
    now: Temporal.Instant,
  ): Promise<Map<string, string>> {
    if (userIds.length === 0) {
      return new Map();
    }
    const rows = await this.#db
      .select({
        userId: subscription.userId,
        storeSubscriptionId: subscription.revenueCatId,
        productId: subscription.productId,
        startedAt: subscription.startedAt,
        status: subscription.status,
        expiresAt: subscription.expiresAt,
        gracePeriodEndsAt: subscription.gracePeriodEndsAt,
        periodType: subscription.periodType,
      })
      .from(subscription)
      .where(and(inArray(subscription.userId, uniq(userIds)), isNull(subscription.deletedAt)));
    const chainsByUser = groupBy(
      rows.map((row) => ({ ...row, periodType: toStorePeriodType(row.periodType) })),
      (row) => row.userId,
    );
    return new Map(
      Object.entries(chainsByUser).flatMap(([userId, chains]) => {
        const current = currentStoreChainOf(chains, now);
        return current == null ? [] : [[userId, current.storeSubscriptionId] as const];
      }),
    );
  }

  // 읽은 뒤 갱신으로 기간이 바뀐 행은 다음 기간을 미리 표시하지 않도록 읽은 만료 시각과 같을 때만 표시한다
  async claim(
    notices: readonly UpcomingRenewalNotice[],
    claimedAt: Temporal.Instant,
  ): Promise<UpcomingRenewalNotice[]> {
    if (notices.length === 0) {
      return [];
    }
    const claimed = await this.#db
      .update(subscription)
      .set({ renewalNoticeExpiresAt: sql`${subscription.expiresAt}`, updatedAt: claimedAt })
      .where(
        and(
          or(
            ...notices.map((notice) =>
              and(
                eq(subscription.id, notice.subscriptionId),
                eq(subscription.expiresAt, notice.expiresAt),
              ),
            ),
          ),
          eq(subscription.status, "ACTIVE"),
          sql`${subscription.renewalNoticeExpiresAt} IS DISTINCT FROM ${subscription.expiresAt}`,
        ),
      )
      .returning({ id: subscription.id });
    const claimedIds = new Set(claimed.map((row) => row.id));
    return notices.filter((notice) => claimedIds.has(notice.subscriptionId));
  }
}
