import { describe, expect, it } from "vitest";

import { currentUserSchema } from "../src/index.js";

const currentUser = {
  userId: "clz7x5p8k0001qz0z8z8z8z8z",
  email: "matthew@example.com",
  sessionId: "clz7x5p8k0002qz0z8z8z8z8z",
  userTag: "MATT2025",
  role: "USER",
  status: "ACTIVE",
  emailVerifiedAt: null,
  subscriptionStatus: "ACTIVE",
  subscriptionExpiresAt: "2026-12-01T00:00:00.000Z",
  name: "매튜",
  profileImage: null,
  createdAt: "2026-01-01T09:00:00.000Z",
  providers: ["CREDENTIAL"],
};

describe("currentUserSchema", () => {
  it("구버전 서버가 프리미엄 보상 필드를 생략해도 그대로 읽는다", () => {
    // Given
    const legacy = currentUser;

    // When
    const result = currentUserSchema.safeParse(legacy);

    // Then
    expect(result.success).toBe(true);
  });

  it.each([
    { bankedPremiumDays: 14, expected: true },
    { bankedPremiumDays: -1, expected: false },
    { bankedPremiumDays: 1.5, expected: false },
  ])(
    "대기 중인 보상 일수 $bankedPremiumDays일의 허용 여부는 $expected다",
    ({ bankedPremiumDays, expected }) => {
      // Given
      const response = { ...currentUser, premiumSource: "STORE", bankedPremiumDays };

      // When
      const result = currentUserSchema.safeParse(response);

      // Then
      expect(result.success).toBe(expected);
    },
  );

  it.each([
    { premiumPeriodEndsAt: "2026-12-01T00:00:00.000Z", expected: true },
    { premiumPeriodEndsAt: null, expected: true },
    { premiumPeriodEndsAt: "2026-12-01", expected: false },
  ])(
    "지금 기간 끝 $premiumPeriodEndsAt의 허용 여부는 $expected다",
    ({ premiumPeriodEndsAt, expected }) => {
      // Given
      const response = {
        ...currentUser,
        premiumSource: "GRANT",
        premiumEndsAt: "2026-12-08T00:00:00.000Z",
        premiumPeriodEndsAt,
        bankedPremiumDays: 7,
      };

      // When
      const result = currentUserSchema.safeParse(response);

      // Then
      expect(result.success).toBe(expected);
    },
  );

  it("프리미엄이 끝난 사용자의 최근 보상 종료 시각을 읽는다", () => {
    // Given
    const response = {
      ...currentUser,
      subscriptionStatus: "FREE",
      premiumSource: null,
      premiumEndsAt: null,
      premiumPeriodEndsAt: null,
      bankedPremiumDays: 0,
      premiumGrantEndedAt: "2026-12-01T00:00:00.000Z",
    };

    // When
    const result = currentUserSchema.safeParse(response);

    // Then
    expect(result.success).toBe(true);
  });
});
