import { createSocialFriendFixture, SOCIAL_TIME } from "#test/fixtures/social-friends.fixture";

import { BlockUser } from "./block-user.use-case.js";

describe("사용자 차단", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SOCIAL_TIME);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("친구를 차단하면 양방향 친구 관계를 지우고 두 사람의 친구 캐시를 비운다", async () => {
    // Given
    const fixture = createSocialFriendFixture();
    fixture.addUser("me");
    fixture.addUser("friend");
    fixture.addMutual("me", "friend");
    fixture.cache.mutual.set("friend:me", true);
    fixture.cache.friendCounts.set("me", 1);
    fixture.cache.friendCounts.set("friend", 1);

    // When
    const result = await new BlockUser(fixture).execute({ blockerId: "me", blockedId: "friend" });

    // Then
    expect(result.isNewlyBlocked).toBe(true);
    expect(result.block.createdAt).toEqual(SOCIAL_TIME);
    expect(fixture.followRepository.follows.size).toBe(0);
    expect(fixture.cache.mutual.size).toBe(0);
    expect(fixture.cache.friendCounts.size).toBe(0);
    expect(fixture.lockCalls).toEqual([
      [
        "mutation:v1:friend:pair:friend:me",
        "mutation:v1:friend:list:me",
        "mutation:v1:friend:list:friend",
      ],
    ]);
  });

  it("상대가 보낸 대기 중인 친구 요청도 함께 지운다", async () => {
    // Given
    const fixture = createSocialFriendFixture();
    fixture.addUser("me");
    fixture.addUser("requester");
    fixture.followRepository.seed({
      followerId: "requester",
      followingId: "me",
      status: "PENDING",
    });

    // When
    await new BlockUser(fixture).execute({ blockerId: "me", blockedId: "requester" });

    // Then
    expect(fixture.followRepository.follows.size).toBe(0);
  });

  it("이미 차단한 사용자를 다시 차단하면 처음 차단 시각을 그대로 돌려준다", async () => {
    // Given
    const fixture = createSocialFriendFixture();
    fixture.addUser("me");
    fixture.addUser("blocked");
    const firstBlockedAt = new Date("2026-07-01T00:00:00.000Z");
    fixture.userBlockRepository.seed("me", "blocked", firstBlockedAt);
    const log = vi.spyOn(fixture.logger, "log");

    // When
    const result = await new BlockUser(fixture).execute({ blockerId: "me", blockedId: "blocked" });

    // Then
    expect(result.isNewlyBlocked).toBe(false);
    expect(result.block.createdAt).toEqual(firstBlockedAt);
    expect(fixture.userBlockRepository.blocks.size).toBe(1);
    expect(log).not.toHaveBeenCalled();
  });

  it("탈퇴했거나 없는 사용자는 차단할 수 없다", async () => {
    // Given
    const fixture = createSocialFriendFixture();
    fixture.addUser("me");

    // When / Then
    await expect(
      new BlockUser(fixture).execute({ blockerId: "me", blockedId: "missing" }),
    ).rejects.toMatchObject({ errorCode: "BLOCK_2202" });
    expect(fixture.userBlockRepository.blocks.size).toBe(0);
  });

  it("자기 자신은 잠금을 잡기 전에 거부한다", async () => {
    // Given
    const fixture = createSocialFriendFixture();
    fixture.addUser("me");

    // When / Then
    await expect(
      new BlockUser(fixture).execute({ blockerId: "me", blockedId: "me" }),
    ).rejects.toMatchObject({ errorCode: "BLOCK_2201" });
    expect(fixture.lockCalls).toEqual([]);
  });
});
