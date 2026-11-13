import { ErrorCode } from "@aido/api/errors";

import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { StubFriendSearchReader } from "#test/doubles/social/stub-friend-search-reader";
import { FRIENDSHIP_FIXTURE_USER_ID } from "#test/fixtures/social/friendship.fixture";

import type { UserSearchResultReadModel } from "../read-models/user-search-result.read-model.js";
import { encodeUserSearchCursor } from "../user-search-cursor.mapper.js";
import { SearchUsersUseCase } from "./search-users.use-case.js";

const VIEWER = FRIENDSHIP_FIXTURE_USER_ID;

function searchResult(id: string, rank: number): UserSearchResultReadModel {
  return {
    user: { id, userTag: "TAG00001", name: null, profileImage: null },
    isFollowing: false,
    isFollower: false,
    isFriend: false,
    isRequestPending: false,
    rank,
  };
}

function setup(results: readonly UserSearchResultReadModel[] = [], totalCount?: number) {
  const searchReader = new StubFriendSearchReader(results, totalCount);
  const useCase = new SearchUsersUseCase({ searchReader, logger: new SilentLogger() });
  return { useCase, searchReader };
}

describe("SearchUsersUseCase — 사용자 검색", () => {
  it("정리한 검색어와 대문자 태그로 size+1개를 찾고 전체 개수를 함께 준다", async () => {
    // Given
    const { useCase, searchReader } = setup([searchResult("first", 0)], 1);

    // When
    const result = await useCase.execute({ viewerId: VIEWER, query: "  John  " });

    // Then
    expect(searchReader.searches).toEqual([
      { viewerId: VIEWER, term: "John", upperTag: "JOHN", after: null, limit: 21 },
    ]);
    expect(result.page.items.map((item) => item.user.id)).toEqual(["first"]);
    expect(result.totalCount).toBe(1);
    expect(result.page.pagination).toMatchObject({ hasNext: false, nextCursor: null });
  });

  it("다음 페이지가 있으면 마지막으로 준 결과의 rank와 id로 커서를 만들고 그 커서를 풀어 이어 찾는다", async () => {
    // Given
    const { useCase, searchReader } = setup(
      [searchResult("first", 0), searchResult("second", 2), searchResult("third", 3)],
      3,
    );

    // When
    const first = await useCase.execute({ viewerId: VIEWER, query: "존", size: 2 });
    await useCase.execute({
      viewerId: VIEWER,
      query: "존",
      size: 2,
      cursor: first.page.pagination.nextCursor ?? undefined,
    });

    // Then
    expect(first.page.items.map((item) => item.user.id)).toEqual(["first", "second"]);
    expect(first.page.pagination).toMatchObject({
      hasNext: true,
      nextCursor: encodeUserSearchCursor({ position: { rank: 2, id: "second" }, totalCount: 3 }),
    });
    expect(searchReader.searches[1]?.after).toEqual({ rank: 2, id: "second" });
  });

  it("다음 쪽은 커서에 실은 총수를 그대로 주고 다시 세지 않으며, 총수 없는 옛 커서는 다시 센다", async () => {
    // Given
    const { useCase, searchReader } = setup(
      [searchResult("first", 0), searchResult("second", 2)],
      9,
    );
    const position = { rank: 0, id: "first" };

    // When
    const withTotal = await useCase.execute({
      viewerId: VIEWER,
      query: "존",
      size: 1,
      cursor: encodeUserSearchCursor({ position, totalCount: 7 }),
    });
    const countsBeforeLegacy = searchReader.countCalls;
    const legacy = await useCase.execute({
      viewerId: VIEWER,
      query: "존",
      size: 1,
      cursor: encodeUserSearchCursor({ position, totalCount: null }),
    });

    // Then
    expect({ total: withTotal.totalCount, counts: countsBeforeLegacy }).toEqual({
      total: 7,
      counts: 0,
    });
    expect({ total: legacy.totalCount, counts: searchReader.countCalls }).toEqual({
      total: 9,
      counts: 1,
    });
    expect(legacy.page.pagination.nextCursor).toBe(
      encodeUserSearchCursor({ position: { rank: 0, id: "first" }, totalCount: 9 }),
    );
  });

  it.each([
    { query: "  ", cursor: undefined, code: ErrorCode.FOLLOW_0911 },
    { query: "존", cursor: "broken", code: ErrorCode.FOLLOW_0912 },
    { query: "  ", cursor: "broken", code: ErrorCode.FOLLOW_0911 },
  ])("잘못된 검색 입력은 $code로 거절하고 검색하지 않는다", async ({ query, cursor, code }) => {
    // Given
    const { useCase, searchReader } = setup();

    // When
    const result = useCase.execute({ viewerId: VIEWER, query, cursor });

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: code });
    expect(searchReader.searches).toEqual([]);
  });
});
