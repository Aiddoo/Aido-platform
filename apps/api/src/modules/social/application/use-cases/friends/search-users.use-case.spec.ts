import { createSocialFriendFixture, SOCIAL_TIME } from "#test/fixtures/social-friends.fixture";

import type { UserSearchResult } from "../../ports/friends/follow.repository.port.js";
import { decodeSearchCursor, encodeSearchCursor } from "./search-cursor.js";
import { SearchUsers } from "./search-users.use-case.js";

function searchRow(id: string, rank: number): UserSearchResult {
  return {
    id,
    rank,
    userTag: "TAG00001",
    profile: null,
    isFollowing: false,
    isFollower: false,
    isFriend: false,
    requestPending: false,
  };
}

describe("사용자 검색", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SOCIAL_TIME);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("검색어를 정규화하고 관계 플래그와 프로필 null을 보존한다", async () => {
    // Given
    const fixture = createSocialFriendFixture();
    const row = searchRow("friend", 0);
    row.isFriend = true;
    fixture.followRepository.searchResults = [row];
    fixture.followRepository.searchTotal = 1;
    const query = vi.spyOn(fixture.followRepository, "searchUsers");
    // When
    const result = await new SearchUsers(fixture).execute({ viewerId: "me", query: "  John  " });
    // Then
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ viewerId: "me", nfcQuery: "John", upperTag: "JOHN" }),
    );
    expect(result).toEqual({ items: [row], totalCount: 1, hasMore: false, nextCursor: null });
  });
  it("초과분을 제거하고 마지막 반환 항목의 rank와 ID로 다음 커서를 만든다", async () => {
    // Given
    const fixture = createSocialFriendFixture();
    fixture.followRepository.searchResults = [
      searchRow("first", 0),
      searchRow("second", 2),
      searchRow("third", 3),
    ];
    fixture.followRepository.searchTotal = 3;
    // When
    const result = await new SearchUsers(fixture).execute({ viewerId: "me", query: "존", size: 2 });
    // Then
    expect(result.items.map((item) => item.id)).toEqual(["first", "second"]);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe(encodeSearchCursor({ rank: 2, id: "second" }));
  });
  it("유효한 커서는 검색 저장소 경계에서 디코딩한다", async () => {
    // Given
    const fixture = createSocialFriendFixture();
    const cursor = encodeSearchCursor({ rank: 0, id: "first" });
    const query = vi.spyOn(fixture.followRepository, "searchUsers");
    // When
    const result = await new SearchUsers(fixture).execute({ viewerId: "me", query: "존", cursor });
    // Then
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: decodeSearchCursor(cursor) }),
    );
    expect(result).toEqual({ items: [], totalCount: 0, hasMore: false, nextCursor: null });
  });
  it.each([
    { query: "  ", cursor: undefined, code: "FOLLOW_0911" },
    { query: "존", cursor: "broken", code: "FOLLOW_0912" },
  ])("잘못된 검색 입력은 $code 오류로 거부하고 저장소에 접근하지 않는다", async (input) => {
    // Given
    const fixture = createSocialFriendFixture();
    const query = vi.spyOn(fixture.followRepository, "searchUsers");
    // When / Then
    await expect(
      new SearchUsers(fixture).execute({
        viewerId: "me",
        query: input.query,
        cursor: input.cursor,
      }),
    ).rejects.toMatchObject({ errorCode: input.code });
    expect(query).not.toHaveBeenCalled();
  });
});
