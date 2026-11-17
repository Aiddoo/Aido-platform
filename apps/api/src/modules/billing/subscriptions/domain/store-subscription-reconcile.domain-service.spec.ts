import { STORE_PERIOD_TYPE } from "@aido/api/vocabulary";

import { SUBSCRIPTION_FIXTURE_NOW } from "#test/fixtures/billing/subscription.fixture";

import {
  reconcileWithStoreState,
  type ReconcilableSubscriptionState,
  type StoreSubscriptionState,
} from "./store-subscription-reconcile.domain-service.js";

const NOW = SUBSCRIPTION_FIXTURE_NOW;
const EXPIRES_AT = NOW.add({ hours: 24 * 30 });
const NEXT_EXPIRES_AT = NOW.add({ hours: 24 * 60 });

function current(
  overrides: Partial<ReconcilableSubscriptionState> = {},
): ReconcilableSubscriptionState {
  return {
    status: "ACTIVE",
    expiresAt: EXPIRES_AT,
    gracePeriodEndsAt: null,
    cancelledAt: null,
    productId: "premium_monthly",
    nextProductId: null,
    periodType: null,
    ...overrides,
  };
}

function store(overrides: Partial<StoreSubscriptionState> = {}): StoreSubscriptionState {
  return {
    storeSubscriptionId: "chain",
    productId: "premium_monthly",
    periodEndsAt: EXPIRES_AT,
    willRenew: true,
    isTrial: false,
    givesAccess: true,
    ...overrides,
  };
}

describe("reconcileWithStoreState — 스토어 상태로 구독 맞추기", () => {
  it("스토어와 같으면 고친 칸이 없고 행을 그대로 둔다", () => {
    // Given
    const row = current();

    // When
    const result = reconcileWithStoreState({ current: row, store: store(), at: NOW });

    // Then
    expect(result).toEqual({ state: row, fields: [] });
  });

  it("스토어가 해지·새 만료·새 상품·체험을 알리면 달라진 칸만 고친다", () => {
    // Given
    const row = current({ nextProductId: "premium_yearly" });

    // When
    const { state, fields } = reconcileWithStoreState({
      current: row,
      store: store({
        willRenew: false,
        periodEndsAt: NEXT_EXPIRES_AT,
        productId: "premium_yearly",
        isTrial: true,
      }),
      at: NOW,
    });

    // Then
    expect(fields).toEqual(["status", "expiresAt", "productId", "periodType"]);
    expect(state).toMatchObject({
      status: "CANCELLED",
      cancelledAt: NOW,
      expiresAt: NEXT_EXPIRES_AT,
      productId: "premium_yearly",
      nextProductId: null,
      periodType: STORE_PERIOD_TYPE.TRIAL,
    });
  });

  it("스토어 상품이 빈 문자열이면 상품은 그대로 두고 칸만 고친 것으로 적는다", () => {
    // Given
    const row = current({ nextProductId: "premium_yearly" });

    // When
    const { state, fields } = reconcileWithStoreState({
      current: row,
      store: store({ productId: "" }),
      at: NOW,
    });

    // Then
    expect(fields).toEqual(["productId"]);
    expect(state).toMatchObject({ productId: "premium_monthly", nextProductId: "premium_yearly" });
  });

  it("스토어가 접근을 주지 않으면 남은 기간을 지금으로 줄여 EXPIRED로 끝낸다", () => {
    // Given
    const row = current({ gracePeriodEndsAt: EXPIRES_AT });

    // When
    const { state, fields } = reconcileWithStoreState({
      current: row,
      store: store({ givesAccess: false }),
      at: NOW,
    });

    // Then
    expect(fields).toEqual(["status", "expiresAt"]);
    expect(state).toMatchObject({ status: "EXPIRED", expiresAt: NOW, gracePeriodEndsAt: null });
  });

  it("이미 엔타이틀먼트가 끝난 행은 접근이 없어도 고치지 않는다", () => {
    // Given
    const row = current({ status: "EXPIRED", expiresAt: NOW.subtract({ hours: 1 }) });

    // When
    const result = reconcileWithStoreState({
      current: row,
      store: store({ givesAccess: false }),
      at: NOW,
    });

    // Then
    expect(result).toEqual({ state: row, fields: [] });
  });
});
