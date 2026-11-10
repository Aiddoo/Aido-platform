import { instantFromDate } from "#api/shared/domain/time/instant";

import { hasPaidAccess, resolvePremiumAccessDeadline } from "./paid-access.policy.js";

describe("유료 접근 정책 — 프리미엄 종료 시각", () => {
  const ENDS_AT = new Date("2028-03-04T00:00:00.000Z");

  it.each([
    { now: "2028-03-03T23:59:59.999Z", expected: true },
    { now: "2028-03-04T00:00:00.000Z", expected: false },
  ])("보상 기간만 있으면 $now의 유료 접근은 $expected다", ({ now, expected }) => {
    // Given
    const accessDeadline = resolvePremiumAccessDeadline({
      subscriptionExpiresAt: ENDS_AT,
      storeEntitlements: [],
    });

    // When
    const paid = hasPaidAccess({ subscriptionStatus: "ACTIVE", accessDeadline }, new Date(now));

    // Then
    expect(paid).toBe(expected);
  });

  it("자동 갱신 중인 스토어 구독은 만료 뒤 3시간 유예가 끝날 때까지 프리미엄이다", () => {
    // Given
    const accessDeadline = resolvePremiumAccessDeadline({
      subscriptionExpiresAt: ENDS_AT,
      storeEntitlements: [{ status: "ACTIVE", expiresAt: instantFromDate(ENDS_AT) }],
    });

    // When
    const paid = ["2028-03-04T02:59:59.999Z", "2028-03-04T03:00:00.000Z"].map((now) =>
      hasPaidAccess({ subscriptionStatus: "ACTIVE", accessDeadline }, new Date(now)),
    );

    // Then
    expect(paid).toEqual([true, false]);
  });

  it("결제 유예 중인 스토어 구독은 취소 상태여도 유예가 끝날 때까지 프리미엄이다", () => {
    // Given
    const graceEndsAt = new Date("2028-03-14T00:00:00.000Z");
    const accessDeadline = resolvePremiumAccessDeadline({
      subscriptionExpiresAt: ENDS_AT,
      storeEntitlements: [
        {
          status: "CANCELLED",
          expiresAt: instantFromDate(ENDS_AT),
          gracePeriodEndsAt: instantFromDate(graceEndsAt),
        },
      ],
    });

    // When
    const paid = [new Date(graceEndsAt.getTime() - 1), graceEndsAt].map((at) =>
      hasPaidAccess({ subscriptionStatus: "ACTIVE", accessDeadline }, at),
    );

    // Then
    expect(paid).toEqual([true, false]);
  });

  it("만료 시각이 없는 ACTIVE는 유지하고 ACTIVE가 아닌 상태와 모르는 상태는 무료다", () => {
    // Given
    const at = new Date("2030-01-01T00:00:00.000Z");

    // When
    const paid = ["ACTIVE", "FREE", "CANCELLED", "EXPIRED", "TRIAL", "__proto__"].map(
      (subscriptionStatus) => hasPaidAccess({ subscriptionStatus, accessDeadline: null }, at),
    );

    // Then
    expect(paid).toEqual([true, false, false, false, false, false]);
  });
});
