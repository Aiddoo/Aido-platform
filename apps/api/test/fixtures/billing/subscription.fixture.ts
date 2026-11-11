import type { SubscriptionStatus } from "@aido/api/vocabulary";

import type { UserSubscriptionProjectionRepositoryPort } from "#api/modules/billing/premium-grants/application/ports/user-subscription-projection.repository.port";
import type { SubscriptionRepositoryPort } from "#api/modules/billing/subscriptions/application/ports/subscription.repository.port";
import {
  Subscription,
  type SubscriptionPrimitives,
} from "#api/modules/billing/subscriptions/domain/subscription.aggregate";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantFromDate } from "#api/shared/domain/time/instant";

export const SUBSCRIPTION_FIXTURE_NOW = Temporal.Instant.from("2026-11-10T00:00:00Z");
export const SUBSCRIPTION_FIXTURE_USER_ID = "clz7x5p8k0001qz0z8z8z8z8z";
export const SUBSCRIPTION_FIXTURE_OTHER_USER_ID = "clz7x5p8k0002qz0z8z8z8z8z";
export const SUBSCRIPTION_FIXTURE_CHAIN_ID = "original-subscription-transaction";

export function createSubscriptionFixture(
  overrides: Partial<SubscriptionPrimitives> = {},
): Subscription {
  return Subscription.reconstitute({
    id: 1,
    userId: SUBSCRIPTION_FIXTURE_USER_ID,
    provider: "REVENUECAT",
    storeSubscriptionId: SUBSCRIPTION_FIXTURE_CHAIN_ID,
    productId: "premium_monthly",
    status: "ACTIVE",
    startedAt: SUBSCRIPTION_FIXTURE_NOW,
    expiresAt: SUBSCRIPTION_FIXTURE_NOW.add({ hours: 24 * 30 }),
    gracePeriodEndsAt: null,
    cancelledAt: null,
    lastProcessedEventId: null,
    nextProductId: null,
    periodType: null,
    environment: null,
    updatedAt: SUBSCRIPTION_FIXTURE_NOW,
    ...overrides,
  });
}

/** 통합 테스트가 구독 행을 직접 심을 때 쓴다. id는 저장소 시퀀스로 받는다. */
export async function saveSubscriptionFixture(
  repository: Pick<SubscriptionRepositoryPort, "nextId" | "save">,
  overrides: Partial<SubscriptionPrimitives>,
): Promise<void> {
  const id = await repository.nextId();
  await repository.save(createSubscriptionFixture({ ...overrides, id: id.value }));
}

/** User 행의 구독 projection을 심는다. 시나리오가 Date로 시각을 적으므로 여기서 Instant로 바꾼다. */
export async function setUserSubscriptionProjection(
  repository: Pick<UserSubscriptionProjectionRepositoryPort, "update">,
  userId: string,
  data: { subscriptionStatus: SubscriptionStatus; subscriptionExpiresAt?: Date | null },
): Promise<void> {
  const expiresAt = data.subscriptionExpiresAt;
  await repository.update(UserId.reconstitute(userId), {
    subscriptionStatus: data.subscriptionStatus,
    // 생략은 만료 시각을 건드리지 않고 null은 지운다
    ...(expiresAt !== undefined && {
      subscriptionExpiresAt: expiresAt === null ? null : instantFromDate(expiresAt),
    }),
  });
}

/** DB에서 읽은 Instant 칸을 시나리오 기대값(Date)과 비교할 수 있게 바꾼다. */
export function toDateOrNull(instant: Temporal.Instant | null): Date | null {
  return instant == null ? null : new Date(instant.epochMilliseconds);
}
