import { resolveNegativeSubscriptionProjection } from "./negative-subscription-projection.policy.js";

const at = new Date("2027-01-04T12:00:00.000Z");
const currentExpiresAt = new Date("2027-02-03T12:00:00.000Z");

describe("다른 구독의 권한으로 기존 활성 사용자 projection 보호", () => {
  it.each([
    ["더 짧은 기간", new Date("2027-01-05T12:00:00.000Z"), "2027-01-05T12:00:00.000Z"],
    ["더 긴 기간", new Date("2027-03-03T12:00:00.000Z"), "2027-02-03T12:00:00.000Z"],
  ])("%s은 현재 권한보다 만료일을 늘리지 않는다", (_label, otherExpiresAt, expected) => {
    // Given
    const input = { currentStatus: "ACTIVE", currentExpiresAt, otherExpiresAt, at } as const;
    // When
    const projection = resolveNegativeSubscriptionProjection(input);
    // Then
    expect(projection).toEqual({ status: "ACTIVE", expiresAt: new Date(expected) });
    projection?.expiresAt.setFullYear(2000);
    expect(currentExpiresAt.toISOString()).toBe("2027-02-03T12:00:00.000Z");
    expect(otherExpiresAt.getUTCFullYear()).toBe(2027);
  });

  it.each(["FREE", "CANCELLED", "EXPIRED"] as const)(
    "현재 %s 사용자를 자동으로 활성화하지 않는다",
    (currentStatus) => {
      // Given
      const input = { currentStatus, currentExpiresAt, otherExpiresAt: currentExpiresAt, at };
      // When / Then
      expect(resolveNegativeSubscriptionProjection(input)).toBeNull();
    },
  );

  it.each([
    { currentExpiresAt: null, otherExpiresAt: currentExpiresAt },
    { currentExpiresAt, otherExpiresAt: null },
    { currentExpiresAt: at, otherExpiresAt: currentExpiresAt },
    { currentExpiresAt, otherExpiresAt: at },
  ])("만료일 누락이나 현재 시각 경계는 기존 음수 전이를 유지한다", (expiry) => {
    // Given
    const input = { currentStatus: "ACTIVE", ...expiry, at } as const;
    // When / Then
    expect(resolveNegativeSubscriptionProjection(input)).toBeNull();
  });
});
