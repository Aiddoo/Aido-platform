import { eq } from "drizzle-orm";

import { User } from "#api/modules/identity/users/domain/user.aggregate";
import { DrizzleUserRepository } from "#api/modules/identity/users/infrastructure/persistence/drizzle-user.repository";
import { user } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { describeUserRepositoryContract } from "#test/contracts/identity/user-repository.contract";
import { DateClock } from "#test/doubles/platform/date-clock";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const CREATED_AT = Temporal.Instant.from("2026-03-01T00:00:00Z");

describe("DrizzleUserRepository (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
  });

  afterAll(async () => {
    await database.stop();
  });

  function createRepository(): DrizzleUserRepository {
    const { transactionHost } = createDatabaseTransactionFixture(client);
    return new DrizzleUserRepository(transactionHost, new DateClock());
  }

  describeUserRepositoryContract(async () => createRepository());

  it("새 사용자 행은 User.create의 시각 하나로 createdAt·updatedAt을 쓴다", async () => {
    // Given
    const repository = createRepository();
    const created = User.create({
      id: UserId.generate(),
      email: "created-at@example.com",
      userTag: await repository.nextUserTag(),
      status: "ACTIVE",
      emailVerifiedAt: null,
      now: CREATED_AT,
    });

    // When
    await repository.save(created);

    // Then
    const [row] = await client
      .select({ createdAt: user.createdAt, updatedAt: user.updatedAt })
      .from(user)
      .where(eq(user.id, created.id.value));
    expect(row?.createdAt.equals(CREATED_AT)).toBe(true);
    expect(row?.updatedAt.equals(CREATED_AT)).toBe(true);
  });
});
