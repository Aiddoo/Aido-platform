import { createSocialFriendFixture, SOCIAL_TIME } from "#test/fixtures/social-friends.fixture";

describe("친구 관계 읽기 캐시", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SOCIAL_TIME);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("맞팔 false 캐시는 양방향 조회에 재사용하고 관계 변경 이후 무효화해 다시 읽는다", async () => {
    // Given
    const fixture = createSocialFriendFixture();
    fixture.addUser("me");
    fixture.addUser("friend");
    expect(await fixture.reader.isMutualFriend("me", "friend")).toBe(false);
    fixture.addMutual("me", "friend");
    // When / Then
    expect(await fixture.reader.isMutualFriend("friend", "me")).toBe(false);
    await fixture.cache.invalidateMutualFriend("me", "friend");
    expect(await fixture.reader.isMutualFriend("friend", "me")).toBe(true);
  });
  it("캐시된 친구 수와 ID는 유지하면서 권한 판단 경로는 현재 관계를 읽는다", async () => {
    // Given
    const fixture = createSocialFriendFixture();
    fixture.addUser("me");
    fixture.addUser("friend");
    expect(await fixture.reader.countFriends("me")).toBe(0);
    expect(await fixture.reader.getMutualFriendIds("me")).toEqual([]);
    fixture.addMutual("me", "friend");
    // When / Then
    expect(await fixture.reader.countFriends("me")).toBe(0);
    expect(await fixture.reader.getMutualFriendIds("me")).toEqual([]);
    expect(await fixture.reader.getCurrentMutualFriendIds("me")).toEqual(["friend"]);
    await fixture.cache.invalidateFriendCount("me");
    await fixture.cache.invalidateMutualFriendIds("me");
    expect(await fixture.reader.countFriends("me")).toBe(1);
    const ids = await fixture.reader.getMutualFriendIds("me");
    ids.push("unexpected");
    expect(await fixture.reader.getMutualFriendIds("me")).toEqual(["friend"]);
  });
});
