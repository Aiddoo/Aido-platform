import { createSocialFriendFixture, SOCIAL_TIME } from "#test/fixtures/social-friends.fixture";

import { ReorderFriend } from "./reorder-friend.use-case.js";

describe("친구 목록 정렬", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SOCIAL_TIME);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function fixtureWithFriends() {
    const fixture = createSocialFriendFixture();
    fixture.addUser("me");
    const friends = ["first", "second", "third"].map((id, index) => {
      fixture.addUser(id);
      return fixture.addMutual("me", id, index);
    });
    return { ...fixture, friends };
  }
  it("타인의 관계나 없는 기준 관계이면 FOLLOW_0910으로 거부하고 정렬을 유지한다", async () => {
    // Given
    const fixture = fixtureWithFriends();
    const first = fixture.friends[0]!;
    const before = structuredClone([...fixture.followRepository.follows.values()]);
    // When / Then
    await expect(
      new ReorderFriend(fixture).execute({
        followId: first.id,
        userId: "other",
        position: "before",
      }),
    ).rejects.toMatchObject({ errorCode: "FOLLOW_0910" });
    await expect(
      new ReorderFriend(fixture).execute({
        followId: first.id,
        userId: "me",
        targetFollowId: "missing",
        position: "before",
      }),
    ).rejects.toMatchObject({ errorCode: "FOLLOW_0910" });
    expect([...fixture.followRepository.follows.values()]).toEqual(before);
  });
  it("자기 자신을 기준으로 요청하면 쓰기 없이 기존 순서를 반환한다", async () => {
    // Given
    const fixture = fixtureWithFriends();
    const first = fixture.friends[0]!;
    const update = vi.spyOn(fixture.followRepository, "updateFollowSortOrder");
    const shift = vi.spyOn(fixture.followRepository, "shiftFriendSortOrders");
    // When
    const result = await new ReorderFriend(fixture).execute({
      followId: first.id,
      targetFollowId: first.id,
      userId: "me",
      position: "before",
    });
    // Then
    expect(result.sortOrder).toBe(0);
    expect(update).not.toHaveBeenCalled();
    expect(shift).not.toHaveBeenCalled();
  });
  it.each([
    {
      name: "세 번째를 첫 번째 앞으로",
      source: 2,
      target: 0,
      position: "before",
      expected: [1, 2, 0],
    },
    {
      name: "첫 번째를 목록 맨 뒤로",
      source: 0,
      target: undefined,
      position: "after",
      expected: [2, 0, 1],
    },
  ] satisfies Array<{
    name: string;
    source: number;
    target: number | undefined;
    position: "before" | "after";
    expected: number[];
  }>)("$name 이동하면 자신의 목록 구간만 재정렬한다", async (input) => {
    // Given
    const fixture = fixtureWithFriends();
    const source = fixture.friends[input.source]!;
    // When
    await new ReorderFriend(fixture).execute({
      followId: source.id,
      targetFollowId: input.target === undefined ? undefined : fixture.friends[input.target]?.id,
      userId: "me",
      position: input.position,
    });
    // Then
    expect(
      fixture.friends.map((friend) => fixture.followRepository.follows.get(friend.id)?.sortOrder),
    ).toEqual(input.expected);
    expect(
      [...fixture.followRepository.follows.values()]
        .filter((follow) => follow.followerId !== "me")
        .map((follow) => follow.sortOrder),
    ).toEqual([0, 1, 2]);
  });
});
