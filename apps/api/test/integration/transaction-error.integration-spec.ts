import { eq, inArray } from "drizzle-orm";

import {
  databaseConstraint,
  databaseSqlState,
  isTransactionWriteConflict,
} from "#api/platform/database/database-error.util";
import { user } from "#api/platform/database/schema/index";
import { UserFixture } from "#test/fixtures/user.fixture";
import type { TestDatabaseClient } from "#test/setup/test-database";
import { TestDatabase } from "#test/setup/test-database";

describe("트랜잭션 커밋 오류 (실제 PostgreSQL)", () => {
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
    await database.insert(user).values([first, second]);
    const bothRead = Promise.withResolvers<void>();
    const bothWritten = Promise.withResolvers<void>();
    const firstCommitted = Promise.withResolvers<void>();
    let readers = 0;
    let writers = 0;
    async function runTransaction(userId: string, waitsForFirstCommit: boolean): Promise<void> {
      await database
        .transaction(
          async (transaction) => {
            await transaction
              .select({ aiUsageCount: user.aiUsageCount })
              .from(user)
              .where(inArray(user.id, [first.id, second.id]));
            readers += 1;
            if (readers === 2) {
              bothRead.resolve();
            }
            await bothRead.promise;
            await transaction.update(user).set({ aiUsageCount: 1 }).where(eq(user.id, userId));
            writers += 1;
            if (writers === 2) {
              bothWritten.resolve();
            }
            await bothWritten.promise;
            if (waitsForFirstCommit) {
              await firstCommitted.promise;
            }
          },
          { isolationLevel: "serializable" },
        )
        .catch((error: unknown) => {
          bothRead.resolve();
          bothWritten.resolve();
          firstCommitted.resolve();
          throw error;
        });
    }

    // When
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
    if (conflict === undefined) {
      throw new Error("Expected commit conflict");
    }
    const error = conflict.error;
    expect(databaseSqlState(error)).toBe("40001");
    expect(isTransactionWriteConflict(error)).toBe(true);
    expect(databaseConstraint(error)).toBeUndefined();
    const users = await database
      .select({ id: user.id, aiUsageCount: user.aiUsageCount })
      .from(user)
      .where(inArray(user.id, [first.id, second.id]));
    for (const result of results) {
      expect(users.find((row) => row.id === result.userId)?.aiUsageCount).toBe(
        result.error === null ? 1 : 0,
      );
    }
  });
});
