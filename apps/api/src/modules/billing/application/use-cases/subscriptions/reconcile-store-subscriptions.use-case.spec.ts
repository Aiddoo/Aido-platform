import type { StoreSubscriptionState } from "#api/modules/billing/domain/aggregates/subscriptions/subscription.aggregate";
import {
  createSubscriptionFixture,
  createSubscriptionRecord,
  SUBSCRIPTION_EXPIRY,
  SUBSCRIPTION_TRANSACTION_ID,
} from "#test/fixtures/subscription.fixture";
import { StubStoreSubscriptionStatusReader } from "#test/mocks/ports/subscription.stub";

import { ReconcileStoreSubscriptions } from "./reconcile-store-subscriptions.use-case.js";

const NOW = new Date("2026-02-20T12:00:00.000Z");
const NEXT_EXPIRY = new Date("2026-04-10T12:00:00.000Z");

function storeState(overrides: Partial<StoreSubscriptionState> = {}): StoreSubscriptionState {
  return {
    storeSubscriptionId: SUBSCRIPTION_TRANSACTION_ID,
    productId: "premium_monthly",
    periodEndsAt: SUBSCRIPTION_EXPIRY,
    willRenew: true,
    isTrial: false,
    givesAccess: true,
    ...overrides,
  };
}

function createReconcile(subscription: Parameters<typeof createSubscriptionRecord>[1] = {}) {
  const fixture = createSubscriptionFixture({ existing: true, subscription });
  const statusReader = new StubStoreSubscriptionStatusReader();
  const useCase = new ReconcileStoreSubscriptions({ ...fixture, statusReader });
  const stored = (revenueCatId = SUBSCRIPTION_TRANSACTION_ID) =>
    fixture.subscriptionRepository.subscriptions.get(revenueCatId);
  const userState = () => fixture.subscriptionRepository.users.get(fixture.user.id);
  return { fixture, statusReader, useCase, stored, userState };
}

describe("ReconcileStoreSubscriptions — 웹훅 뒤 스토어 상태 대조", () => {
  it("갱신 웹훅을 놓쳐 스토어 기간이 더 길면 만료를 늘리고 프리미엄 끝도 맞춘다", async () => {
    // Given
    const { fixture, statusReader, useCase, stored, userState } = createReconcile();
    statusReader.states.set(SUBSCRIPTION_TRANSACTION_ID, storeState({ periodEndsAt: NEXT_EXPIRY }));

    // When
    const result = await useCase.execute({ userId: fixture.user.id, now: NOW });

    // Then
    expect(result).toEqual({ correctedCount: 1, fields: ["expiresAt"] });
    expect(stored()?.expiresAt).toEqual(NEXT_EXPIRY);
    expect(userState()?.subscriptionExpiresAt).toEqual(NEXT_EXPIRY);
    expect(fixture.cache.profiles.has(fixture.user.id)).toBe(false);
  });

  it("늦게 온 지난 기간 해지로 CANCELLED가 된 행은 스토어가 갱신 중이면 되돌린다", async () => {
    // Given
    const { fixture, statusReader, useCase, stored } = createReconcile({
      status: "CANCELLED",
      cancelledAt: new Date("2026-02-15T00:00:00.000Z"),
    });
    statusReader.states.set(SUBSCRIPTION_TRANSACTION_ID, storeState());

    // When
    const result = await useCase.execute({ userId: fixture.user.id, now: NOW });

    // Then
    expect(result.fields).toEqual(["status"]);
    expect(stored()).toMatchObject({ status: "ACTIVE", cancelledAt: null });
  });

  it("Play 요금제 교체로 스토어가 접근을 주지 않는 옛 체인은 끝내고 프리미엄 끝은 새 체인을 따른다", async () => {
    // Given
    const annualExpiry = new Date("2026-12-01T00:00:00.000Z");
    const { fixture, statusReader, useCase, stored, userState } = createReconcile({
      productId: "com.aido.pro.yearly:yearly-base",
      expiresAt: annualExpiry,
    });
    fixture.subscriptionRepository.subscriptions.set(
      "play-monthly",
      createSubscriptionRecord(fixture.user.id, {
        id: 2,
        revenueCatId: "play-monthly",
        productId: "com.aido.pro.monthly:monthly-base",
        startedAt: NOW,
        expiresAt: NEXT_EXPIRY,
      }),
    );
    statusReader.states.set(
      SUBSCRIPTION_TRANSACTION_ID,
      storeState({ givesAccess: false, willRenew: false, periodEndsAt: NOW }),
    );
    statusReader.states.set(
      "play-monthly",
      storeState({
        storeSubscriptionId: "play-monthly",
        productId: "com.aido.pro.monthly:monthly-base",
        periodEndsAt: NEXT_EXPIRY,
      }),
    );

    // When
    const result = await useCase.execute({ userId: fixture.user.id, now: NOW });

    // Then
    expect(result).toEqual({ correctedCount: 1, fields: ["status", "expiresAt"] });
    expect(stored()).toMatchObject({ status: "EXPIRED", expiresAt: NOW });
    expect(stored("play-monthly")).toMatchObject({ status: "ACTIVE", expiresAt: NEXT_EXPIRY });
    expect(userState()?.subscriptionExpiresAt).toEqual(NEXT_EXPIRY);
  });

  it("환불 웹훅을 놓쳐도 스토어가 접근을 주지 않으면 바로 끝내 무료로 돌린다", async () => {
    // Given
    const { fixture, statusReader, useCase, stored, userState } = createReconcile();
    statusReader.states.set(
      SUBSCRIPTION_TRANSACTION_ID,
      storeState({ givesAccess: false, willRenew: false }),
    );

    // When
    await useCase.execute({ userId: fixture.user.id, now: NOW });

    // Then
    expect(stored()?.status).toBe("EXPIRED");
    expect(userState()).toMatchObject({ subscriptionStatus: "FREE", subscriptionExpiresAt: null });
  });

  it("스토어와 같으면 저장·프리미엄 재계산·캐시 무효화를 하지 않는다", async () => {
    // Given
    const { fixture, statusReader, useCase, stored } = createReconcile();
    statusReader.states.set(SUBSCRIPTION_TRANSACTION_ID, storeState());
    const before = stored();

    // When
    const result = await useCase.execute({ userId: fixture.user.id, now: NOW });

    // Then
    expect(result).toEqual({ correctedCount: 0, fields: [] });
    expect(stored()).toBe(before);
    expect(fixture.cache.profiles.has(fixture.user.id)).toBe(true);
  });

  it("스토어 읽기에 실패하면 아무것도 바꾸지 않고 던져 잡이 다시 시도한다", async () => {
    // Given
    const { fixture, statusReader, useCase, stored } = createReconcile();
    statusReader.failure = new Error("revenuecat unavailable");
    const before = stored();

    // When
    const reconciling = useCase.execute({ userId: fixture.user.id, now: NOW });

    // Then
    await expect(reconciling).rejects.toThrow("revenuecat unavailable");
    expect(stored()).toBe(before);
    expect(fixture.cache.profiles.has(fixture.user.id)).toBe(true);
  });
});
