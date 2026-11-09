import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, gt, inArray, isNull, lte, ne, notExists, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { subscription } from "#api/platform/database/schema/index";

import type { FindDueBillingNoticesParams } from "../../../application/ports/subscriptions/billing-notice.port.js";
import type {
  UpcomingRenewalNotice,
  UpcomingRenewalNoticeSourcePort,
} from "../../../application/ports/subscriptions/upcoming-renewal-notice.source.port.js";
import { SubscriptionPlanPolicy } from "../../../domain/policies/subscriptions/subscription-plan.policy.js";

const otherOf = alias(subscription, "other");

@Injectable()
export class DrizzleUpcomingRenewalNoticeSource implements UpcomingRenewalNoticeSourcePort {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  private get db() {
    return this.txHost.tx;
  }

  async findDue(
    params: FindDueBillingNoticesParams<UpcomingRenewalNotice>,
  ): Promise<UpcomingRenewalNotice[]> {
    const rows = await this.db
      .select({
        subscriptionId: subscription.id,
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
            SubscriptionPlanPolicy.storeProductIdsOf("ANNUAL"),
          ),
          // Play는 요금제를 바꾸면 새 체인이 생기고 옛 체인이 원래 만료까지 ACTIVE로 남는다. 더 늦게 시작했거나
          // 더 늦게 끝나는 살아 있는 체인이 있으면 이 체인은 다음 결제를 정하지 않는다
          notExists(
            this.db
              .select({ one: sql`1` })
              .from(otherOf)
              .where(
                and(
                  eq(otherOf.userId, subscription.userId),
                  ne(otherOf.id, subscription.id),
                  isNull(otherOf.deletedAt),
                  inArray(otherOf.status, ["ACTIVE", "CANCELLED"]),
                  gt(otherOf.expiresAt, params.now),
                  or(
                    gt(otherOf.startedAt, subscription.startedAt),
                    gt(otherOf.expiresAt, subscription.expiresAt),
                  ),
                ),
              ),
          ),
          params.after == null
            ? undefined
            : sql`(${subscription.expiresAt}, ${subscription.id}) > (${sql.param(params.after.expiresAt, subscription.expiresAt)}, ${params.after.subscriptionId})`,
        ),
      )
      .orderBy(asc(subscription.expiresAt), asc(subscription.id))
      .limit(params.limit);
    return rows;
  }

  // 읽은 뒤 갱신으로 기간이 바뀐 행은 다음 기간을 미리 표시하지 않도록 읽은 만료 시각과 같을 때만 표시한다
  async claim(notices: readonly UpcomingRenewalNotice[]): Promise<UpcomingRenewalNotice[]> {
    if (notices.length === 0) {
      return [];
    }
    const claimed = await this.db
      .update(subscription)
      .set({ renewalNoticeExpiresAt: sql`${subscription.expiresAt}` })
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
