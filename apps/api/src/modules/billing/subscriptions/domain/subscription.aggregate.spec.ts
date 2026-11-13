import {
  createSubscriptionFixture,
  SUBSCRIPTION_FIXTURE_NOW,
} from "#test/fixtures/billing/subscription.fixture";

import { STORE_RENEWAL_GRACE_MS } from "../../shared/domain/store-renewal-grace.domain-service.js";

const NOW = SUBSCRIPTION_FIXTURE_NOW;
const EXPIRES_AT = NOW.add({ hours: 24 * 30 });
const NEXT_EXPIRES_AT = NOW.add({ hours: 24 * 60 });
const LATER = NOW.add({ hours: 1 });

describe("Subscription — 스토어 구독 체인", () => {
  describe("갱신", () => {
    it("새 만료 시각으로 갱신하면 유예·해지를 지우고 이벤트를 기록하며 true다", () => {
      // Given
      const subscription = createSubscriptionFixture({
        status: "CANCELLED",
        cancelledAt: NOW,
        gracePeriodEndsAt: EXPIRES_AT.add({ hours: 24 }),
      });

      // When
      const changed = subscription.renew({
        expiresAt: NEXT_EXPIRES_AT,
        now: LATER,
        eventId: "renewal-1",
        productId: "premium_yearly",
      });

      // Then
      expect(changed).toBe(true);
      expect(subscription.toPrimitives()).toMatchObject({
        status: "ACTIVE",
        expiresAt: NEXT_EXPIRES_AT,
        gracePeriodEndsAt: null,
        cancelledAt: null,
        lastProcessedEventId: "renewal-1",
        productId: "premium_yearly",
        updatedAt: LATER,
      });
    });

    it("같은 만료의 재전송과 지난 기간의 늦은 갱신은 바꾸지 않고 false다", () => {
      // Given
      const subscription = createSubscriptionFixture();
      const before = subscription.toPrimitives();

      // When
      const duplicate = subscription.renew({ expiresAt: EXPIRES_AT, now: LATER });
      const stale = subscription.renew({ expiresAt: NOW.add({ hours: 24 }), now: LATER });

      // Then
      expect({ duplicate, stale }).toEqual({ duplicate: false, stale: false });
      expect(subscription.toPrimitives()).toEqual(before);
    });

    it("갱신의 상품이 예약해 둔 상품 변경을 적용하고 비운다", () => {
      // Given
      const subscription = createSubscriptionFixture({ nextProductId: "premium_monthly" });

      // When
      subscription.renew({
        expiresAt: NEXT_EXPIRES_AT,
        now: LATER,
        productId: "premium_monthly",
      });

      // Then
      expect(subscription.toPrimitives()).toMatchObject({
        productId: "premium_monthly",
        nextProductId: null,
      });
    });
  });

  describe("해지·환불", () => {
    it("일반 해지는 CANCELLED로 두고 만료 시각은 그대로다", () => {
      // Given
      const subscription = createSubscriptionFixture();

      // When
      const changed = subscription.cancel({ refunded: false, now: LATER, eventId: "cancel-1" });

      // Then
      expect(changed).toBe(true);
      expect(subscription.toPrimitives()).toMatchObject({
        status: "CANCELLED",
        cancelledAt: LATER,
        expiresAt: EXPIRES_AT,
      });
    });

    it("환불은 기간과 상관없이 EXPIRED로 끝내고 결제 유예도 지운다", () => {
      // Given
      const subscription = createSubscriptionFixture({
        gracePeriodEndsAt: EXPIRES_AT.add({ hours: 24 }),
      });

      // When
      const changed = subscription.cancel({
        refunded: true,
        now: LATER,
        eventExpiresAt: NOW.subtract({ hours: 24 }),
      });

      // Then
      expect(changed).toBe(true);
      expect(subscription.toPrimitives()).toMatchObject({
        status: "EXPIRED",
        gracePeriodEndsAt: null,
      });
    });

    it("갱신 뒤 늦게 온 지난 기간의 해지는 갱신된 상태를 되돌리지 않고 false다", () => {
      // Given
      const subscription = createSubscriptionFixture();

      // When
      const changed = subscription.cancel({
        refunded: false,
        now: LATER,
        eventExpiresAt: NOW.add({ hours: 24 }),
      });

      // Then
      expect(changed).toBe(false);
      expect(subscription.status).toBe("ACTIVE");
    });

    it("이미 결제로 넘어간 체인에 늦게 온 체험 기간의 해지는 무시한다", () => {
      // Given
      const subscription = createSubscriptionFixture({ periodType: "NORMAL" });

      // When
      const changed = subscription.cancel({
        refunded: false,
        now: LATER,
        eventPeriodType: "TRIAL",
      });

      // Then
      expect(changed).toBe(false);
    });
  });

  describe("결제 유예와 만료", () => {
    it("결제 유예는 ACTIVE·CANCELLED에서만 기록하고 지난 기간의 늦은 이벤트는 무시한다", () => {
      // Given
      const graceEndsAt = EXPIRES_AT.add({ hours: 24 * 16 });
      const active = createSubscriptionFixture();
      const expired = createSubscriptionFixture({ status: "EXPIRED" });
      const stale = createSubscriptionFixture();

      // When
      const recorded = active.enterBillingGrace({
        gracePeriodEndsAt: graceEndsAt,
        periodExpiresAt: EXPIRES_AT,
        now: LATER,
      });
      const ignoredExpired = expired.enterBillingGrace({
        gracePeriodEndsAt: graceEndsAt,
        periodExpiresAt: null,
        now: LATER,
      });
      const ignoredStale = stale.enterBillingGrace({
        gracePeriodEndsAt: graceEndsAt,
        periodExpiresAt: NOW,
        now: LATER,
      });

      // Then
      expect([recorded, ignoredExpired, ignoredStale]).toEqual([true, false, false]);
      expect(active.gracePeriodEndsAt).toEqual(graceEndsAt);
    });

    it("결제 유예 중 만료하면 유예를 지우고 만료 시각을 유예가 실제로 끝난 시각까지 늘린다", () => {
      // Given
      const graceEndsAt = EXPIRES_AT.add({ hours: 24 * 10 });
      const subscription = createSubscriptionFixture({
        status: "CANCELLED",
        gracePeriodEndsAt: graceEndsAt,
      });
      const expiredAt = EXPIRES_AT.add({ hours: 24 * 4 });

      // When
      const changed = subscription.expire({ expirationAt: null, now: expiredAt });

      // Then
      expect(changed).toBe(true);
      expect(subscription.toPrimitives()).toMatchObject({
        status: "EXPIRED",
        gracePeriodEndsAt: null,
        expiresAt: expiredAt,
      });
    });

    it("유예가 만료 처리 시각보다 일찍 끝났으면 유예 끝까지만 늘린다", () => {
      // Given
      const graceEndsAt = EXPIRES_AT.add({ hours: 24 });
      const subscription = createSubscriptionFixture({ gracePeriodEndsAt: graceEndsAt });

      // When
      subscription.expire({ expirationAt: null, now: EXPIRES_AT.add({ hours: 24 * 5 }) });

      // Then
      expect(subscription.expiresAt).toEqual(graceEndsAt);
    });

    it("지난 기간의 만료 이벤트는 행을 바꾸지 않고 false다", () => {
      // Given
      const subscription = createSubscriptionFixture();

      // When
      const changed = subscription.expire({ expirationAt: NOW, now: LATER });

      // Then
      expect({ changed, status: subscription.status }).toEqual({
        changed: false,
        status: "ACTIVE",
      });
    });
  });

  describe("해지 철회·연장·상품 변경", () => {
    it("해지 철회는 ACTIVE로 되돌리고 이벤트의 만료 시각을 따른다", () => {
      // Given
      const subscription = createSubscriptionFixture({ status: "CANCELLED", cancelledAt: NOW });

      // When
      const changed = subscription.uncancel({ expiresAt: NEXT_EXPIRES_AT, now: LATER });

      // Then
      expect(changed).toBe(true);
      expect(subscription.toPrimitives()).toMatchObject({
        status: "ACTIVE",
        cancelledAt: null,
        expiresAt: NEXT_EXPIRES_AT,
      });
    });

    it("지난 기간의 늦은 해지 철회·연장은 갱신된 기간을 앞당기지 않고 false다", () => {
      // Given
      const subscription = createSubscriptionFixture();
      const stale = NOW.add({ hours: 24 });

      // When
      const uncancelled = subscription.uncancel({ expiresAt: stale, now: LATER });
      const extended = subscription.extend({ expiresAt: stale, now: LATER });

      // Then
      expect({ uncancelled, extended, expiresAt: subscription.expiresAt }).toEqual({
        uncancelled: false,
        extended: false,
        expiresAt: EXPIRES_AT,
      });
    });

    it("상품 변경 예약은 지금 상품·만료·상태를 두고 바꾼 대상만 남긴다", () => {
      // Given
      const subscription = createSubscriptionFixture({ productId: "premium_yearly" });

      // When
      const changed = subscription.reserveProductChange({
        newProductId: "premium_monthly",
        expiresAt: EXPIRES_AT,
        now: LATER,
      });

      // Then
      expect(changed).toBe(true);
      expect(subscription.toPrimitives()).toMatchObject({
        productId: "premium_yearly",
        nextProductId: "premium_monthly",
        status: "ACTIVE",
        expiresAt: EXPIRES_AT,
      });
    });
  });

  describe("스토어 상태 대조", () => {
    const state = (overrides = {}) => ({
      storeSubscriptionId: "original-subscription-transaction",
      productId: null,
      periodEndsAt: EXPIRES_AT,
      willRenew: true,
      isTrial: false,
      givesAccess: true,
      ...overrides,
    });

    it("스토어가 접근을 주지 않는데 우리가 엔타이틀먼트를 주는 행은 지금 끝낸다", () => {
      // Given
      const subscription = createSubscriptionFixture();
      const at = NOW.add({ hours: 24 });

      // When
      const fields = subscription.reconcileWithStore(state({ givesAccess: false }), at);

      // Then
      expect(fields).toEqual(["status", "expiresAt"]);
      expect(subscription.toPrimitives()).toMatchObject({ status: "EXPIRED", expiresAt: at });
    });

    it("이미 엔타이틀먼트가 끝난 행은 접근이 없어도 고칠 것이 없다", () => {
      // Given
      const subscription = createSubscriptionFixture({ status: "EXPIRED" });

      // When
      const fields = subscription.reconcileWithStore(state({ givesAccess: false }), LATER);

      // Then
      expect(fields).toEqual([]);
    });

    it("접근을 주면 자동 갱신·만료·상품을 스토어 값으로 맞추고 체험은 스토어가 아니라고 하면 NORMAL이 된다", () => {
      // Given
      const subscription = createSubscriptionFixture({
        periodType: "TRIAL",
        nextProductId: "premium_monthly",
      });

      // When
      const fields = subscription.reconcileWithStore(
        state({
          willRenew: false,
          periodEndsAt: NEXT_EXPIRES_AT,
          productId: "premium_yearly",
          isTrial: false,
        }),
        LATER,
      );

      // Then
      expect(fields).toEqual(["status", "expiresAt", "productId", "periodType"]);
      expect(subscription.toPrimitives()).toMatchObject({
        status: "CANCELLED",
        cancelledAt: LATER,
        expiresAt: NEXT_EXPIRES_AT,
        productId: "premium_yearly",
        nextProductId: null,
        periodType: "NORMAL",
      });
    });

    it("스토어와 이미 같으면 아무것도 고치지 않는다", () => {
      // Given
      const subscription = createSubscriptionFixture();
      const before = subscription.toPrimitives();

      // When
      const fields = subscription.reconcileWithStore(state(), LATER);

      // Then
      expect(fields).toEqual([]);
      expect(subscription.toPrimitives()).toEqual(before);
    });

    it("웹훅 대기 유예(3시간) 안의 만료 행도 접근이 없으면 끝낸다", () => {
      // Given
      const subscription = createSubscriptionFixture({ expiresAt: NOW.subtract({ hours: 1 }) });
      const insideWait = NOW.add({ milliseconds: STORE_RENEWAL_GRACE_MS - 2 * 60 * 60 * 1000 });

      // When
      const fields = subscription.reconcileWithStore(state({ givesAccess: false }), insideWait);

      // Then
      expect(fields).toEqual(["status"]);
    });
  });
});
