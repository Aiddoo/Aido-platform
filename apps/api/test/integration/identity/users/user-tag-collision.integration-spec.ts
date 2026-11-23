import { ErrorCode } from "@aido/api/errors";
import { sql } from "drizzle-orm";

import { User } from "#api/modules/identity/users/domain/user.aggregate";
import { DrizzleUserRepository } from "#api/modules/identity/users/infrastructure/persistence/drizzle-user.repository";
import { user } from "#api/platform/database/schema/index";
import { ApplicationException } from "#api/shared/application/application.exception";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { StubUserTagGenerator } from "#test/doubles/identity/stub-user-tag-generator";
import { DateClock } from "#test/doubles/platform/date-clock";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const CLASHING_TAG = "TAGCLASH";

describe("DrizzleUserRepository 태그 충돌 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let competitor: TestDatabaseClient;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
    competitor = createTestClient(database.getConnectionUri(), { max: 1 });
  });

  beforeEach(async () => {
    await database.cleanup();
  });

  afterAll(async () => {
    await competitor.close();
    await database.stop();
  });

  async function waitUntilInsertBlocked(): Promise<void> {
    await vi.waitFor(async () => {
      const result = await client.execute<{ waiting: number }>(sql`
        SELECT count(*)::int AS waiting
        FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'
      `);
      expect(result.rows[0]?.waiting).toBe(1);
    });
  }

  it("확인 뒤 다른 가입이 같은 태그를 먼저 넣으면 1.15.0 필터와 같은 500 SYS_0001로 번역한다", async () => {
    // Given
    const { transactionHost } = createDatabaseTransactionFixture(client);
    const repository = new DrizzleUserRepository(
      transactionHost,
      new DateClock(),
      new StubUserTagGenerator(CLASHING_TAG),
    );

    // When
    const { creating } = await competitor.transaction(async (transaction) => {
      await transaction.insert(user).values({
        email: "first@example.com",
        userTag: CLASHING_TAG,
        updatedAt: Temporal.Now.instant(),
      });
      const pending = repository
        .nextUserTag()
        .then((userTag) =>
          repository.save(
            User.create({
              id: UserId.generate(),
              email: "second@example.com",
              userTag,
              status: "ACTIVE",
              emailVerifiedAt: null,
              now: Temporal.Now.instant(),
            }),
          ),
        )
        .then(
          () => undefined,
          (error: unknown) => error,
        );
      await waitUntilInsertBlocked();
      return { creating: pending };
    });
    const error = await creating;

    // Then
    expect(error).toBeInstanceOf(ApplicationException);
    expect(error).toMatchObject({
      errorCode: ErrorCode.SYS_0001,
      details: { detail: "userTag collision" },
    });
  });
});
