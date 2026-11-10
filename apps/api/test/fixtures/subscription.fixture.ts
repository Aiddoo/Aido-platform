import { mock } from "vitest-mock-extended";

import { ProjectPremiumAccessUseCase } from "#api/modules/billing/premium-grants/application/use-cases/project-premium-access.use-case";
import type { SubscriptionUser } from "#api/modules/billing/subscriptions/application/ports/subscription.repository.port";
import { StoreSubscriptionId } from "#api/modules/billing/subscriptions/domain/store-subscription-id.vo";
import type { SubscriptionProps } from "#api/modules/billing/subscriptions/domain/subscription.aggregate";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { UserFixture } from "#test/fixtures/user.fixture";
import {
  StubPremiumGrantRepository,
  StubSubscriptionCache,
  StubStoreSubscriptionReconcileScheduler,
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
    provider: "REVENUECAT",
    storeSubscriptionId: StoreSubscriptionId.from(SUBSCRIPTION_TRANSACTION_ID),
    productId: "premium_monthly",
    status: "ACTIVE",
    startedAt: SUBSCRIPTION_TIME,
    expiresAt: SUBSCRIPTION_EXPIRY,
    gracePeriodEndsAt: null,
    cancelledAt: null,
    lastProcessedEventId: null,
    nextProductId: null,
    periodType: null,
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
    appUserAlias: user.revenueCatUserId,
    profile: input.profile === undefined ? { name: "구독 사용자" } : input.profile,
  });
  if (input.existing) {
    subscriptionRepository.subscriptions.set(
      SUBSCRIPTION_TRANSACTION_ID,
      createSubscriptionRecord(user.id, input.subscription),
    );
  }
  const premiumGrantRepository = new StubPremiumGrantRepository();
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
    premiumGrantRepository,
    premiumAccessProjector: new ProjectPremiumAccessUseCase({
      subscriptionRepository,
      premiumGrantRepository,
    }),
    reconcileScheduler: new StubStoreSubscriptionReconcileScheduler(),
    unitOfWork: createUnitOfWorkMock(),
    logger: mock<ApplicationLoggerPort>(),
  };
}
