import { DrizzleFollowRepository } from "#api/modules/social/friends/infrastructure/persistence/drizzle-follow.repository";
import { DatabaseRecordNotFoundError } from "#api/platform/database/database-error.util";
import { user } from "#api/platform/database/schema/index";
import { describeFollowRepositoryContract } from "#test/contracts/social/follow-repository.contract";
import { UserFixture } from "#test/fixtures/index";
import {
  createFriendshipFixture,
  FRIENDSHIP_FIXTURE_FRIEND_ID,
  FRIENDSHIP_FIXTURE_OTHER_USER_ID,
  FRIENDSHIP_FIXTURE_USER_ID,
} from "#test/fixtures/social/friendship.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzleFollowRepository (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
    await client
      .insert(user)
      .values([
        UserFixture.create({ id: FRIENDSHIP_FIXTURE_USER_ID }),
        UserFixture.create({ id: FRIENDSHIP_FIXTURE_FRIEND_ID }),
        UserFixture.create({ id: FRIENDSHIP_FIXTURE_OTHER_USER_ID }),
      ]);
  });

  afterAll(async () => {
    await database.stop();
  });

  function createRepository(): DrizzleFollowRepository {
    const { txHost } = createDatabaseTransactionFixture(client);
    return new DrizzleFollowRepository(txHost);
  }

  describeFollowRepositoryContract(async () => createRepository());

  it("없는 관계를 지우면 부재 오류를 낸다", async () => {
    // Given
    const repository = createRepository();
    const missing = createFriendshipFixture({ id: (await repository.nextId()).value });

    // When
    const result = repository.delete(missing);

    // Then
    await expect(result).rejects.toBeInstanceOf(DatabaseRecordNotFoundError);
  });

  it("시각은 ms 3자리 UTC로 저장하고 같은 Instant로 읽는다", async () => {
    // Given
    const repository = createRepository();
    const createdAt = Temporal.Instant.from("2027-01-08T12:00:00.123Z");
    const friendship = createFriendshipFixture({
      id: (await repository.nextId()).value,
      createdAt,
      updatedAt: createdAt.add({ seconds: 5 }),
    });

    // When
    await repository.save(friendship);
    const found = await repository.findByFollowerAndFollowing(
      friendship.followerId,
      friendship.followingId,
    );

    // Then
    expect(found?.toPrimitives()).toEqual(friendship.toPrimitives());
  });
});
