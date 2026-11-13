import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { sql } from "drizzle-orm";

import { user as userTable } from "#api/platform/database/schema/index";
import { UserFixture } from "#test/fixtures/index";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const MIGRATIONS_DIR = join(process.cwd(), "drizzle");

// 1.15.2 릴리스 노트의 되돌리기 SQL과 같다. 지운 뒤 모양을 되살리는 길이 실제로 맞는지도 함께 본다
const RECREATE_PUSH_DAILY_BUDGET = [
  `CREATE TABLE "PushDailyBudget" (
    "automatedCount" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) DEFAULT now() NOT NULL,
    "id" serial PRIMARY KEY,
    "lastSentAt" timestamp(3),
    "localDate" date NOT NULL,
    "updatedAt" timestamp(3) NOT NULL,
    "userId" text NOT NULL,
    CONSTRAINT "PushDailyBudget_userId_localDate_key" UNIQUE("userId","localDate")
  )`,
  `ALTER TABLE "PushDailyBudget" ADD CONSTRAINT "PushDailyBudget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
];

function readDropStatements(): string[] {
  const folder = readdirSync(MIGRATIONS_DIR).find((name) =>
    name.endsWith("_drop_push_daily_budget"),
  );
  if (folder == null) {
    throw new Error("drop_push_daily_budget 마이그레이션 폴더 누락");
  }
  return readFileSync(join(MIGRATIONS_DIR, folder, "migration.sql"), "utf8")
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim());
}

describe("drop_push_daily_budget 마이그레이션 (실제 PostgreSQL)", () => {
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

  async function runDrop(seedRow: boolean): Promise<string | null> {
    return client.transaction(async (tx) => {
      for (const statement of RECREATE_PUSH_DAILY_BUDGET) {
        await tx.execute(sql.raw(statement));
      }
      if (seedRow) {
        const user = UserFixture.create();
        await tx.insert(userTable).values(user);
        await tx.execute(
          sql`INSERT INTO "PushDailyBudget" ("localDate", "updatedAt", "userId") VALUES ('2026-11-01', now(), ${user.id})`,
        );
      }
      for (const statement of readDropStatements()) {
        await tx.execute(sql.raw(statement));
      }
      const result = await tx.execute<{ table: string | null }>(
        sql`SELECT to_regclass('public."PushDailyBudget"')::text AS "table"`,
      );
      return result.rows[0]?.table ?? null;
    });
  }

  it("행이 있으면 지우지 않고 migrate 트랜잭션 전체를 실패시킨다", async () => {
    // Given
    const seedRow = true;
    // When
    const run = runDrop(seedRow);
    // Then
    await expect(run).rejects.toMatchObject({
      cause: { code: "P0001", message: "PushDailyBudget에 행 1개가 있어 지우지 않는다" },
    });
  });

  it("비어 있으면 되돌리기 SQL로 만든 모양까지 지운다", async () => {
    // Given
    const seedRow = false;
    // When
    const table = await runDrop(seedRow);
    // Then
    expect(table).toBeNull();
  });
});
