import type { ListDueBillingNoticesParams } from "#api/modules/billing/shared/application/ports/billing-notice.repository.port";
import { currentStoreChainOf } from "#api/modules/billing/shared/domain/premium-access.domain-service";
import { storeProductIdsOfPlan } from "#api/modules/billing/shared/domain/subscription-plan.domain-service";
import { UpcomingRenewalNoticeRepositoryPort } from "#api/modules/billing/subscriptions/application/ports/upcoming-renewal-notice.repository.port";
import type { Subscription } from "#api/modules/billing/subscriptions/domain/subscription.aggregate";
import { UpcomingRenewalNotice } from "#api/modules/billing/subscriptions/domain/upcoming-renewal-notice.entity";

import type { InMemorySubscriptionRepository } from "./in-memory-subscription.repository.js";

const ANNUAL_PRODUCT_IDS = storeProductIdsOfPlan("ANNUAL");

function storeProductOf(productId: string): string {
  return productId.split(":")[0] ?? productId;
}

// 구독 저장소가 가진 연간 구독을 안내 후보로 보여 주고, 기간별 안내 표시는 이 대역이 가진다
export class InMemoryUpcomingRenewalNoticeRepository extends UpcomingRenewalNoticeRepositoryPort {
  readonly #subscriptions: Pick<InMemorySubscriptionRepository, "all">;
  readonly #noticedExpiresAtBySubscriptionId = new Map<number, Temporal.Instant>();

  constructor(subscriptions: Pick<InMemorySubscriptionRepository, "all">) {
    super();
    this.#subscriptions = subscriptions;
  }

  async listDue(
    params: ListDueBillingNoticesParams<UpcomingRenewalNotice>,
  ): Promise<UpcomingRenewalNotice[]> {
    const { now, endsBefore, after, limit } = params;
    const all = this.#subscriptions.all;
    return all
      .map((subscription) => subscription.toPrimitives())
      .filter(
        (row) =>
          row.status === "ACTIVE" &&
          (row.periodType == null || row.periodType === "NORMAL") &&
          Temporal.Instant.compare(row.expiresAt, now) > 0 &&
          Temporal.Instant.compare(row.expiresAt, endsBefore) <= 0 &&
          !this.#isNoticed(row.id, row.expiresAt) &&
          ANNUAL_PRODUCT_IDS.includes(storeProductOf(row.nextProductId ?? row.productId)) &&
          (after == null || isAfterCursor(row.expiresAt, row.id, after)),
      )
      .toSorted(
        (left, right) =>
          Temporal.Instant.compare(left.expiresAt, right.expiresAt) || left.id - right.id,
      )
      .slice(0, limit)
      .map((row) =>
        UpcomingRenewalNotice.reconstitute({
          id: row.id,
          userId: row.userId,
          expiresAt: row.expiresAt,
          isCurrentChain: currentChainIdOf(all, row.userId, now) === row.storeSubscriptionId,
        }),
      );
  }

  async claim(notices: readonly UpcomingRenewalNotice[]): Promise<UpcomingRenewalNotice[]> {
    const current = new Map(
      this.#subscriptions.all.map((subscription) => [subscription.id.value, subscription]),
    );
    const claimed = notices.filter((notice) => {
      const stored = current.get(notice.id.value);
      return (
        stored != null &&
        stored.status === "ACTIVE" &&
        stored.expiresAt.equals(notice.expiresAt) &&
        !this.#isNoticed(notice.id.value, stored.expiresAt)
      );
    });
    for (const notice of claimed) {
      this.#noticedExpiresAtBySubscriptionId.set(notice.id.value, notice.expiresAt);
    }
    return claimed;
  }

  #isNoticed(subscriptionId: number, expiresAt: Temporal.Instant): boolean {
    return this.#noticedExpiresAtBySubscriptionId.get(subscriptionId)?.equals(expiresAt) === true;
  }
}

function currentChainIdOf(
  subscriptions: readonly Subscription[],
  userId: string,
  now: Temporal.Instant,
): string | undefined {
  const chains = subscriptions
    .filter((subscription) => subscription.userId.value === userId)
    .map((subscription) => subscription.toPrimitives());
  return currentStoreChainOf(chains, now)?.storeSubscriptionId;
}

function isAfterCursor(
  expiresAt: Temporal.Instant,
  id: number,
  after: UpcomingRenewalNotice,
): boolean {
  const byExpiry = Temporal.Instant.compare(expiresAt, after.expiresAt);
  return byExpiry > 0 || (byExpiry === 0 && id > after.id.value);
}
