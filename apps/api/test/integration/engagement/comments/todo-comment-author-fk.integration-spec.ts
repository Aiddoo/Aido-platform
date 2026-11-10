import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { DELETED_COMMENT_AUTHOR } from "#api/modules/engagement/comments/domain/comments.constants";
import { account, user } from "#api/platform/database/schema/index";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const foreignKeyRuleSchema = z.object({
  constraint_name: z.string(),
  delete_rule: z.string(),
  update_rule: z.string(),
});

class RollbackSeed extends Error {}

function baselineSeedStatement(): string {
  const root = join(import.meta.dirname, "../../../../drizzle");
  const [baseline] = readdirSync(root).sort();
  if (baseline === undefined) {
    throw new Error("Drizzle baseline migration not found");
  }
  const statement = readFileSync(join(root, baseline, "migration.sql"), "utf8")
    .split("--> statement-breakpoint")
    .map((part) => part.trim())
    .find(
      (part) => part.startsWith('INSERT INTO "User"') && part.includes(DELETED_COMMENT_AUTHOR.id),
    );
  if (statement === undefined) {
    throw new Error("Deleted comment author seed not found in baseline migration");
  }
  return statement;
}

describe("댓글 작성자 삭제 대비 제약", () => {
  let testDatabase: TestDatabase;
  let client: TestDatabaseClient;

  beforeAll(async () => {
    testDatabase = new TestDatabase();
    client = await testDatabase.start();
  });
  afterAll(async () => testDatabase.stop());

  it("작성자와 좋아요 FK는 정리가 누락되면 RESTRICT로 막아 데이터 유실을 차단한다", async () => {
    // Given
    const constraintNames = ["TodoComment_authorId_fkey", "TodoCommentLike_userId_fkey"];

    // When
    const { rows } = await client.execute<z.infer<typeof foreignKeyRuleSchema>>(sql`
      SELECT constraint_name, delete_rule, update_rule
      FROM information_schema.referential_constraints
      WHERE constraint_schema = 'public'
        AND constraint_name IN (${sql.join(
          constraintNames.map((name) => sql`${name}`),
          sql`, `,
        )})
    `);

    // Then
    const rules = z.array(foreignKeyRuleSchema).parse(rows);
    expect(rules).toHaveLength(2);
    expect(rules).toEqual(
      expect.arrayContaining([
        {
          constraint_name: "TodoComment_authorId_fkey",
          delete_rule: "RESTRICT",
          update_rule: "CASCADE",
        },
        {
          constraint_name: "TodoCommentLike_userId_fkey",
          delete_rule: "RESTRICT",
          update_rule: "CASCADE",
        },
      ]),
    );
  });

  it("baseline이 만드는 삭제된 작성자는 잠긴 시스템 사용자이고 로그인 계정이 없다", async () => {
    // Given
    const seed = baselineSeedStatement();
    let seeded: (typeof user.$inferSelect)[] = [];
    let accounts: { id: number }[] = [];

    // When
    await client
      .transaction(async (tx) => {
        await tx.delete(user).where(eq(user.id, DELETED_COMMENT_AUTHOR.id));
        await tx.execute(sql.raw(seed));
        seeded = await tx.select().from(user).where(eq(user.id, DELETED_COMMENT_AUTHOR.id));
        accounts = await tx
          .select({ id: account.id })
          .from(account)
          .where(eq(account.userId, DELETED_COMMENT_AUTHOR.id));
        throw new RollbackSeed();
      })
      .catch((error: unknown) => {
        if (!(error instanceof RollbackSeed)) {
          throw error;
        }
      });

    // Then
    expect(seeded).toEqual([
      expect.objectContaining({
        id: DELETED_COMMENT_AUTHOR.id,
        email: DELETED_COMMENT_AUTHOR.email,
        userTag: DELETED_COMMENT_AUTHOR.userTag,
        status: "LOCKED",
      }),
    ]);
    expect(accounts).toEqual([]);
  });
});
