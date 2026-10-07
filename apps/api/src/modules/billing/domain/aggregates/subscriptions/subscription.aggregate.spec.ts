import { Subscription, type SubscriptionProps } from "./subscription.aggregate.js";

const startedAt = new Date("2026-12-03T12:00:00.000Z");
const expiresAt = new Date("2027-01-03T12:00:00.000Z");
const nextExpiry = new Date("2027-02-03T12:00:00.000Z");
const at = new Date("2027-01-04T12:00:00.000Z");

function subscription(overrides: Partial<SubscriptionProps> = {}) {
  return Subscription.reconstitute({
    id: 1,
    userId: "user-1",
    revenueCatId: "chain-1",
    productId: "monthly",
    status: "ACTIVE",
    startedAt,
    expiresAt,
    cancelledAt: null,
    lastProcessedEventId: "seed",
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
      cancelledAt: null,
      lastProcessedEventId: "renewal",
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

  it("상품 변경과 연장은 생략한 만료일·취소 시각을 임의로 지우지 않는다", () => {
    // Given
    const aggregate = subscription({ status: "CANCELLED", cancelledAt: at });

    // When
    aggregate.changeProduct("yearly", undefined, "product");

    // Then
    expect(aggregate.status).toBe("CANCELLED");
    expect(aggregate.productId).toBe("yearly");
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
});
