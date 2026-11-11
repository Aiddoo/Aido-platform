import { SUBSCRIPTION_STATUS } from "@aido/api/vocabulary";

import { hasPaidAccess, resolvePaidAccessDeadline } from "./paid-access.domain-service.js";

describe("유료 접근 판단 — 프리미엄 종료 시각", () => {
  const ENDS_AT = Temporal.Instant.from("2028-03-04T00:00:00.000Z");

  it.each([
    { now: "2028-03-03T23:59:59.999Z", expected: true },
    { now: "2028-03-04T00:00:00.000Z", expected: false },
  ])("보상 기간만 있으면 $now의 유료 접근은 $expected다", ({ now, expected }) => {
    // Given
    const accessDeadline = resolvePaidAccessDeadline({
      subscriptionExpiresAt: ENDS_AT,
      storeEntitlements: [],
    });

    // When
    const paid = hasPaidAccess({
      state: { subscriptionStatus: "ACTIVE", accessDeadline },
      now: Temporal.Instant.from(now),
    });

    // Then
    expect(paid).toBe(expected);
  });

  it("자동 갱신 중인 스토어 구독은 만료 뒤 3시간 유예가 끝날 때까지 프리미엄이다", () => {
    // Given
    const accessDeadline = resolvePaidAccessDeadline({
      subscriptionExpiresAt: ENDS_AT,
      storeEntitlements: [{ status: "ACTIVE", expiresAt: ENDS_AT }],
    });

    // When
    const paid = ["2028-03-04T02:59:59.999Z", "2028-03-04T03:00:00.000Z"].map((now) =>
      hasPaidAccess({
        state: { subscriptionStatus: "ACTIVE", accessDeadline },
        now: Temporal.Instant.from(now),
      }),
    );

    // Then
    expect(paid).toEqual([true, false]);
  });

  it("결제 유예 중인 스토어 구독은 취소 상태여도 유예가 끝날 때까지 프리미엄이다", () => {
    // Given
    const graceEndsAt = Temporal.Instant.from("2028-03-14T00:00:00.000Z");
    const accessDeadline = resolvePaidAccessDeadline({
      subscriptionExpiresAt: ENDS_AT,
      storeEntitlements: [
        { status: "CANCELLED", expiresAt: ENDS_AT, gracePeriodEndsAt: graceEndsAt },
      ],
    });

    // When
    const paid = [graceEndsAt.subtract({ milliseconds: 1 }), graceEndsAt].map((now) =>
      hasPaidAccess({ state: { subscriptionStatus: "ACTIVE", accessDeadline }, now }),
    );

    // Then
    expect(paid).toEqual([true, false]);
  });

  it("만료 시각이 없는 ACTIVE는 유지하고 ACTIVE가 아닌 상태는 무료다", () => {
    // Given
    const now = Temporal.Instant.from("2030-01-01T00:00:00.000Z");

    // When
    const paid = SUBSCRIPTION_STATUS.map((subscriptionStatus) =>
      hasPaidAccess({ state: { subscriptionStatus, accessDeadline: null }, now }),
    );

    // Then
    expect(
      Object.fromEntries(SUBSCRIPTION_STATUS.map((status, index) => [status, paid[index]])),
    ).toEqual({
      FREE: false,
      ACTIVE: true,
      EXPIRED: false,
      CANCELLED: false,
    });
  });
});
