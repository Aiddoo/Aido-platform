import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { asc, eq, sql } from "drizzle-orm";

import { todo, todoCategory, todoComment, user } from "#api/platform/database/schema/index";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const MIGRATION_NAME = "todo_comment_two_level";
const AUTHOR_ID = "two-level-author";
const ROOT = "cm1twolevelroot0000000001";
const CHAIN = [1, 2, 3, 4, 5].map((depth) => `cm1twolevelchain00000000${depth}`);
const SIBLING = "cm1twolevelsibling0000001";
const DELETED_ROOT = "cm1twoleveldeletedroot001";
const DELETED_ROOT_REPLY = "cm1twoleveldeletedreply01";
const LONELY_ROOT = "cm1twolevellonelyroot0001";

function backfillStatements(): string[] {
  const root = join(import.meta.dirname, "../../drizzle");
  const folder = readdirSync(root).find((name) => name.endsWith(`_${MIGRATION_NAME}`));
  if (folder === undefined) {
    throw new Error(`${MIGRATION_NAME} migration not found`);
  }

  return readFileSync(join(root, folder, "migration.sql"), "utf8")
    .split("--> statement-breakpoint")
    .map((part) => part.trim())
    .filter((part) => part.replace(/^(--.*\n)+/, "").startsWith("UPDATE"));
}

describe("댓글 2단계 마이그레이션 backfill (실제 PostgreSQL)", () => {
  let testDatabase: TestDatabase;
  let client: TestDatabaseClient;
  let todoId: number;

  beforeAll(async () => {
    testDatabase = new TestDatabase();
    client = await testDatabase.start();
  }, 60_000);

  beforeEach(async () => {
    await testDatabase.cleanup();
    await client.insert(user).values({
      id: AUTHOR_ID,
      email: "two-level-author@example.com",
      userTag: "TWOLEVEL",
    });
    const [category] = await client
      .insert(todoCategory)
      .values({ userId: AUTHOR_ID, name: "2단계", color: "#123456" })
      .returning();
    if (category === undefined) {
      throw new Error("category fixture was not created");
    }
    const [createdTodo] = await client
      .insert(todo)
      .values({
        userId: AUTHOR_ID,
        categoryId: category.id,
        title: "깊은 대화",
        startDate: new Date("2026-08-26T00:00:00.000Z"),
      })
      .returning();
    if (createdTodo === undefined) {
      throw new Error("todo fixture was not created");
    }
    todoId = createdTodo.id;
  });

  afterAll(async () => testDatabase.stop());

  async function insertLegacyComment(input: {
    id: string;
    ancestors: readonly string[];
    replyCount: number;
    deletedAt?: Date;
    minute: number;
  }) {
    await client.insert(todoComment).values({
      id: input.id,
      todoId,
      authorId: AUTHOR_ID,
      clientRequestId: crypto.randomUUID(),
      content: input.deletedAt == null ? input.id : null,
      deletedAt: input.deletedAt ?? null,
      parentId: input.ancestors.at(-1) ?? null,
      rootId: input.ancestors.at(0) ?? null,
      path: [...input.ancestors],
      depth: input.ancestors.length,
      replyCount: input.replyCount,
      createdAt: new Date(Date.UTC(2026, 7, 26, 1, input.minute)),
    });
  }

  it("깊이 0~5 사슬과 형제 분기를 모두 묶음 머리 아래 2단계로 옮기고 원래 부모를 답글 대상으로 남긴다", async () => {
    // Given
    const deletedAt = new Date("2026-08-26T03:00:00.000Z");
    await insertLegacyComment({ id: ROOT, ancestors: [], replyCount: 1, minute: 0 });
    for (const [index, id] of CHAIN.entries()) {
      await insertLegacyComment({
        id,
        ancestors: [ROOT, ...CHAIN.slice(0, index)],
        replyCount: index === 1 ? 2 : 1,
        deletedAt: index === 2 ? deletedAt : undefined,
        minute: index + 1,
      });
    }
    await insertLegacyComment({
      id: SIBLING,
      ancestors: [ROOT, ...CHAIN.slice(0, 2)],
      replyCount: 0,
      minute: 10,
    });
    await insertLegacyComment({
      id: DELETED_ROOT,
      ancestors: [],
      replyCount: 1,
      deletedAt,
      minute: 20,
    });
    await insertLegacyComment({
      id: DELETED_ROOT_REPLY,
      ancestors: [DELETED_ROOT],
      replyCount: 0,
      deletedAt,
      minute: 21,
    });
    await insertLegacyComment({ id: LONELY_ROOT, ancestors: [], replyCount: 0, minute: 30 });

    // When
    for (const statement of backfillStatements()) {
      await client.execute(sql.raw(statement));
    }

    // Then
    const rows = await client
      .select({
        id: todoComment.id,
        parentId: todoComment.parentId,
        replyToCommentId: todoComment.replyToCommentId,
        rootId: todoComment.rootId,
        path: todoComment.path,
        depth: todoComment.depth,
        replyCount: todoComment.replyCount,
      })
      .from(todoComment)
      .where(eq(todoComment.todoId, todoId))
      .orderBy(asc(todoComment.createdAt));
    const byId = new Map(rows.map((row) => [row.id, row]));
    const reply = (id: string, replyToCommentId: string) => ({
      id,
      parentId: ROOT,
      replyToCommentId,
      rootId: ROOT,
      path: [ROOT],
      depth: 1,
      replyCount: 0,
    });

    expect(byId.get(ROOT)).toMatchObject({
      parentId: null,
      replyToCommentId: null,
      depth: 0,
      replyCount: 5,
    });
    expect(CHAIN.map((id) => byId.get(id))).toEqual([
      reply(CHAIN[0] ?? "", ROOT),
      reply(CHAIN[1] ?? "", CHAIN[0] ?? ""),
      reply(CHAIN[2] ?? "", CHAIN[1] ?? ""),
      reply(CHAIN[3] ?? "", CHAIN[2] ?? ""),
      reply(CHAIN[4] ?? "", CHAIN[3] ?? ""),
    ]);
    expect(byId.get(SIBLING)).toEqual(reply(SIBLING, CHAIN[1] ?? ""));
    expect(byId.get(DELETED_ROOT)).toMatchObject({ parentId: null, replyCount: 0 });
    expect(byId.get(DELETED_ROOT_REPLY)).toMatchObject({
      parentId: DELETED_ROOT,
      replyToCommentId: DELETED_ROOT,
      replyCount: 0,
    });
    expect(byId.get(LONELY_ROOT)).toMatchObject({ parentId: null, replyCount: 0 });
  });

  it("이미 2단계인 행에 다시 실행해도 답글 대상과 답글 수가 바뀌지 않는다", async () => {
    // Given
    await insertLegacyComment({ id: ROOT, ancestors: [], replyCount: 0, minute: 0 });
    await insertLegacyComment({ id: CHAIN[0] ?? "", ancestors: [ROOT], replyCount: 0, minute: 1 });
    await insertLegacyComment({
      id: CHAIN[1] ?? "",
      ancestors: [ROOT, CHAIN[0] ?? ""],
      replyCount: 0,
      minute: 2,
    });
    const statements = backfillStatements();
    for (const statement of statements) {
      await client.execute(sql.raw(statement));
    }
    const once = await client.select().from(todoComment).orderBy(asc(todoComment.id));

    // When
    for (const statement of statements) {
      await client.execute(sql.raw(statement));
    }

    // Then
    const twice = await client.select().from(todoComment).orderBy(asc(todoComment.id));
    expect(twice.map(({ updatedAt: _u, ...row }) => row)).toEqual(
      once.map(({ updatedAt: _u, ...row }) => row),
    );
  });
});
