import { sql } from "drizzle-orm";

import { TestDatabase } from "../setup/test-database.js";

describe("TestDatabase 통합 테스트 (실제 DB)", () => {
  let testDatabase: TestDatabase;

  beforeAll(async () => {
    testDatabase = new TestDatabase();
    await testDatabase.start();
  });

  afterAll(async () => {
    await testDatabase.stop();
  });

  it("globalSetup에서 Drizzle migration이 적용되어 있어야 한다", async () => {
    // Given
    const client = testDatabase.getClient();

    const { rows } = await client.execute<{ history: string | null; user_table: string | null }>(
      sql`SELECT to_regclass('drizzle.__drizzle_migrations')::text AS history, to_regclass('public."User"')::text AS user_table`,
    );
    expect(rows).toEqual([{ history: "drizzle.__drizzle_migrations", user_table: '"User"' }]);
  });

  it("cleanup이 public 데이터와 sequence를 초기화해야 한다", async () => {
    // Given
    const client = testDatabase.getClient();
    await client.execute(sql`CREATE TABLE "TestSequenceReset" ("id" SERIAL PRIMARY KEY)`);

    try {
      const first = await client.execute<{ id: number }>(
        sql`INSERT INTO "TestSequenceReset" DEFAULT VALUES RETURNING "id"`,
      );
      expect(first.rows[0]?.id).toBe(1);

      // When
      await testDatabase.cleanup();
      const second = await client.execute<{ id: number }>(
        sql`INSERT INTO "TestSequenceReset" DEFAULT VALUES RETURNING "id"`,
      );

      // Then
      expect(second.rows[0]?.id).toBe(1);
    } finally {
      await client.execute(sql`DROP TABLE IF EXISTS "TestSequenceReset"`);
    }
  });
});
