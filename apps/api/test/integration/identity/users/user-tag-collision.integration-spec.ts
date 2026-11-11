import { ErrorCode } from "@aido/api/errors";
import { sql } from "drizzle-orm";

import { DrizzleUserRepository } from "#api/modules/identity/users/infrastructure/persistence/drizzle-user.repository";
import { generateUserTag } from "#api/modules/identity/users/infrastructure/persistence/user-tag.adapter";
import { user } from "#api/platform/database/schema/index";
import { ApplicationException } from "#api/shared/application/application.exception";
import { DateClock } from "#test/doubles/platform/date-clock";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

vi.mock(
  import("#api/modules/identity/users/infrastructure/persistence/user-tag.adapter"),
  async (importOriginal) => {
    const original = await importOriginal();
    return { generateUserTag: vi.fn(original.generateUserTag) };
  },
);

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
    vi.mocked(generateUserTag).mockReturnValue(CLASHING_TAG);
    const { txHost } = createDatabaseTransactionFixture(client);
    const repository = new DrizzleUserRepository(txHost, new DateClock());

    // When
    const { creating } = await competitor.transaction(async (tx) => {
      await tx.insert(user).values({
        email: "first@example.com",
        userTag: CLASHING_TAG,
        updatedAt: Temporal.Now.instant(),
      });
      const pending = repository.create({ email: "second@example.com", status: "ACTIVE" }).then(
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
