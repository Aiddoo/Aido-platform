import { createSocialFriendFixture, SOCIAL_TIME } from "#test/fixtures/social-friends.fixture";

import { AcceptFriendRequest } from "./accept-friend-request.use-case.js";

describe("친구 요청 수락", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SOCIAL_TIME);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(["missing", "ACCEPTED"])(
    "%s 요청은 재수락하지 않고 기존 관계를 유지한다",
    async (status) => {
      // Given
      const fixture = createSocialFriendFixture();
      fixture.addUser("me");
      fixture.addUser("friend");
      if (status === "ACCEPTED") fixture.addMutual("me", "friend");
      const before = structuredClone([...fixture.followRepository.follows.values()]);
      // When / Then
      await expect(
        new AcceptFriendRequest(fixture).execute({ userId: "me", requesterUserId: "friend" }),
      ).rejects.toMatchObject({ errorCode: "FOLLOW_0903" });
      expect([...fixture.followRepository.follows.values()]).toEqual(before);
      expect(fixture.notifier.mutual).toEqual([]);
    },
  );

  it.each([false, true])(
    "역방향 요청 존재=%s일 때 양방향 ACCEPTED와 각 사용자의 정렬 순서를 저장한다",
    async (reverseExists) => {
      // Given
      const fixture = createSocialFriendFixture();
      fixture.addUser("me");
      fixture.addUser("friend");
      fixture.addUser("existing");
      fixture.addMutual("me", "existing", 2);
      fixture.followRepository.seed({ followerId: "friend", followingId: "me" });
      if (reverseExists) fixture.followRepository.seed({ followerId: "me", followingId: "friend" });
      // When
      const result = await new AcceptFriendRequest(fixture).execute({
        userId: "me",
        requesterUserId: "friend",
      });
      // Then
      expect(result).toMatchObject({
        followerId: "me",
        followingId: "friend",
        status: "ACCEPTED",
        sortOrder: 3,
      });
      expect(
        await fixture.followRepository.findByFollowerAndFollowing("friend", "me"),
      ).toMatchObject({ status: "ACCEPTED", sortOrder: 0 });
      expect(fixture.notifier.mutual).toHaveLength(2);
      expect(fixture.notifier.milestones).toEqual([{ userId: "friend" }]);
    },
  );

  it("UoW가 완료되기 전에는 관계 캐시나 알림을 변경하지 않는다", async () => {
    // Given
    const fixture = createSocialFriendFixture();
    fixture.addUser("me");
    fixture.addUser("friend");
    fixture.followRepository.seed({ followerId: "friend", followingId: "me" });
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
    const execution = new AcceptFriendRequest(fixture).execute({
      userId: "me",
      requesterUserId: "friend",
    });
    try {
      await Promise.race([entered.promise, execution]);
      // Then
      expect(fixture.cache.friendCounts.get("me")).toBe(0);
      expect(fixture.notifier.mutual).toEqual([]);
    } finally {
      released.resolve();
      await execution;
    }
    expect(fixture.cache.friendCounts.has("me")).toBe(false);
    expect(fixture.notifier.mutual).toHaveLength(2);
  });

  it("저장한 관계의 사용자 프로젝션이 없으면 SYS_0001을 전달하고 알림을 보내지 않는다", async () => {
    // Given
    const fixture = createSocialFriendFixture();
    fixture.followRepository.seed({ followerId: "friend", followingId: "me" });
    // When / Then
    await expect(
      new AcceptFriendRequest(fixture).execute({ userId: "me", requesterUserId: "friend" }),
    ).rejects.toMatchObject({ errorCode: "SYS_0001" });
    expect(fixture.notifier.mutual).toEqual([]);
  });
});
