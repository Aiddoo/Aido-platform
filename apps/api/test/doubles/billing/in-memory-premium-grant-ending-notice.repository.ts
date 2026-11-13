import {
  type PremiumGrantEndingNotice,
  PremiumGrantEndingNoticeRepositoryPort,
} from "#api/modules/billing/premium-grants/application/ports/premium-grant-ending-notice.repository.port";
import type { PremiumGrantPrimitives } from "#api/modules/billing/premium-grants/domain/premium-grant.aggregate";
import type { ListDueBillingNoticesParams } from "#api/modules/billing/shared/application/ports/billing-notice.repository.port";

import type { InMemoryPremiumGrantRepository } from "./in-memory-premium-grant.repository.js";
import type { InMemorySubscriptionRepository } from "./in-memory-subscription.repository.js";

function isAfter(left: Temporal.Instant, right: Temporal.Instant): boolean {
  return Temporal.Instant.compare(left, right) > 0;
}

// 보상 기간·구독 저장소가 가진 기간을 안내 후보로 보여 주고, 안내했다는 표시는 이 대역이 가진다
export class InMemoryPremiumGrantEndingNoticeRepository extends PremiumGrantEndingNoticeRepositoryPort {
  readonly #grants: Pick<InMemoryPremiumGrantRepository, "all">;
  readonly #subscriptions: Pick<InMemorySubscriptionRepository, "all">;
  readonly #notifiedGrantIds = new Set<string>();

  constructor(
    grants: Pick<InMemoryPremiumGrantRepository, "all">,
    subscriptions: Pick<InMemorySubscriptionRepository, "all">,
  ) {
    super();
    this.#grants = grants;
    this.#subscriptions = subscriptions;
  }

  async listDue(
    params: ListDueBillingNoticesParams<PremiumGrantEndingNotice>,
  ): Promise<PremiumGrantEndingNotice[]> {
    const { now, endsBefore, after, limit } = params;
    const grants = this.#grants.all.map((grant) => grant.toPrimitives());
    const stores = this.#subscriptions.all.map((subscription) => subscription.toPrimitives());
    return grants
      .flatMap((grant) => (grant.endsAt == null ? [] : [{ ...grant, endsAt: grant.endsAt }]))
      .filter(
        (grant) =>
          grant.status === "ACTIVE" &&
          grant.endingNotifiedAt == null &&
          !this.#notifiedGrantIds.has(grant.id) &&
          isAfter(grant.endsAt, now) &&
          !isAfter(grant.endsAt, endsBefore) &&
          !hasFollowingGrant(grants, grant) &&
          !stores.some(
            (store) =>
              store.userId === grant.userId &&
              (store.status === "ACTIVE" || store.status === "CANCELLED") &&
              (!isAfter(grant.endsAt, store.expiresAt) ||
                (store.gracePeriodEndsAt != null &&
                  !isAfter(grant.endsAt, store.gracePeriodEndsAt))),
          ) &&
          (after == null || isAfterCursor(grant.endsAt, grant.id, after)),
      )
      .toSorted(
        (left, right) =>
          Temporal.Instant.compare(left.endsAt, right.endsAt) || (left.id < right.id ? -1 : 1),
      )
      .slice(0, limit)
      .map((grant) => ({ grantId: grant.id, userId: grant.userId, endsAt: grant.endsAt }));
  }

  async claim(notices: readonly PremiumGrantEndingNotice[]): Promise<PremiumGrantEndingNotice[]> {
    const active = new Map(
      this.#grants.all.map((grant) => [grant.toPrimitives().id, grant.toPrimitives()]),
    );
    const claimed = notices.filter((notice) => {
      const stored = active.get(notice.grantId);
      return (
        stored != null &&
        stored.status === "ACTIVE" &&
        stored.endingNotifiedAt == null &&
        !this.#notifiedGrantIds.has(notice.grantId)
      );
    });
    for (const notice of claimed) {
      this.#notifiedGrantIds.add(notice.grantId);
    }
    return claimed;
  }
}

function hasFollowingGrant(
  grants: readonly PremiumGrantPrimitives[],
  grant: PremiumGrantPrimitives & { readonly endsAt: Temporal.Instant },
): boolean {
  return grants.some(
    (other) =>
      other.userId === grant.userId &&
      other.id !== grant.id &&
      (other.status === "BANKED" ||
        (other.status === "ACTIVE" && other.endsAt != null && isAfter(other.endsAt, grant.endsAt))),
  );
}

function isAfterCursor(
  endsAt: Temporal.Instant,
  id: string,
  after: PremiumGrantEndingNotice,
): boolean {
  const byEnd = Temporal.Instant.compare(endsAt, after.endsAt);
  return byEnd > 0 || (byEnd === 0 && id > after.grantId);
}
