import { createSocialFriendFixture, SOCIAL_TIME } from "#test/fixtures/social-friends.fixture";

import { GetFriendResourceLimit } from "./get-friend-resource-limit.use-case.js";

describe("친구 보유 한도 조회", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SOCIAL_TIME);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    { role: "USER", expected: 5 },
    { role: "ADMIN", expected: null },
  ])("$role 사용자는 실제 친구 수와 자신의 한도를 조회한다", async (input) => {
    // Given
    const fixture = createSocialFriendFixture();
    fixture.addUser("me");
    fixture.addUser("friend");
    fixture.addMutual("me", "friend");
    fixture.database.users.set("me", { role: input.role, subscriptionStatus: "FREE" });
    // When
    const result = await new GetFriendResourceLimit(fixture).execute({ userId: "me" });
    // Then
    expect(result).toEqual({ friendCount: 1, maxCount: input.expected });
  });
});
