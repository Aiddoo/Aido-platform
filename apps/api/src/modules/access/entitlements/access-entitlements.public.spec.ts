import { ACCESS_TIERS } from "@aido/api/vocabulary";

import { isUnlimitedSubject } from "./access-entitlements.public.js";

// 다른 Context(ai 비용 예산 등)가 ADMIN 예외를 스스로 판단하지 않고 이 문으로 묻는다
describe("access entitlements public — 무제한 주체", () => {
  it("ADMIN 주체만 무제한이다", () => {
    // When
    const decisions = ACCESS_TIERS.map((tier) => ({
      tier,
      unlimited: isUnlimitedSubject({ tier }),
    }));

    // Then
    expect(decisions).toEqual([
      { tier: "FREE", unlimited: false },
      { tier: "PREMIUM", unlimited: false },
      { tier: "ADMIN", unlimited: true },
    ]);
  });
});
