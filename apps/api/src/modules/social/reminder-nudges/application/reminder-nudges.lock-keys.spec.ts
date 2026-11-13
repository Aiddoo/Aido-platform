import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { ReminderNudgeLockKeys } from "./reminder-nudges.lock-keys.js";

describe("ReminderNudgeLockKeys", () => {
  it("리마인드 콕 쿨다운 잠금 키는 nudges slice에서 옮기기 전 문자열과 같다", () => {
    // When
    const key = ReminderNudgeLockKeys.cooldown(
      UserId.reconstitute("sender"),
      UserId.reconstitute("receiver"),
    );

    // Then
    expect(key).toBe("mutation:v1:remind-nudge:cooldown:sender:receiver");
  });
});
