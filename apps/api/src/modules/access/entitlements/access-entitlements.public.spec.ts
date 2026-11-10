import { ACCESS_TIERS } from "@aido/api/vocabulary";

import { isExemptFromUserSpendLimit, isUnlimitedSubject } from "./access-entitlements.public.js";

// 다른 Context(ai 비용 예산 등)가 ADMIN 예외를 스스로 판단하지 않고 이 문으로 묻는다
describe("access entitlements public — 무제한 주체", () => {
  it("ADMIN 주체만 무제한이고 사용자 비용 예산 예외도 같은 판단을 따른다", () => {
    // When
    const decisions = ACCESS_TIERS.map((tier) => ({
      tier,
      unlimited: isUnlimitedSubject({ tier }),
      spendExempt: isExemptFromUserSpendLimit(tier),
    }));

    // Then
    expect(decisions).toEqual([
      { tier: "FREE", unlimited: false, spendExempt: false },
      { tier: "PREMIUM", unlimited: false, spendExempt: false },
      { tier: "ADMIN", unlimited: true, spendExempt: true },
    ]);
  });
});
