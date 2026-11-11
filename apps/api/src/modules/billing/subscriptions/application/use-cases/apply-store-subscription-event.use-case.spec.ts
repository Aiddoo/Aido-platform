import { ErrorCode } from "@aido/api/errors";

import { LoadPremiumEntitlementsUseCase } from "#api/modules/billing/premium-grants/application/use-cases/load-premium-entitlements.use-case";
import { ProjectPremiumAccessUseCase } from "#api/modules/billing/premium-grants/application/use-cases/project-premium-access.use-case";
import type { PremiumGrant } from "#api/modules/billing/premium-grants/domain/premium-grant.aggregate";
import { FakeBillingUserLock } from "#test/doubles/billing/fake-billing-user-lock";
import { FakeSubscriptionWebhookLock } from "#test/doubles/billing/fake-subscription-webhook-lock";
import { InMemoryPremiumGrantRepository } from "#test/doubles/billing/in-memory-premium-grant.repository";
import { InMemoryStoreEntitlementReader } from "#test/doubles/billing/in-memory-store-entitlement.reader";
import { InMemorySubscriptionEventReceiptRepository } from "#test/doubles/billing/in-memory-subscription-event-receipt.repository";
import { InMemorySubscriptionUserReader } from "#test/doubles/billing/in-memory-subscription-user.reader";
import { InMemorySubscriptionRepository } from "#test/doubles/billing/in-memory-subscription.repository";
import { InMemoryUserSubscriptionProjectionRepository } from "#test/doubles/billing/in-memory-user-subscription-projection.repository";
import { RecordingPremiumAccessCache } from "#test/doubles/billing/recording-premium-access-cache";
import { RecordingStoreSubscriptionReconcileScheduler } from "#test/doubles/billing/recording-store-subscription-reconcile-scheduler";
import { RecordingSubscriptionEventNotifier } from "#test/doubles/billing/recording-subscription-event-notifier";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createPremiumGrantFixture } from "#test/fixtures/billing/premium-grant.fixture";
import {
  createSubscriptionFixture,
  SUBSCRIPTION_FIXTURE_CHAIN_ID,
  SUBSCRIPTION_FIXTURE_NOW,
  SUBSCRIPTION_FIXTURE_USER_ID,
} from "#test/fixtures/billing/subscription.fixture";

import type {
  StoreSubscriptionChainEvent,
  SubscriptionBillingIssueEvent,
  SubscriptionCancelledEvent,
  SubscriptionExpiredEvent,
  SubscriptionRenewedEvent,
  SubscriptionStartedEvent,
} from "../../domain/store-subscription.event.js";
import type { Subscription } from "../../domain/subscription.aggregate.js";
import {
  ApplyStoreSubscriptionEventUseCase,
  type ApplyStoreSubscriptionEventCommand,
} from "./apply-store-subscription-event.use-case.js";

const NOW = SUBSCRIPTION_FIXTURE_NOW;
const DAY = 24 * 60 * 60 * 1000;
const EXPIRES_AT = NOW.add({ milliseconds: 30 * DAY });
const NEXT_EXPIRES_AT = NOW.add({ milliseconds: 60 * DAY });
const USER = {
  id: SUBSCRIPTION_FIXTURE_USER_ID,
  email: "subscriber@example.com",
  profile: { name: "구독 사용자" },
  appUserAlias: "app-user-alias",
};
const PREVIOUS_OWNER = {
  id: "clz7x5p8k0009qz0z8z8z8z8z",
  email: "previous@example.com",
  profile: { name: "이전 사용자" },
};
const CHAIN_ID = SUBSCRIPTION_FIXTURE_CHAIN_ID;

const baseEvent = {
  provider: "REVENUECAT",
  providerEventId: "event-1",
  environment: "PRODUCTION",
  store: "APP_STORE",
  details: {},
  appUserId: USER.id,
  storeSubscriptionId: CHAIN_ID,
  productId: "premium_monthly",
  periodEndsAt: EXPIRES_AT,
  periodKind: null,
  price: {},
} as const;

function startedEvent(overrides: Partial<SubscriptionStartedEvent> = {}): SubscriptionStartedEvent {
  return {
    ...baseEvent,
    kind: "STARTED",
    providerEventType: "INITIAL_PURCHASE",
    isOneTime: false,
    startedAt: NOW,
    ...overrides,
  };
}

function renewedEvent(overrides: Partial<SubscriptionRenewedEvent> = {}): SubscriptionRenewedEvent {
  return {
    ...baseEvent,
    kind: "RENEWED",
    providerEventType: "RENEWAL",
    providerEventId: "event-renewal",
    periodEndsAt: NEXT_EXPIRES_AT,
    isTrialConversion: false,
    ...overrides,
  };
}

function cancelledEvent(
  overrides: Partial<SubscriptionCancelledEvent> = {},
): SubscriptionCancelledEvent {
  return {
    ...baseEvent,
    kind: "CANCELLED",
    providerEventType: "CANCELLATION",
    providerEventId: "event-cancel",
    reason: "UNSUBSCRIBE",
    ...overrides,
  };
}

function expiredEvent(overrides: Partial<SubscriptionExpiredEvent> = {}): SubscriptionExpiredEvent {
  return {
    ...baseEvent,
    kind: "EXPIRED",
    providerEventType: "EXPIRATION",
    providerEventId: "event-expired",
    reason: "UNSUBSCRIBE",
    ...overrides,
  };
}

function billingIssueEvent(
  overrides: Partial<SubscriptionBillingIssueEvent> = {},
): SubscriptionBillingIssueEvent {
  return {
    ...baseEvent,
    kind: "BILLING_ISSUE",
    providerEventType: "BILLING_ISSUE",
    providerEventId: "event-billing-issue",
    gracePeriodEndsAt: EXPIRES_AT.add({ milliseconds: 16 * DAY }),
    ...overrides,
  };
}

function setup(
  options: {
    subscriptions?: Subscription[];
    grants?: PremiumGrant[];
    extraUsers?: (typeof PREVIOUS_OWNER)[];
  } = {},
) {
  const users = [USER, ...(options.extraUsers ?? [])];
  const subscriptionRepository = new InMemorySubscriptionRepository(options.subscriptions ?? []);
  const premiumGrantRepository = new InMemoryPremiumGrantRepository(options.grants ?? []);
  const userSubscriptionProjection = new InMemoryUserSubscriptionProjectionRepository(
    users.map((user) => user.id),
  );
  const projectPremiumAccess = new ProjectPremiumAccessUseCase({
    loadPremiumEntitlements: new LoadPremiumEntitlementsUseCase({
      storeEntitlementReader: new InMemoryStoreEntitlementReader(subscriptionRepository),
      premiumGrantRepository,
    }),
    premiumGrantRepository,
    userSubscriptionProjection,
  });
  const receiptRepository = new InMemorySubscriptionEventReceiptRepository();
  const cache = new RecordingPremiumAccessCache();
  const notifier = new RecordingSubscriptionEventNotifier();
  const webhookLock = new FakeSubscriptionWebhookLock();
  const reconcileScheduler = new RecordingStoreSubscriptionReconcileScheduler();
  const userLock = new FakeBillingUserLock(users.map((user) => user.id));
  const useCase = new ApplyStoreSubscriptionEventUseCase({
    subscriptionRepository,
    subscriptionUserReader: new InMemorySubscriptionUserReader(users),
    receiptRepository,
    userLock,
    unitOfWork: new ImmediateUnitOfWork(),
    cache,
    notifier,
    webhookLock,
    projectPremiumAccess,
    reconcileScheduler,
    clock: new FixedClock(NOW.add({ hours: 1 })),
    logger: new SilentLogger(),
  });
  return {
    useCase,
    subscriptionRepository,
    premiumGrantRepository,
    userSubscriptionProjection,
    receiptRepository,
    cache,
    notifier,
    webhookLock,
    reconcileScheduler,
    userLock,
  };
}

async function storedChain(subscriptionRepository: InMemorySubscriptionRepository) {
  const [only] = subscriptionRepository.all;
  return only?.toPrimitives();
}

describe("ApplyStoreSubscriptionEventUseCase — 스토어 구독 이벤트 반영", () => {
  describe("구매와 갱신", () => {
    it("구매는 구독 행을 만들고 사용자를 ACTIVE로 올리며 처음 구매로 알린다", async () => {
      // Given
      const { useCase, subscriptionRepository, userSubscriptionProjection, notifier, cache } =
        setup();

      // When
      await useCase.execute(startedEvent());

      // Then
      expect(await storedChain(subscriptionRepository)).toMatchObject({
        storeSubscriptionId: CHAIN_ID,
        status: "ACTIVE",
        expiresAt: EXPIRES_AT,
        lastProcessedEventId: "event-1",
        environment: "PRODUCTION",
      });
      expect(userSubscriptionProjection.projections.get(USER.id)).toEqual({
        subscriptionStatus: "ACTIVE",
        subscriptionExpiresAt: EXPIRES_AT,
      });
      expect(notifier.events).toHaveLength(1);
      expect(notifier.events[0]).toMatchObject({
        kind: "STARTED",
        isFirstPurchase: true,
        premium: { source: "STORE", isTrial: false },
      });
      expect(cache.invalidatedUserIds).toEqual([USER.id]);
    });

    it("같은 이벤트 ID를 다시 받으면 원장에 막혀 상태도 알림도 반복하지 않는다", async () => {
      // Given
      const { useCase, subscriptionRepository, notifier } = setup();
      await useCase.execute(startedEvent());

      // When
      await useCase.execute(startedEvent());

      // Then
      expect(subscriptionRepository.all).toHaveLength(1);
      expect(notifier.events).toHaveLength(1);
    });

    it("구매 이벤트에 시작·만료 시각이 없으면 처리할 수 없어 보고하고 받은 것으로 닫는다", async () => {
      // Given
      const { useCase, subscriptionRepository, notifier } = setup();

      // When
      await useCase.execute(startedEvent({ startedAt: undefined }));

      // Then
      expect(subscriptionRepository.all).toEqual([]);
      expect(notifier.failures).toHaveLength(1);
      expect(notifier.failures[0]?.error).toMatchObject({ errorCode: ErrorCode.SUBSCRIPTION_1604 });
    });

    it("갱신은 새 만료로 늘리고 같은 만료·지난 기간의 갱신은 알리지 않는다", async () => {
      // Given
      const { useCase, subscriptionRepository, notifier } = setup({
        subscriptions: [createSubscriptionFixture({ expiresAt: EXPIRES_AT })],
      });

      // When
      await useCase.execute(renewedEvent());
      await useCase.execute(
        renewedEvent({ providerEventId: "event-stale", periodEndsAt: EXPIRES_AT }),
      );

      // Then
      expect(await storedChain(subscriptionRepository)).toMatchObject({
        status: "ACTIVE",
        expiresAt: NEXT_EXPIRES_AT,
        lastProcessedEventId: "event-renewal",
      });
      expect(notifier.events).toHaveLength(1);
    });

    it("행이 없는 체인의 갱신은 payload로 체인을 이어 받는다", async () => {
      // Given
      const { useCase, subscriptionRepository, userSubscriptionProjection } = setup();

      // When
      await useCase.execute(renewedEvent({ startedAt: NOW }));

      // Then
      expect(await storedChain(subscriptionRepository)).toMatchObject({
        storeSubscriptionId: CHAIN_ID,
        expiresAt: NEXT_EXPIRES_AT,
      });
      expect(userSubscriptionProjection.projections.get(USER.id)).toMatchObject({
        subscriptionStatus: "ACTIVE",
      });
    });

    it("갱신에 만료 시각이 없으면 구독 없음보다 먼저 시각 오류로 거절한다", async () => {
      // Given
      const { useCase, notifier } = setup();

      // When
      await useCase.execute(renewedEvent({ periodEndsAt: undefined }));

      // Then
      expect(notifier.failures[0]?.error).toMatchObject({
        errorCode: ErrorCode.SUBSCRIPTION_1604,
        details: { eventType: "RENEWED", reason: "Missing period end for renewal" },
      });
    });
  });

  describe("해지·환불·만료", () => {
    it("일반 해지는 구독을 CANCELLED로 두고 만료 시각까지 사용자를 ACTIVE로 유지한다", async () => {
      // Given
      const { useCase, subscriptionRepository, userSubscriptionProjection } = setup({
        subscriptions: [createSubscriptionFixture({ expiresAt: EXPIRES_AT })],
      });

      // When
      await useCase.execute(cancelledEvent());

      // Then
      expect(await storedChain(subscriptionRepository)).toMatchObject({ status: "CANCELLED" });
      expect(userSubscriptionProjection.projections.get(USER.id)).toEqual({
        subscriptionStatus: "ACTIVE",
        subscriptionExpiresAt: EXPIRES_AT,
      });
    });

    it("환불은 구독을 끝내고 사용자를 FREE로 내린다", async () => {
      // Given
      const { useCase, subscriptionRepository, userSubscriptionProjection } = setup({
        subscriptions: [createSubscriptionFixture({ expiresAt: EXPIRES_AT })],
      });

      // When
      await useCase.execute(cancelledEvent({ kind: "REFUNDED", reason: "CUSTOMER_SUPPORT" }));

      // Then
      expect(await storedChain(subscriptionRepository)).toMatchObject({ status: "EXPIRED" });
      expect(userSubscriptionProjection.projections.get(USER.id)).toEqual({
        subscriptionStatus: "FREE",
        subscriptionExpiresAt: null,
      });
    });

    it("만료는 구독을 EXPIRED로 끝내고 사용자를 FREE로 내린다", async () => {
      // Given
      const { useCase, subscriptionRepository, userSubscriptionProjection } = setup({
        subscriptions: [createSubscriptionFixture({ expiresAt: EXPIRES_AT })],
      });

      // When
      await useCase.execute(expiredEvent());

      // Then
      expect(await storedChain(subscriptionRepository)).toMatchObject({ status: "EXPIRED" });
      expect(userSubscriptionProjection.projections.get(USER.id)).toMatchObject({
        subscriptionStatus: "FREE",
      });
    });

    it("만료 이벤트의 시각이 지금 기간보다 이르면 늦게 온 지난 기간이라 무시한다", async () => {
      // Given
      const { useCase, subscriptionRepository, notifier } = setup({
        subscriptions: [createSubscriptionFixture({ expiresAt: EXPIRES_AT })],
      });

      // When
      await useCase.execute(expiredEvent({ periodEndsAt: NOW }));

      // Then
      expect(await storedChain(subscriptionRepository)).toMatchObject({ status: "ACTIVE" });
      expect(notifier.events).toEqual([]);
    });
  });

  describe("결제 문제", () => {
    it("결제 유예 끝을 행에 남기고 결제 문제 푸시를 기록한다", async () => {
      // Given
      const graceEndsAt = EXPIRES_AT.add({ milliseconds: 16 * DAY });
      const { useCase, subscriptionRepository, notifier } = setup({
        subscriptions: [createSubscriptionFixture({ expiresAt: EXPIRES_AT })],
      });

      // When
      await useCase.execute(billingIssueEvent({ gracePeriodEndsAt: graceEndsAt }));

      // Then
      expect(await storedChain(subscriptionRepository)).toMatchObject({
        gracePeriodEndsAt: graceEndsAt,
      });
      expect(notifier.billingIssueUserIds).toEqual([USER.id]);
      expect(notifier.events).toHaveLength(1);
    });

    it("행이 없는 체인의 결제 문제도 알림은 보낸다", async () => {
      // Given
      const { useCase, subscriptionRepository, notifier } = setup();

      // When
      await useCase.execute(billingIssueEvent());

      // Then
      expect(subscriptionRepository.all).toEqual([]);
      expect(notifier.events).toHaveLength(1);
      expect(notifier.billingIssueUserIds).toEqual([USER.id]);
    });
  });

  describe("실패 분류", () => {
    it("처리하지 않는 이벤트는 사용자를 찾지 않고 닫는다", async () => {
      // Given
      const { useCase, webhookLock } = setup();
      const ignored: StoreSubscriptionChainEvent = {
        ...baseEvent,
        kind: "IGNORED",
        providerEventType: "TEST",
      };

      // When
      await useCase.execute(ignored);

      // Then
      expect(webhookLock.acquiredAppUserIds).toEqual([]);
    });

    it("우리 사용자가 아니면 영구 실패라 보고하고 받은 것으로 닫는다", async () => {
      // Given
      const { useCase, notifier, receiptRepository } = setup();

      // When
      await useCase.execute(startedEvent({ appUserId: "stranger" }));

      // Then
      expect(notifier.failures).toHaveLength(1);
      expect(notifier.failures[0]?.error).toMatchObject({ errorCode: ErrorCode.SUBSCRIPTION_1602 });
      expect(receiptRepository.receipts.size).toBe(0);
    });

    it("처리할 체인이 없는 영구 실패는 스토어 상태 대조를 예약해 스스로 맞춘다", async () => {
      // Given
      const { useCase, reconcileScheduler, notifier } = setup();

      // When
      await useCase.execute(cancelledEvent());

      // Then
      expect(notifier.failures[0]?.error).toMatchObject({ errorCode: ErrorCode.SUBSCRIPTION_1604 });
      expect(reconcileScheduler.scheduledUserIds).toEqual([USER.id, USER.id]);
    });

    it("같은 사용자의 웹훅이 처리 중이면 SUBSCRIPTION_1605로 던져 공급자가 다시 보내게 한다", async () => {
      // Given
      const { useCase, webhookLock, notifier } = setup();
      webhookLock.held.add(USER.id);

      // When
      const result = useCase.execute(startedEvent());

      // Then
      await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.SUBSCRIPTION_1605 });
      expect(notifier.failures).toEqual([]);
    });

    it("일시 실패는 보고하지 않고 던져 공급자 재전송에 맡기며 잠금은 푼다", async () => {
      // Given
      const { useCase, subscriptionRepository, webhookLock, notifier } = setup();
      vi.spyOn(subscriptionRepository, "save").mockRejectedValueOnce(new Error("connection lost"));

      // When
      const result = useCase.execute(startedEvent());

      // Then
      await expect(result).rejects.toThrow("connection lost");
      expect(notifier.failures).toEqual([]);
      expect(webhookLock.held.size).toBe(0);
    });

    it("반영 뒤 캐시 무효화가 실패하면 보고하고 알림은 보내지 않는다", async () => {
      // Given
      const { useCase, cache, notifier } = setup();
      cache.failure = new Error("cache down");

      // When
      await useCase.execute(startedEvent());

      // Then
      expect(notifier.failures).toHaveLength(1);
      expect(notifier.events).toEqual([]);
    });
  });

  describe("보상 기간과 함께 본 프리미엄", () => {
    it("보상 기간 중 구독을 사면 진행 중인 기간을 구매 시각에 끊고 남은 기간을 쌓는다", async () => {
      // Given
      const { useCase, premiumGrantRepository, userSubscriptionProjection } = setup({
        grants: [createPremiumGrantFixture({ durationDays: 7 })],
      });

      // When
      await useCase.execute(startedEvent({ startedAt: NOW }));

      // Then
      const grants = premiumGrantRepository.all.map((grant) => grant.toPrimitives());
      expect(grants.map((grant) => grant.status).toSorted()).toEqual(["BANKED", "ENDED"]);
      expect(userSubscriptionProjection.projections.get(USER.id)).toMatchObject({
        subscriptionStatus: "ACTIVE",
      });
    });
  });

  describe("이전", () => {
    it("넘겨받은 사용자에게 체인을 옮기고 두 사용자의 프리미엄을 다시 계산해 알린다", async () => {
      // Given
      const { useCase, subscriptionRepository, userSubscriptionProjection, notifier } = setup({
        subscriptions: [createSubscriptionFixture({ userId: PREVIOUS_OWNER.id })],
        extraUsers: [PREVIOUS_OWNER],
      });
      const transfer: ApplyStoreSubscriptionEventCommand = {
        provider: "REVENUECAT",
        providerEventId: "event-transfer",
        providerEventType: "TRANSFER",
        environment: "PRODUCTION",
        store: "APP_STORE",
        details: {},
        kind: "TRANSFERRED",
        receivers: [USER.id],
        transferredFrom: [PREVIOUS_OWNER.id],
      };

      // When
      await useCase.execute(transfer);

      // Then
      expect(subscriptionRepository.all.map((subscription) => subscription.userId.value)).toEqual([
        USER.id,
      ]);
      expect(userSubscriptionProjection.projections.get(USER.id)).toMatchObject({
        subscriptionStatus: "ACTIVE",
      });
      expect(userSubscriptionProjection.projections.get(PREVIOUS_OWNER.id)).toEqual({
        subscriptionStatus: "FREE",
        subscriptionExpiresAt: null,
      });
      expect(notifier.events[0]).toMatchObject({ kind: "TRANSFERRED" });
    });
  });
});
