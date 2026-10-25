import { createSocialFriendFixture } from "#test/fixtures/social-friends.fixture";

import { UnblockUser } from "./unblock-user.use-case.js";

describe("차단 해제", () => {
  it("차단을 해제해도 끊긴 친구 관계는 되살리지 않는다", async () => {
    // Given
    const fixture = createSocialFriendFixture();
    fixture.addUser("me");
    fixture.addUser("blocked");
    fixture.userBlockRepository.seed("me", "blocked");

    // When
    await new UnblockUser(fixture).execute({ blockerId: "me", blockedId: "blocked" });

    // Then
    expect(fixture.userBlockRepository.blocks.size).toBe(0);
    expect(fixture.followRepository.follows.size).toBe(0);
  });

  it("상대가 나를 차단한 기록은 내가 해제할 수 없다", async () => {
    // Given
    const fixture = createSocialFriendFixture();
    fixture.addUser("me");
    fixture.addUser("blocker");
    fixture.userBlockRepository.seed("blocker", "me");
    const log = vi.spyOn(fixture.logger, "log");

    // When
    await new UnblockUser(fixture).execute({ blockerId: "me", blockedId: "blocker" });

    // Then
    expect(fixture.userBlockRepository.blocks.size).toBe(1);
    expect(log).not.toHaveBeenCalled();
  });
});
