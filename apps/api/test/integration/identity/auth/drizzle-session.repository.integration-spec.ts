import { DrizzleSessionRepository } from "#api/modules/identity/auth/infrastructure/persistence/drizzle-session.repository";
import { user } from "#api/platform/database/schema/index";
import { describeAuthSessionRepositoryContract } from "#test/contracts/identity/auth-session-repository.contract";
import {
  AUTH_FIXTURE_OTHER_USER_ID,
  AUTH_FIXTURE_USER_ID,
  createAuthSessionFixture,
} from "#test/fixtures/identity/auth-session.fixture";
import { UserFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzleSessionRepository (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
    await client.insert(user).values([
      UserFixture.create({
        id: AUTH_FIXTURE_USER_ID,
        email: "owner@example.com",
        userTag: "AUTHOWN1",
      }),
      UserFixture.create({
        id: AUTH_FIXTURE_OTHER_USER_ID,
        email: "other@example.com",
        userTag: "AUTHOTH1",
      }),
    ]);
  });

  afterAll(async () => {
    await database.stop();
  });

  function createRepository(): DrizzleSessionRepository {
    const { txHost } = createDatabaseTransactionFixture(client);
    return new DrizzleSessionRepository(txHost);
  }

  describeAuthSessionRepositoryContract(async () => createRepository());

  it("기기 이름은 DB 칸 길이(64자)에 맞춰 자르고 시각은 ms까지 같은 Instant로 읽는다", async () => {
    // Given
    const repository = createRepository();
    const lastUsedAt = Temporal.Instant.from("2027-01-08T12:00:00.123Z");
    const session = createAuthSessionFixture({
      id: (await repository.nextId()).value,
      deviceFingerprint: "d".repeat(64),
      lastUsedAt,
      createdAt: lastUsedAt,
      expiresAt: lastUsedAt.add({ hours: 24 * 7 }),
    });

    // When
    await repository.save(session);
    const found = await repository.findById(session.id);

    // Then
    expect(found?.toPrimitives()).toEqual(session.toPrimitives());
  });
});
