import { UserBlockId } from "#api/modules/social/blocks/domain/user-block-id.vo";
import { DrizzleBlockedUserReader } from "#api/modules/social/blocks/infrastructure/persistence/drizzle-blocked-user.reader";
import { DrizzleUserBlockRepository } from "#api/modules/social/blocks/infrastructure/persistence/drizzle-user-block.repository";
import { follow, user, userBlock, userProfile } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { describeUserBlockRepositoryContract } from "#test/contracts/social/user-block-repository.contract";
import { FollowFixture, UserFixture } from "#test/fixtures/index";
import {
  createUserBlockFixture,
  USER_BLOCK_FIXTURE_BLOCKED_ID,
  USER_BLOCK_FIXTURE_BLOCKER_ID,
  USER_BLOCK_FIXTURE_NOW,
  USER_BLOCK_FIXTURE_OTHER_USER_ID,
} from "#test/fixtures/social/user-block.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const BLOCKER_ID = UserId.reconstitute(USER_BLOCK_FIXTURE_BLOCKER_ID);
const DELETED_USER_ID = "clz7x5p8k0104qz0z8z8z8z8z";
const SUSPENDED_USER_ID = "clz7x5p8k0105qz0z8z8z8z8z";

describe("DrizzleUserBlockRepository (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
    await client.insert(user).values([
      UserFixture.create({ id: USER_BLOCK_FIXTURE_BLOCKER_ID }),
      UserFixture.create({ id: USER_BLOCK_FIXTURE_BLOCKED_ID, userTag: "BLOCKED1" }),
      UserFixture.create({ id: USER_BLOCK_FIXTURE_OTHER_USER_ID, userTag: "OTHER001" }),
      UserFixture.create({
        id: DELETED_USER_ID,
        deletedAt: Temporal.Instant.from("2026-11-01T00:00:00Z"),
      }),
      UserFixture.create({ id: SUSPENDED_USER_ID, status: "SUSPENDED" }),
    ]);
  });

  afterAll(async () => {
    await database.stop();
  });

  function createRepository(): DrizzleUserBlockRepository {
    const { txHost } = createDatabaseTransactionFixture(client);
    return new DrizzleUserBlockRepository(txHost);
  }

  function createBlockedUserReader(): DrizzleBlockedUserReader {
    const { txHost } = createDatabaseTransactionFixture(client);
    return new DrizzleBlockedUserReader(txHost);
  }

  async function insertBlock(blockedId: string, createdAt: Temporal.Instant, id: string) {
    await client.insert(userBlock).values({
      id,
      blockerId: USER_BLOCK_FIXTURE_BLOCKER_ID,
      blockedId,
      createdAt,
    });
  }

  describeUserBlockRepositoryContract(async () => ({
    repository: createRepository(),
    seedFollow: async (followerId, followingId) => {
      await client.insert(follow).values(FollowFixture.create({ followerId, followingId }));
    },
  }));

  it("탈퇴했거나 활성 상태가 아닌 사용자는 차단 대상으로 없다고 본다", async () => {
    // Given
    const repository = createRepository();

    // When
    const exists = [
      await repository.existsActiveUser(UserId.reconstitute(DELETED_USER_ID)),
      await repository.existsActiveUser(UserId.reconstitute(SUSPENDED_USER_ID)),
    ];

    // Then
    expect(exists).toEqual([false, false]);
  });

  it("차단 시각은 ms 3자리 UTC로 저장하고 같은 Instant로 읽는다", async () => {
    // Given
    const repository = createRepository();
    const block = createUserBlockFixture({
      id: (await repository.nextId()).value,
      createdAt: Temporal.Instant.from("2027-01-08T12:00:00.123Z"),
    });

    // When
    await repository.save(block);
    const found = await repository.findByPair(block.blockerId, block.blockedId);

    // Then
    expect(found?.toPrimitives()).toEqual(block.toPrimitives());
  });

  it("공개 reader는 두 사람 사이 차단 방향과, 후보 중 어느 방향으로든 차단 관계인 사용자를 돌려준다", async () => {
    // Given
    const repository = createRepository();
    await insertBlock(
      USER_BLOCK_FIXTURE_BLOCKED_ID,
      USER_BLOCK_FIXTURE_NOW,
      "cblock0000000000000000001",
    );
    await client.insert(userBlock).values({
      blockerId: USER_BLOCK_FIXTURE_OTHER_USER_ID,
      blockedId: USER_BLOCK_FIXTURE_BLOCKER_ID,
    });

    // When
    const blockedId = UserId.reconstitute(USER_BLOCK_FIXTURE_BLOCKED_ID);
    const otherUserId = UserId.reconstitute(USER_BLOCK_FIXTURE_OTHER_USER_ID);
    const relations = [
      await repository.findRelation(BLOCKER_ID, blockedId),
      await repository.findRelation(BLOCKER_ID, otherUserId),
      await repository.findRelation(blockedId, otherUserId),
    ];
    const counterparts = await repository.findBlockedCounterpartIds(BLOCKER_ID, [
      BLOCKER_ID,
      blockedId,
      otherUserId,
      UserId.reconstitute(SUSPENDED_USER_ID),
    ]);

    // Then
    expect(relations).toEqual([
      { isBlocking: true, isBlockedBy: false },
      { isBlocking: false, isBlockedBy: true },
      { isBlocking: false, isBlockedBy: false },
    ]);
    expect([...counterparts].toSorted()).toEqual(
      [USER_BLOCK_FIXTURE_BLOCKED_ID, USER_BLOCK_FIXTURE_OTHER_USER_ID].toSorted(),
    );
  });

  describe("차단한 사용자 목록", () => {
    beforeEach(async () => {
      await client.insert(userProfile).values({
        userId: USER_BLOCK_FIXTURE_BLOCKED_ID,
        name: "차단됨",
        profileImage: "orange_tabby",
      });
      // 같은 시각 두 차단은 id 내림차순, 탈퇴 중인 사용자는 목록·개수에서 빠진다
      await insertBlock(
        USER_BLOCK_FIXTURE_BLOCKED_ID,
        USER_BLOCK_FIXTURE_NOW,
        "cblock0000000000000000001",
      );
      await insertBlock(
        USER_BLOCK_FIXTURE_OTHER_USER_ID,
        USER_BLOCK_FIXTURE_NOW,
        "cblock0000000000000000002",
      );
      await insertBlock(
        SUSPENDED_USER_ID,
        USER_BLOCK_FIXTURE_NOW.subtract({ hours: 1 }),
        "cblock0000000000000000003",
      );
      await insertBlock(
        DELETED_USER_ID,
        USER_BLOCK_FIXTURE_NOW.add({ hours: 1 }),
        "cblock0000000000000000004",
      );
    });

    it("최근에 차단한 순서로 나열하고 after 차단 뒤부터 이어 주며 탈퇴 중인 사용자는 뺀다", async () => {
      // Given
      const reader = createBlockedUserReader();

      // When
      const firstPage = await reader.listByBlockerId({
        blockerId: BLOCKER_ID,
        afterBlockId: null,
        limit: 2,
      });
      const nextPage = await reader.listByBlockerId({
        blockerId: BLOCKER_ID,
        afterBlockId: UserBlockId.reconstitute("cblock0000000000000000002"),
        limit: 5,
      });
      const totalCount = await reader.countByBlockerId(BLOCKER_ID);

      // Then
      expect(firstPage).toEqual([
        {
          blockId: "cblock0000000000000000002",
          userId: USER_BLOCK_FIXTURE_OTHER_USER_ID,
          userTag: "OTHER001",
          name: null,
          profileImage: null,
          blockedAt: USER_BLOCK_FIXTURE_NOW,
        },
        {
          blockId: "cblock0000000000000000001",
          userId: USER_BLOCK_FIXTURE_BLOCKED_ID,
          userTag: "BLOCKED1",
          name: "차단됨",
          profileImage: "orange_tabby",
          blockedAt: USER_BLOCK_FIXTURE_NOW,
        },
      ]);
      expect(nextPage.map((blockedUser) => blockedUser.blockId)).toEqual([
        "cblock0000000000000000001",
        "cblock0000000000000000003",
      ]);
      expect(totalCount).toBe(3);
    });

    it("after 차단이 없거나 남의 차단이면 빈 목록이다", async () => {
      // Given
      const reader = createBlockedUserReader();
      await client.insert(userBlock).values({
        id: "cblock0000000000000000009",
        blockerId: USER_BLOCK_FIXTURE_OTHER_USER_ID,
        blockedId: USER_BLOCK_FIXTURE_BLOCKED_ID,
      });

      // When
      const pages = [
        await reader.listByBlockerId({
          blockerId: BLOCKER_ID,
          afterBlockId: UserBlockId.reconstitute("cblock0000000000000000099"),
          limit: 5,
        }),
        await reader.listByBlockerId({
          blockerId: BLOCKER_ID,
          afterBlockId: UserBlockId.reconstitute("cblock0000000000000000009"),
          limit: 5,
        }),
      ];

      // Then
      expect(pages).toEqual([[], []]);
    });
  });
});
