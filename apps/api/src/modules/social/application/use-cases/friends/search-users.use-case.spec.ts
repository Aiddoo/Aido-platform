import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { PaginationService } from "#api/shared/application/pagination/index";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";
import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

import {
  type FollowRepositoryPort,
  type UserSearchResult,
} from "../../ports/friends/follow.repository.port.js";
import { decodeSearchCursor, encodeSearchCursor } from "./search-cursor.js";
import { SearchUsers } from "./search-users.use-case.js";

const row = (id: string, rank: number): UserSearchResult => ({
  id,
  userTag: "TAG00001",
  profile: { name: "존", profileImage: null },
  isFollowing: false,
  isFollower: false,
  isFriend: false,
  requestPending: false,
  rank,
});

describe("SearchUsers", () => {
  let useCase: SearchUsers;
  let repo: Mocked<FollowRepositoryPort>;
  let pagination: Mocked<PaginationService>;

  beforeEach(async () => {
    const searchUsersDependencies = mockDeep<ConstructorParameters<typeof SearchUsers>[0]>({});
    const unit = new SearchUsers(searchUsersDependencies);
    useCase = unit;
    repo = searchUsersDependencies.followRepository;
    pagination = searchUsersDependencies.paginationService;

    pagination.normalizeCursorPagination.mockReturnValue({
      cursor: undefined,
      size: 20,
      take: 21,
    });
    repo.countSearchUsers.mockResolvedValue(2);
  });

  it("정규화된 nfc/upperTag로 저장소를 호출한다", async () => {
    repo.searchUsers.mockResolvedValue([row("a", 0), row("b", 2)]);

    await useCase.execute({ viewerId: "me", query: "  John  " });

    expect(repo.searchUsers).toHaveBeenCalledWith(
      expect.objectContaining({
        viewerId: "me",
        nfcQuery: "John",
        upperTag: "JOHN",
        size: 20,
      }),
    );
  });

  it("size+1개가 오면 hasMore=true, 초과분을 잘라내고 nextCursor를 인코딩한다", async () => {
    pagination.normalizeCursorPagination.mockReturnValue({
      cursor: undefined,
      size: 2,
      take: 3,
    });
    repo.searchUsers.mockResolvedValue([row("a", 0), row("b", 2), row("c", 3)]);

    const result = await useCase.execute({ viewerId: "me", query: "존" });

    expect(result.hasMore).toBe(true);
    expect(result.items).toHaveLength(2);
    expect(result.items.map((i) => i.id)).toEqual(["a", "b"]);
    const { nextCursor } = result;
    expect(nextCursor).not.toBeNull();
    if (nextCursor != null) {
      expect(decodeSearchCursor(nextCursor)).toEqual({ rank: 2, id: "b" });
    }
  });

  it("size 이하면 hasMore=false, nextCursor=null", async () => {
    repo.searchUsers.mockResolvedValue([row("a", 0)]);

    const result = await useCase.execute({ viewerId: "me", query: "존" });

    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
    expect(result.totalCount).toBe(2);
  });

  it("커서가 주어지면 디코딩해 저장소에 전달한다", async () => {
    repo.searchUsers.mockResolvedValue([row("a", 0)]);
    const cursor = encodeSearchCursor({ rank: 1, id: "prev" });

    await useCase.execute({ viewerId: "me", query: "존", cursor });

    expect(repo.searchUsers).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { rank: 1, id: "prev" } }),
    );
  });

  it("빈 검색어는 FOLLOW_0911(DomainException)을 던진다", async () => {
    await expect(useCase.execute({ viewerId: "me", query: "   " })).rejects.toBeInstanceOf(
      DomainException,
    );
  });

  it("손상된 커서는 FOLLOW_0912(ApplicationException)를 던진다", async () => {
    await expect(
      useCase.execute({ viewerId: "me", query: "존", cursor: "!!!broken" }),
    ).rejects.toBeInstanceOf(ApplicationException);
  });
});
