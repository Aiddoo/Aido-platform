import { StoreSubscriptionId } from "./store-subscription-id.vo.js";
import { Subscription, type SubscriptionProps } from "./subscription.aggregate.js";

const startedAt = new Date("2026-12-03T12:00:00.000Z");
const expiresAt = new Date("2027-01-03T12:00:00.000Z");
const nextExpiry = new Date("2027-02-03T12:00:00.000Z");
const at = new Date("2027-01-04T12:00:00.000Z");

function subscription(overrides: Partial<SubscriptionProps> = {}) {
  return Subscription.reconstitute({
    id: 1,
    userId: "user-1",
    provider: "REVENUECAT",
    storeSubscriptionId: StoreSubscriptionId.from("chain-1"),
    productId: "monthly",
    status: "ACTIVE",
    startedAt,
    expiresAt,
    gracePeriodEndsAt: null,
    cancelledAt: null,
    lastProcessedEventId: "seed",
    nextProductId: null,
    periodType: null,
    ...overrides,
  });
}

describe("Subscription — 구독 기간과 이벤트 상태 전이", () => {
  it("ACTIVE 동일 기간 갱신은 상태와 마지막 이벤트를 덮어쓰지 않는다", () => {
    // Given
    const aggregate = subscription();

    // When
    const applied = aggregate.renew(expiresAt, "renewal");

    // Then
    expect(applied).toBe(false);
    expect(aggregate.wasProcessedWith("seed")).toBe(true);
  });

  it("새 기간 갱신은 취소를 해제하고 ACTIVE로 복원한다", () => {
    // Given
    const aggregate = subscription({ status: "CANCELLED", cancelledAt: at });

    // When
    expect(aggregate.renew(nextExpiry, "renewal")).toBe(true);

    // Then
    expect(aggregate.persistenceState).toEqual({
      productId: "monthly",
      status: "ACTIVE",
      expiresAt: nextExpiry,
      gracePeriodEndsAt: null,
      cancelledAt: null,
      lastProcessedEventId: "renewal",
      nextProductId: null,
      periodType: null,
    });
  });

  it.each([false, true])(
    "취소의 환불 여부(%s)에 따라 상태를 바꾸고 구독 기간은 보존한다",
    (refunded) => {
      // Given
      const aggregate = subscription();

      // When
      aggregate.cancel({ refunded, cancelledAt: at, eventId: "cancel" });

      // Then
      expect(aggregate.status).toBe(refunded ? "EXPIRED" : "CANCELLED");
      expect(aggregate.cancelledAt).toEqual(at);
      expect(aggregate.expiresAt).toEqual(expiresAt);
      expect(aggregate.wasProcessedWith("cancel")).toBe(true);
    },
  );

  it.each([undefined, nextExpiry])(
    "취소 철회는 만료일 입력(%s)을 반영하고 취소 시각을 지운다",
    (expiry) => {
      // Given
      const aggregate = subscription({ status: "CANCELLED", cancelledAt: at });

      // When
      aggregate.uncancel(expiry, "uncancel");

      // Then
      expect(aggregate.isActive()).toBe(true);
      expect(aggregate.cancelledAt).toBeNull();
      expect(aggregate.expiresAt).toEqual(expiry ?? expiresAt);
    },
  );

  it.each([
    { expiration: new Date(expiresAt.getTime() - 1), applied: false },
    { expiration: expiresAt, applied: true },
    { expiration: new Date(expiresAt.getTime() + 1), applied: true },
    { expiration: null, applied: true },
  ])("만료 기간 경계 $expiration 적용 여부는 $applied이다", ({ expiration, applied }) => {
    // Given
    const aggregate = subscription();

    // When
    const result = aggregate.expire(expiration, "expire");

    // Then
    expect(result).toBe(applied);
    expect(aggregate.status).toBe(applied ? "EXPIRED" : "ACTIVE");
    expect(aggregate.lastProcessedEventId).toBe(applied ? "expire" : "seed");
    expect(aggregate.expiresAt).toEqual(expiresAt);
  });

  it("연간→월간 예약은 지금 기간 요금제를 두고 다음 결제 요금제만 바꾸며, 갱신하면 새 상품이 지금 기간이 된다", () => {
    // Given
    const aggregate = subscription({ productId: "com.aido.pro.yearly" });

    // When
    aggregate.reserveProductChange({
      newProductId: "com.aido.pro.monthly",
      expiresAt,
      eventId: "change",
    });
    const reserved = [aggregate.planType(), aggregate.renewingPlanType()];
    aggregate.renew(nextExpiry, "renew", undefined, "com.aido.pro.monthly");

    // Then
    expect(reserved).toEqual(["ANNUAL", "MONTHLY"]);
    expect([aggregate.planType(), aggregate.renewingPlanType()]).toEqual(["MONTHLY", "MONTHLY"]);
    expect(aggregate.persistenceState.nextProductId).toBeNull();
    expect(aggregate.expiresAt).toEqual(nextExpiry);
  });

  it("상품 변경 예약과 연장은 생략한 만료일·취소 시각을 임의로 지우지 않는다", () => {
    // Given
    const aggregate = subscription({ status: "CANCELLED", cancelledAt: at });

    // When
    aggregate.reserveProductChange({ newProductId: "yearly", eventId: "product" });

    // Then
    expect(aggregate.status).toBe("CANCELLED");
    expect(aggregate.productId).not.toBe("yearly");
    expect(aggregate.expiresAt).toEqual(expiresAt);

    // When
    aggregate.extend(undefined);

    // Then
    expect(aggregate.status).toBe("ACTIVE");
    expect(aggregate.cancelledAt).toEqual(at);
    expect(aggregate.wasProcessedWith("product")).toBe(true);
  });

  it("입력과 저장 snapshot의 Date 변경은 구독 기간 판정을 바꾸지 않는다", () => {
    // Given
    const suppliedExpiry = new Date(nextExpiry);
    const aggregate = subscription();

    // When
    aggregate.renew(suppliedExpiry, "renewal");
    suppliedExpiry.setUTCFullYear(2030);
    aggregate.persistenceState.expiresAt.setUTCFullYear(2030);
    aggregate.expiresAt.setUTCFullYear(2030);

    // Then
    expect(aggregate.isActiveWithSameExpiry(nextExpiry)).toBe(true);
    expect(aggregate.expire(expiresAt, "old-expiry")).toBe(false);
    expect(aggregate.wasProcessedWith("renewal")).toBe(true);
  });

  describe("갱신 뒤 늦게 온 지난 기간의 이벤트", () => {
    const earlier = new Date(expiresAt.getTime() - 1);

    it.each([
      [
        "해지",
        (s: Subscription) =>
          s.cancel({ refunded: false, cancelledAt: at, eventExpiresAt: earlier, eventId: "late" }),
      ],
      ["해지 철회", (s: Subscription) => s.uncancel(earlier, "late")],
      ["기간 연장", (s: Subscription) => s.extend(earlier, "late")],
    ])("만료 시각이 1ms라도 이른 %s은 상태·상품·기간을 바꾸지 않는다", (_name, apply) => {
      // Given
      const aggregate = subscription();
      const before = aggregate.persistenceState;

      // When
      const applied = apply(aggregate);

      // Then
      expect(applied).toBe(false);
      expect(aggregate.persistenceState).toEqual(before);
    });

    it("같은 기간의 해지는 적용하고, 환불은 만료 시각이 일러도 즉시 끝낸다", () => {
      // Given
      const cancelled = subscription();
      const refunded = subscription();

      // When
      const results = [
        cancelled.cancel({ refunded: false, cancelledAt: at, eventExpiresAt: expiresAt }),
        refunded.cancel({ refunded: true, cancelledAt: at, eventExpiresAt: earlier }),
      ];

      // Then
      expect(results).toEqual([true, true]);
      expect([cancelled.status, refunded.status]).toEqual(["CANCELLED", "EXPIRED"]);
    });
  });

  describe("결제 유예", () => {
    const graceEndsAt = new Date("2027-01-19T12:00:00.000Z");

    it("BILLING_ISSUE는 취소 상태에서도 유예 끝을 남기고, 지난 기간의 늦은 이벤트는 무시한다", () => {
      // Given
      const cancelled = subscription({ status: "CANCELLED" });
      const renewed = subscription({ expiresAt: nextExpiry });

      // When
      const results = [
        cancelled.enterBillingGrace({ gracePeriodEndsAt: graceEndsAt, periodExpiresAt: expiresAt }),
        renewed.enterBillingGrace({ gracePeriodEndsAt: graceEndsAt, periodExpiresAt: expiresAt }),
        subscription({ status: "EXPIRED" }).enterBillingGrace({
          gracePeriodEndsAt: graceEndsAt,
          periodExpiresAt: expiresAt,
        }),
      ];

      // Then
      expect(results).toEqual([true, false, false]);
      expect(cancelled.gracePeriodEndsAt).toEqual(graceEndsAt);
      expect(renewed.gracePeriodEndsAt).toBeNull();
    });

    it("RENEWAL은 유예를 지운다", () => {
      // Given
      const aggregate = subscription({ gracePeriodEndsAt: graceEndsAt });

      // When
      aggregate.renew(nextExpiry, "renew");

      // Then
      expect(aggregate.persistenceState).toMatchObject({
        status: "ACTIVE",
        expiresAt: nextExpiry,
        gracePeriodEndsAt: null,
      });
    });

    it.each([
      {
        name: "유예가 끝난 뒤",
        expiredAt: new Date("2027-01-20T00:00:00.000Z"),
        endedAt: graceEndsAt,
      },
      {
        name: "유예 중",
        expiredAt: new Date("2027-01-10T00:00:00.000Z"),
        endedAt: new Date("2027-01-10T00:00:00.000Z"),
      },
    ])(
      "$name 만료하면 유예를 지우고 만료 시각을 유예가 실제로 끝난 시각으로 남긴다",
      ({ expiredAt, endedAt }) => {
        // Given
        const aggregate = subscription({ gracePeriodEndsAt: graceEndsAt });

        // When
        const result = aggregate.expire(expiresAt, "expire", expiredAt);

        // Then
        expect(result).toBe(true);
        expect(aggregate.persistenceState).toMatchObject({
          status: "EXPIRED",
          expiresAt: endedAt,
          gracePeriodEndsAt: null,
        });
      },
    );
  });
});
