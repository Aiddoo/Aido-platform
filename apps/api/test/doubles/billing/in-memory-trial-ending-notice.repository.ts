import type { ListDueBillingNoticesParams } from "#api/modules/billing/shared/application/ports/billing-notice.repository.port";
import { TrialEndingNoticeRepositoryPort } from "#api/modules/billing/subscriptions/application/ports/trial-ending-notice.repository.port";
import { TrialEndingNotice } from "#api/modules/billing/subscriptions/domain/trial-ending-notice.entity";

import type { InMemorySubscriptionRepository } from "./in-memory-subscription.repository.js";

// 구독 저장소가 가진 체험 구독을 안내 후보로 보여 주고, 안내했다는 표시는 이 대역이 가진다
export class InMemoryTrialEndingNoticeRepository extends TrialEndingNoticeRepositoryPort {
  readonly #subscriptions: Pick<InMemorySubscriptionRepository, "all">;
  readonly #notifiedSubscriptionIds = new Set<number>();

  constructor(subscriptions: Pick<InMemorySubscriptionRepository, "all">) {
    super();
    this.#subscriptions = subscriptions;
  }

  async listDue(
    params: ListDueBillingNoticesParams<TrialEndingNotice>,
  ): Promise<TrialEndingNotice[]> {
    const { now, endsBefore, after, limit } = params;
    return this.#subscriptions.all
      .map((subscription) => subscription.toPrimitives())
      .filter(
        (row) =>
          row.periodType === "TRIAL" &&
          !this.#notifiedSubscriptionIds.has(row.id) &&
          (row.status === "ACTIVE" || row.status === "CANCELLED") &&
          Temporal.Instant.compare(row.expiresAt, now) > 0 &&
          Temporal.Instant.compare(row.expiresAt, endsBefore) <= 0 &&
          (after == null || isAfterCursor(row.expiresAt, row.id, after)),
      )
      .toSorted(
        (left, right) =>
          Temporal.Instant.compare(left.expiresAt, right.expiresAt) || left.id - right.id,
      )
      .slice(0, limit)
      .map((row) =>
        TrialEndingNotice.reconstitute({
          id: row.id,
          userId: row.userId,
          status: row.status,
          productId: row.productId,
          startedAt: row.startedAt,
          expiresAt: row.expiresAt,
        }),
      );
  }

  async claim(notices: readonly TrialEndingNotice[]): Promise<TrialEndingNotice[]> {
    const claimed = notices.filter((notice) => !this.#notifiedSubscriptionIds.has(notice.id.value));
    for (const notice of claimed) {
      this.#notifiedSubscriptionIds.add(notice.id.value);
    }
    return claimed;
  }
}

function isAfterCursor(expiresAt: Temporal.Instant, id: number, after: TrialEndingNotice): boolean {
  const byExpiry = Temporal.Instant.compare(expiresAt, after.expiresAt);
  return byExpiry > 0 || (byExpiry === 0 && id > after.id.value);
}
