import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { InviteRedemptionLockKeys } from "./invite-redemptions.lock-keys.js";

describe("InviteRedemptionLockKeys", () => {
  it("보상 상한 잠금 키를 slice를 나누기 전 문자열 그대로 만든다", () => {
    // When
    const key = InviteRedemptionLockKeys.rewardLedger(UserId.reconstitute("inviter"));

    // Then
    expect(key).toBe("mutation:v1:invite-reward-ledger:inviter");
  });
});
