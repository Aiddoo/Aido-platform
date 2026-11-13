import { sql } from "drizzle-orm";

import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

// 1.15.2 스키마에서만 뺀 칸. 1.15.1 이미지가 이름으로 SELECT·INSERT하므로 1.16.0까지 DB에 남아야 한다
describe("retire_unused_columns 마이그레이션 (실제 PostgreSQL)", () => {
  const database = new TestDatabase();
  let client: TestDatabaseClient;

  beforeAll(async () => {
    client = await database.start();
  });
  afterAll(async () => {
    await database.stop();
  });

  it.each([
    { table: "User", column: "twoFactorEnabled", nullable: "NO", columnDefault: "false" },
    { table: "User", column: "twoFactorSecret", nullable: "YES", columnDefault: null },
    { table: "Subscription", column: "dataRetentionUntil", nullable: "YES", columnDefault: null },
  ])(
    "$table.$column은 DB에 남고 칸 없이 넣어도 채워진다",
    async ({ table, column, nullable, columnDefault }) => {
      // Given
      const target = { table, column };
      // When
      const result = await client.execute<{ nullable: string; columnDefault: string | null }>(
        sql`SELECT is_nullable AS nullable, column_default AS "columnDefault"
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = ${target.table} AND column_name = ${target.column}`,
      );
      // Then
      expect(result.rows).toEqual([{ nullable, columnDefault }]);
    },
  );
});
