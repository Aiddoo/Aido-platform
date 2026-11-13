import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { InviteLockKeys } from "./invites.lock-keys.js";

describe("InviteLockKeys", () => {
  it("초대 잠금 키를 slice를 나누기 전 문자열 그대로 만든다", () => {
    // When
    const key = InviteLockKeys.invite(UserId.reconstitute("inviter"));

    // Then
    expect(key).toBe("mutation:v1:invite:inviter");
  });
});
