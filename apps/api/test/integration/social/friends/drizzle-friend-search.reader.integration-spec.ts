import { FriendshipId } from "#api/modules/social/friends/domain/friendship-id.vo";
import type { FriendshipPrimitives } from "#api/modules/social/friends/domain/friendship.aggregate";
import { UserSearchTerm } from "#api/modules/social/friends/domain/user-search-term.vo";
import { DrizzleFriendSearchReader } from "#api/modules/social/friends/infrastructure/persistence/drizzle-friend-search.reader";
import { DrizzleFriendshipRepository } from "#api/modules/social/friends/infrastructure/persistence/drizzle-friendship.repository";
import { user, userProfile } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { UserFixture } from "#test/fixtures/index";
import { createFriendshipFixture } from "#test/fixtures/social/friendship.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const VIEWER = "cviewer00000000000000000";
const EXACT_TAG = "cuser0000000000000000001";
const TAG_PREFIX = "cuser0000000000000000002";
const NAME_PREFIX = "cuser0000000000000000003";
const CONTAINS_FIRST = "cuser0000000000000000004";
const CONTAINS_SECOND = "cuser0000000000000000005";
const INACTIVE = "cuser0000000000000000006";

describe("사용자 검색 조회 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let friendshipRepository: DrizzleFriendshipRepository;
  let searchReader: DrizzleFriendSearchReader;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
    await client
      .insert(user)
      .values([
        UserFixture.create({ id: VIEWER, userTag: "VIEW0001" }),
        UserFixture.create({ id: EXACT_TAG, userTag: "KIM" }),
        UserFixture.create({ id: TAG_PREFIX, userTag: "KIMA0002" }),
        UserFixture.create({ id: NAME_PREFIX, userTag: "ZZZZ0003" }),
        UserFixture.create({ id: CONTAINS_FIRST, userTag: "AKIM0004" }),
        UserFixture.create({ id: CONTAINS_SECOND, userTag: "BKIM0005" }),
        UserFixture.create({ id: INACTIVE, userTag: "KIMX0006", status: "LOCKED" }),
      ]);
    await client.insert(userProfile).values([
      { userId: VIEWER, name: "kim 본인" },
      { userId: NAME_PREFIX, name: "Kim 지수" },
    ]);
    const { txHost } = createDatabaseTransactionFixture(client);
    friendshipRepository = new DrizzleFriendshipRepository(txHost);
    searchReader = new DrizzleFriendSearchReader(txHost);
  });

  afterAll(async () => {
    await database.stop();
  });

  async function save(overrides: Partial<FriendshipPrimitives>): Promise<void> {
    await friendshipRepository.save(
      createFriendshipFixture({ id: FriendshipId.generate().value, ...overrides }),
    );
  }

  it("태그 정확·태그 앞부분·이름 앞부분·부분 일치 순으로 주고 같은 묶음은 id 순이며 본인·비활성은 뺀다", async () => {
    // Given
    const viewerId = UserId.reconstitute(VIEWER);
    const term = UserSearchTerm.create("kim");

    // When
    const [results, count] = await Promise.all([
      searchReader.searchUsers({ viewerId, term, after: null, limit: 10 }),
      searchReader.countUsers({ viewerId, term }),
    ]);

    // Then
    expect(results.map((result) => [result.user.id, result.rank])).toEqual([
      [EXACT_TAG, 0],
      [TAG_PREFIX, 1],
      [NAME_PREFIX, 2],
      [CONTAINS_FIRST, 3],
      [CONTAINS_SECOND, 3],
    ]);
    expect(results[2]?.user).toEqual({
      id: NAME_PREFIX,
      userTag: "ZZZZ0003",
      name: "Kim 지수",
      profileImage: null,
    });
    expect(count).toBe(5);
  });

  it("커서 (rank, id) 다음부터 이어 준다", async () => {
    // Given
    const viewerId = UserId.reconstitute(VIEWER);
    const term = UserSearchTerm.create("kim");

    // When
    const results = await searchReader.searchUsers({
      viewerId,
      term,
      after: { rank: 3, id: CONTAINS_FIRST },
      limit: 10,
    });

    // Then
    expect(results.map((result) => result.user.id)).toEqual([CONTAINS_SECOND]);
  });

  it("관계 표시는 검색한 사람 기준의 팔로우·팔로워·친구·보낸 요청이다", async () => {
    // Given
    await save({ followerId: VIEWER, followingId: EXACT_TAG, status: "ACCEPTED" });
    await save({ followerId: EXACT_TAG, followingId: VIEWER, status: "ACCEPTED" });
    await save({ followerId: VIEWER, followingId: TAG_PREFIX });
    await save({ followerId: NAME_PREFIX, followingId: VIEWER, status: "ACCEPTED" });

    // When
    const results = await searchReader.searchUsers({
      viewerId: UserId.reconstitute(VIEWER),
      term: UserSearchTerm.create("kim"),
      after: null,
      limit: 3,
    });

    // Then
    expect(
      results.map(({ isFollowing, isFollower, isFriend, isRequestPending }) => ({
        isFollowing,
        isFollower,
        isFriend,
        isRequestPending,
      })),
    ).toEqual([
      { isFollowing: true, isFollower: true, isFriend: true, isRequestPending: false },
      { isFollowing: false, isFollower: false, isFriend: false, isRequestPending: true },
      { isFollowing: false, isFollower: true, isFriend: false, isRequestPending: false },
    ]);
  });
});
