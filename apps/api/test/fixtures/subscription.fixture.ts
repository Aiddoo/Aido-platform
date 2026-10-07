import { mock } from "vitest-mock-extended";

import type { SubscriptionUser } from "#api/modules/billing/application/ports/subscriptions/subscription.repository.port";
import type { SubscriptionProps } from "#api/modules/billing/domain/aggregates/subscriptions/subscription.aggregate";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { UserFixture } from "#test/fixtures/user.fixture";
import {
  StubSubscriptionCache,
  StubSubscriptionNotifier,
  StubSubscriptionReceiptRepository,
  StubSubscriptionRepository,
  StubSubscriptionUserMutationLock,
  StubSubscriptionWebhookLock,
} from "#test/mocks/ports/subscription.stub";
import { createUnitOfWorkMock } from "#test/mocks/ports/unit-of-work.mock";

export const SUBSCRIPTION_TIME = new Date("2026-02-10T12:00:00.000Z");
export const SUBSCRIPTION_EXPIRY = new Date("2026-03-10T12:00:00.000Z");
export const SUBSCRIPTION_TRANSACTION_ID = "original-subscription-transaction";

export function createSubscriptionRecord(
  userId: string,
  overrides: Partial<SubscriptionProps> = {},
): SubscriptionProps {
  const record = {
    id: 1,
    userId,
    revenueCatId: SUBSCRIPTION_TRANSACTION_ID,
    productId: "premium_monthly",
    status: "ACTIVE",
    startedAt: SUBSCRIPTION_TIME,
    expiresAt: SUBSCRIPTION_EXPIRY,
    cancelledAt: null,
    lastProcessedEventId: null,
    ...overrides,
  } satisfies SubscriptionProps;
  return {
    ...record,
    startedAt: new Date(record.startedAt),
    expiresAt: new Date(record.expiresAt),
    cancelledAt: record.cancelledAt === null ? null : new Date(record.cancelledAt),
  };
}

export function createSubscriptionFixture(
  input: {
    subscription?: Partial<SubscriptionProps>;
    existing?: boolean;
    profile?: SubscriptionUser["profile"];
    userSubscription?: Pick<SubscriptionUser, "subscriptionStatus" | "subscriptionExpiresAt">;
  } = {},
) {
  const user = UserFixture.create({
    revenueCatUserId: "subscription-app-user",
    createdAt: SUBSCRIPTION_TIME,
    updatedAt: SUBSCRIPTION_TIME,
  });
  const subscriptionRepository = new StubSubscriptionRepository();
  subscriptionRepository.users.set(user.id, {
    id: user.id,
    email: user.email,
    subscriptionStatus:
      input.userSubscription?.subscriptionStatus ?? (input.existing ? "ACTIVE" : "FREE"),
    subscriptionExpiresAt:
      input.userSubscription === undefined
        ? input.existing
          ? new Date(SUBSCRIPTION_EXPIRY)
          : null
        : input.userSubscription.subscriptionExpiresAt === null
          ? null
          : new Date(input.userSubscription.subscriptionExpiresAt),
    revenueCatUserId: user.revenueCatUserId,
    profile: input.profile === undefined ? { name: "구독 사용자" } : input.profile,
  });
  if (input.existing) {
    subscriptionRepository.subscriptions.set(
      SUBSCRIPTION_TRANSACTION_ID,
      createSubscriptionRecord(user.id, input.subscription),
    );
  }
  const cache = new StubSubscriptionCache();
  cache.profiles.set(user.id, { subscriptionStatus: input.existing ? "ACTIVE" : "FREE" });
  cache.entitlements.set(user.id, { status: input.existing ? "ACTIVE" : "FREE" });
  return {
    user,
    subscriptionRepository,
    receiptRepository: new StubSubscriptionReceiptRepository(),
    userMutationLock: new StubSubscriptionUserMutationLock(subscriptionRepository),
    cache,
    notifier: new StubSubscriptionNotifier(),
    webhookLock: new StubSubscriptionWebhookLock(),
    unitOfWork: createUnitOfWorkMock(),
    logger: mock<ApplicationLogger>(),
  };
}
