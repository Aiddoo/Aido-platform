import { createSocialFriendFixture, SOCIAL_TIME } from "#test/fixtures/social-friends.fixture";

import { RejectFriendRequest } from "./reject-friend-request.use-case.js";

describe("친구 요청 거절", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SOCIAL_TIME);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(["missing", "ACCEPTED"])(
    "%s 관계는 거절 대상이 아니므로 삭제하지 않는다",
    async (status) => {
      // Given
      const fixture = createSocialFriendFixture();
      fixture.addUser("me");
      fixture.addUser("friend");
      if (status === "ACCEPTED") fixture.addMutual("me", "friend");
      const before = structuredClone([...fixture.followRepository.follows.values()]);
      // When / Then
      await expect(
        new RejectFriendRequest(fixture).execute({ userId: "me", requesterUserId: "friend" }),
      ).rejects.toMatchObject({ errorCode: "FOLLOW_0903" });
      expect([...fixture.followRepository.follows.values()]).toEqual(before);
    },
  );
  it("받은 PENDING만 삭제하고 다른 사용자의 요청은 유지한다", async () => {
    // Given
    const fixture = createSocialFriendFixture();
    const request = fixture.followRepository.seed({ followerId: "friend", followingId: "me" });
    const other = fixture.followRepository.seed({ followerId: "other", followingId: "me" });
    // When
    await new RejectFriendRequest(fixture).execute({ userId: "me", requesterUserId: "friend" });
    // Then
    expect(fixture.followRepository.follows.has(request.id)).toBe(false);
    expect(fixture.followRepository.follows.get(other.id)).toEqual(other);
  });
});
