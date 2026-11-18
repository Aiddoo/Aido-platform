import { sql } from "drizzle-orm";

import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

// 1.17.0 스키마에서만 뺀 칸. 1.16.0 이미지가 이름으로 SELECT하므로 1.18.0까지 DB에 남아야 한다
describe("retire_account_oauth_push_token_columns 마이그레이션 (실제 PostgreSQL)", () => {
  const database = new TestDatabase();
  let client: TestDatabaseClient;

  beforeAll(async () => {
    client = await database.start();
  });
  afterAll(async () => {
    await database.stop();
  });

  it.each([
    { table: "Account", column: "accessToken", nullable: "YES", columnDefault: null },
    { table: "Account", column: "accessTokenExpiresAt", nullable: "YES", columnDefault: null },
    { table: "Account", column: "refreshToken", nullable: "YES", columnDefault: null },
    { table: "Account", column: "scope", nullable: "YES", columnDefault: null },
    { table: "OAuthState", column: "codeVerifier", nullable: "YES", columnDefault: null },
    { table: "OAuthState", column: "ipAddress", nullable: "YES", columnDefault: null },
    { table: "OAuthState", column: "userAgent", nullable: "YES", columnDefault: null },
    { table: "PushToken", column: "lastUsedAt", nullable: "NO", columnDefault: "now()" },
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
