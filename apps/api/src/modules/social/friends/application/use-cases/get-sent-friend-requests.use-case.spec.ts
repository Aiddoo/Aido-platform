import { createSocialFriendFixture, SOCIAL_TIME } from "#test/fixtures/social-friends.fixture";

import { GetSentFriendRequests } from "./get-sent-friend-requests.use-case.js";

describe("보낸 친구 요청 조회", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SOCIAL_TIME);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("size+1 조회 결과를 잘라내고 전체 개수와 다음 페이지 여부를 유지한다", async () => {
    // Given
    const fixture = createSocialFriendFixture();
    fixture.addUser("me");
    ["first", "second", "third"].forEach((userId) => {
      fixture.addUser(userId);
      fixture.followRepository.seed({ followerId: "me", followingId: userId });
    });
    // When
    const result = await new GetSentFriendRequests(fixture).execute({ userId: "me", size: 2 });
    // Then
    expect(result).toMatchObject({ totalCount: 3, hasMore: true });
    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => item.followingId)).toEqual(["first", "second"]);
  });
  it("다른 사용자의 관계가 있어도 내 목록이 비어 있으면 빈 페이지를 반환한다", async () => {
    // Given
    const fixture = createSocialFriendFixture();
    fixture.addUser("other");
    fixture.addUser("friend");
    fixture.addMutual("other", "friend");
    // When
    const result = await new GetSentFriendRequests(fixture).execute({ userId: "me" });
    // Then
    expect(result).toEqual({ items: [], totalCount: 0, hasMore: false });
  });
});
