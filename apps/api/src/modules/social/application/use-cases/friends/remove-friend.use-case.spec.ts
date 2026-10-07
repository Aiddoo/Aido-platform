import { createSocialFriendFixture, SOCIAL_TIME } from "#test/fixtures/social-friends.fixture";

import { RemoveFriend } from "./remove-friend.use-case.js";

describe("친구 관계 삭제", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SOCIAL_TIME);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("내 방향 관계가 없으면 FOLLOW_0907로 거부하고 상대방 관계를 유지한다", async () => {
    // Given
    const fixture = createSocialFriendFixture();
    const reverse = fixture.followRepository.seed({ followerId: "friend", followingId: "me" });
    // When / Then
    await expect(
      new RemoveFriend(fixture).execute({ userId: "me", targetUserId: "friend" }),
    ).rejects.toMatchObject({ errorCode: "FOLLOW_0907" });
    expect(fixture.followRepository.follows.get(reverse.id)).toEqual(reverse);
  });
  it.each([false, true])(
    "역방향 존재=%s인 관계를 제거하고 기존 맞팔 캐시를 제거한다",
    async (reverseExists) => {
      // Given
      const fixture = createSocialFriendFixture();
      fixture.addUser("me");
      fixture.addUser("friend");
      fixture.followRepository.seed({
        followerId: "me",
        followingId: "friend",
        status: "ACCEPTED",
      });
      if (reverseExists)
        fixture.followRepository.seed({
          followerId: "friend",
          followingId: "me",
          status: "ACCEPTED",
        });
      await fixture.reader.isMutualFriend("me", "friend");
      await fixture.reader.countFriends("me");
      await fixture.reader.getMutualFriendIds("me");
      // When
      await new RemoveFriend(fixture).execute({ userId: "me", targetUserId: "friend" });
      // Then
      expect(fixture.followRepository.follows.size).toBe(0);
      expect(fixture.cache.mutual.size).toBe(0);
      expect(fixture.cache.friendCounts.size).toBe(0);
      expect(fixture.cache.friendIds.size).toBe(0);
    },
  );
  it("UoW가 완료되기 전에는 기존 친구 캐시를 제거하지 않는다", async () => {
    // Given
    const fixture = createSocialFriendFixture();
    fixture.addUser("me");
    fixture.addUser("friend");
    fixture.addMutual("me", "friend");
    await fixture.reader.countFriends("me");
    const entered = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    fixture.unitOfWork.run = async (work) => {
      const result = await work();
      entered.resolve();
      await released.promise;
      return result;
    };
    // When
    const execution = new RemoveFriend(fixture).execute({ userId: "me", targetUserId: "friend" });
    try {
      await Promise.race([entered.promise, execution]);
      // Then
      expect(fixture.cache.friendCounts.get("me")).toBe(1);
    } finally {
      released.resolve();
      await execution;
    }
    expect(fixture.cache.friendCounts.has("me")).toBe(false);
  });
});
