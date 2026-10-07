import { createSocialFriendFixture, SOCIAL_TIME } from "#test/fixtures/social-friends.fixture";

import { SendFriendRequest } from "./send-friend-request.use-case.js";

describe("친구 요청 보내기", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SOCIAL_TIME);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    { name: "자기 자신", targetUserId: "me", code: "FOLLOW_0904" },
    { name: "존재하지 않는 사용자", targetUserId: "missing", code: "FOLLOW_0905" },
    { name: "이미 보낸 요청", status: "PENDING", targetUserId: "friend", code: "FOLLOW_0901" },
    { name: "이미 친구인 관계", status: "ACCEPTED", targetUserId: "friend", code: "FOLLOW_0902" },
  ] satisfies Array<{
    name: string;
    targetUserId: string;
    code: string;
    status?: "PENDING" | "ACCEPTED";
  }>)("$name 에게 요청하면 $code 오류로 거부하고 상태를 유지한다", async (input) => {
    // Given
    const fixture = createSocialFriendFixture();
    fixture.addUser("me");
    fixture.addUser("friend");
    if (input.status)
      fixture.followRepository.seed({
        followerId: "me",
        followingId: "friend",
        status: input.status,
      });
    const before = structuredClone([...fixture.followRepository.follows.values()]);
    // When / Then
    await expect(
      new SendFriendRequest(fixture).execute({ userId: "me", targetUserId: input.targetUserId }),
    ).rejects.toMatchObject({ errorCode: input.code });
    expect([...fixture.followRepository.follows.values()]).toEqual(before);
    expect(fixture.notifier.newRequests).toEqual([]);
  });

  it("무료 친구 한도에 도달하면 대상 존재 여부보다 한도 오류가 우선한다", async () => {
    // Given
    const fixture = createSocialFriendFixture();
    fixture.addUser("me");
    for (let index = 0; index < 5; index += 1) {
      const friendId = `friend-${index}`;
      fixture.addUser(friendId);
      fixture.addMutual("me", friendId, index);
    }
    const before = structuredClone([...fixture.followRepository.follows.values()]);
    // When / Then
    await expect(
      new SendFriendRequest(fixture).execute({ userId: "me", targetUserId: "missing" }),
    ).rejects.toMatchObject({ errorCode: "FOLLOW_0909", details: { current: 5, limit: 5 } });
    expect([...fixture.followRepository.follows.values()]).toEqual(before);
  });

  it("새 요청은 PENDING으로 저장하고 프로필이 없는 발신자의 태그를 알림에 사용한다", async () => {
    // Given
    const fixture = createSocialFriendFixture();
    const sender = fixture.addUser("me", null);
    fixture.addUser("friend");
    // When
    const result = await new SendFriendRequest(fixture).execute({
      userId: "me",
      targetUserId: "friend",
    });
    // Then
    expect(result.autoAccepted).toBe(false);
    expect(fixture.followRepository.follows.get(result.follow.id)).toMatchObject({
      followerId: "me",
      followingId: "friend",
      status: "PENDING",
    });
    expect(fixture.notifier.newRequests).toEqual([
      { followerId: "me", followingId: "friend", followerName: sender.userTag },
    ]);
  });

  it("상대가 먼저 요청했다면 양방향 친구로 저장하고 이전 관계 캐시를 제거한다", async () => {
    // Given
    const fixture = createSocialFriendFixture();
    fixture.addUser("me");
    fixture.addUser("friend");
    fixture.followRepository.seed({ followerId: "friend", followingId: "me" });
    expect(await fixture.reader.isMutualFriend("me", "friend")).toBe(false);
    await fixture.reader.countFriends("me");
    await fixture.reader.getMutualFriendIds("me");
    // When
    const result = await new SendFriendRequest(fixture).execute({
      userId: "me",
      targetUserId: "friend",
    });
    // Then
    expect(result.autoAccepted).toBe(true);
    expect([...fixture.followRepository.follows.values()].map((follow) => follow.status)).toEqual([
      "ACCEPTED",
      "ACCEPTED",
    ]);
    expect(fixture.cache.mutual.size).toBe(0);
    expect(fixture.cache.friendCounts.size).toBe(0);
    expect(fixture.cache.friendIds.size).toBe(0);
    expect(fixture.notifier.mutual.map((notification) => notification.userId).sort()).toEqual([
      "friend",
      "me",
    ]);
    expect(fixture.notifier.milestones.map((notification) => notification.userId).sort()).toEqual([
      "friend",
      "me",
    ]);
  });
});
