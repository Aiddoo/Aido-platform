import { or } from "@prisma/orm-postgres/orm-client";

import { encodeCreate, encodePatch } from "#api/platform/database/database-records";
import {
  databaseConstraint,
  databaseSqlState,
  isTransactionWriteConflict,
} from "#api/platform/database/prisma-error.util";
import { UserFixture } from "#test/fixtures/user.fixture";
import type { TestDatabaseClient } from "#test/setup/test-database";
import { TestDatabase } from "#test/setup/test-database";

describe("Prisma 트랜잭션 커밋 오류 (실제 PostgreSQL)", () => {
  let testDatabase: TestDatabase;
  let database: TestDatabaseClient;
  beforeAll(async () => {
    testDatabase = new TestDatabase();
    database = await testDatabase.start();
  });
  afterAll(async () => testDatabase.stop());
  beforeEach(async () => testDatabase.cleanup());

  it("Serializable 커밋 wrapper의 SQLSTATE를 찾아 재시도 가능 오류로 분류한다", async () => {
    // Given
    const first = UserFixture.create({ aiUsageCount: 0 });
    const second = UserFixture.create({ aiUsageCount: 0 });
    await database.orm.public.User.createAndCount([
      encodeCreate("User", first),
      encodeCreate("User", second),
    ]);
    const bothRead = Promise.withResolvers<void>();
    const bothWritten = Promise.withResolvers<void>();
    const firstCommitted = Promise.withResolvers<void>();
    let readers = 0;
    let writers = 0;
    async function runTransaction(userId: string, waitsForFirstCommit: boolean): Promise<void> {
      await database
        .transaction(async (transaction) => {
          await transaction.execute(
            database.raw.sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`.affectedCount().build(),
          );
          await transaction.orm.public.User.where((row) =>
            or(row.id.eq(first.id), row.id.eq(second.id)),
          )
            .select("aiUsageCount")
            .all();
          readers += 1;
          if (readers === 2) bothRead.resolve();
          await bothRead.promise;
          await transaction.orm.public.User.where({ id: userId })
            .select("id")
            .update(encodePatch("User", { aiUsageCount: 1 }));
          writers += 1;
          if (writers === 2) bothWritten.resolve();
          await bothWritten.promise;
          if (waitsForFirstCommit) await firstCommitted.promise;
        })
        .catch((error: unknown) => {
          bothRead.resolve();
          bothWritten.resolve();
          firstCommitted.resolve();
          throw error;
        });
    }

    // When - 양쪽 읽기와 쓰기를 모두 완료한 뒤 커밋 순서를 해제해 SSI 충돌을 유도한다.
    const firstExecution = runTransaction(first.id, false).finally(() => firstCommitted.resolve());
    const secondExecution = runTransaction(second.id, true);
    const executions = [
      { userId: first.id, execution: firstExecution },
      { userId: second.id, execution: secondExecution },
    ];
    const results = await Promise.all(
      executions.map(async ({ userId, execution }) => {
        try {
          await execution;
          return { userId, error: null };
        } catch (error) {
          return { userId, error };
        }
      }),
    );

    // Then
    expect(results.filter((result) => result.error === null)).toHaveLength(1);
    const conflict = results.find((result) => result.error !== null);
    if (conflict === undefined) throw new Error("Expected commit conflict");
    const error = conflict.error;
    expect(error).toMatchObject({
      name: "RuntimeError",
      code: "RUNTIME.TRANSACTION_COMMIT_FAILED",
      cause: { kind: "sql_query", sqlState: "40001" },
    });
    expect(databaseSqlState(error)).toBe("40001");
    expect(isTransactionWriteConflict(error)).toBe(true);
    expect(databaseConstraint(error)).toBeUndefined();
    const users = await database.orm.public.User.where((row) =>
      or(row.id.eq(first.id), row.id.eq(second.id)),
    )
      .select("id", "aiUsageCount")
      .all();
    for (const result of results) {
      expect(users.find((user) => user.id === result.userId)?.aiUsageCount).toBe(
        result.error === null ? 1 : 0,
      );
    }
  });
});
