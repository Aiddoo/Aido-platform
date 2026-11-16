import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { sql } from "drizzle-orm";

import { user as userTable } from "#api/platform/database/schema/index";
import { UserFixture } from "#test/fixtures/index";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const MIGRATIONS_DIR = join(process.cwd(), "drizzle");

// 1.15.2 릴리스 노트의 되돌리기 SQL과 같다. 지운 칸을 되살린 DB에서 guard를 다시 돌린다
const RECREATE_RETIRED_COLUMNS = [
  `ALTER TABLE "User" ADD COLUMN "twoFactorEnabled" boolean DEFAULT false NOT NULL`,
  `ALTER TABLE "User" ADD COLUMN "twoFactorSecret" varchar(255)`,
  `ALTER TABLE "Subscription" ADD COLUMN "dataRetentionUntil" timestamp(3)`,
];

function readDropStatements(): string[] {
  const folder = readdirSync(MIGRATIONS_DIR).find((name) => name.endsWith("_drop_retired_columns"));
  if (folder == null) {
    throw new Error("drop_retired_columns 마이그레이션 폴더 누락");
  }
  return readFileSync(join(MIGRATIONS_DIR, folder, "migration.sql"), "utf8")
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim());
}

describe("drop_retired_columns 마이그레이션 (실제 PostgreSQL)", () => {
  const database = new TestDatabase();
  let client: TestDatabaseClient;

  beforeAll(async () => {
    client = await database.start();
  });
  beforeEach(async () => {
    await database.cleanup();
  });
  afterAll(async () => {
    await database.stop();
  });

  it.each([
    {
      column: "User.twoFactorSecret",
      seed: (userId: string) =>
        sql`UPDATE "User" SET "twoFactorSecret" = 'secret' WHERE "id" = ${userId}`,
      message: "User 2단계 인증 칸에 값이 있어 지우지 않는다",
    },
    {
      column: "Subscription.dataRetentionUntil",
      seed: (userId: string) =>
        sql`INSERT INTO "Subscription" ("expiresAt", "productId", "startedAt", "status", "revenueCatId", "updatedAt", "userId", "dataRetentionUntil")
          VALUES (now(), 'premium_monthly', now(), 'ACTIVE', 'store-chain-1', now(), ${userId}, now())`,
      message: "Subscription.dataRetentionUntil에 값이 있어 지우지 않는다",
    },
  ])(
    "$column 칸에 값이 있으면 지우지 않고 migrate 트랜잭션 전체를 실패시킨다",
    async ({ seed, message }) => {
      // Given
      const user = UserFixture.create();

      // When
      const run = client.transaction(async (tx) => {
        for (const statement of RECREATE_RETIRED_COLUMNS) {
          await tx.execute(sql.raw(statement));
        }
        await tx.insert(userTable).values(user);
        await tx.execute(seed(user.id));
        for (const statement of readDropStatements()) {
          await tx.execute(sql.raw(statement));
        }
      });

      // Then
      await expect(run).rejects.toMatchObject({ cause: { code: "P0001", message } });
    },
  );
});
