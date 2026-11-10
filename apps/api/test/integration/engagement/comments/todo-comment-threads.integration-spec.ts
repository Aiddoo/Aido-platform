import { z } from "@aido/api";
import { Test, type TestingModule } from "@nestjs/testing";
import { eq, sql } from "drizzle-orm";

import { ListTodoCommentRepliesUseCase } from "#api/modules/engagement/comments/application/use-cases/list-todo-comment-replies.use-case";
import { ListTodoCommentThreadsUseCase } from "#api/modules/engagement/comments/application/use-cases/list-todo-comment-threads.use-case";
import { engagementCommentsConfig } from "#api/modules/engagement/comments/engagement-comments.config";
import { HmacTodoCommentCursorCodecAdapter } from "#api/modules/engagement/comments/infrastructure/adapters/hmac-todo-comment-cursor-codec.adapter";
import { DrizzleTodoCommentReader } from "#api/modules/engagement/comments/infrastructure/persistence/drizzle-todo-comment.reader";
import { DrizzleTodoDetailsReader } from "#api/modules/planning/todos/infrastructure/persistence/drizzle-todo-details.reader";
import { DrizzleUserBlockRepository } from "#api/modules/social/blocks/infrastructure/persistence/drizzle-user-block.repository";
import { todo, todoCategory, todoComment, user } from "#api/platform/database/schema/index";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import type { TestDatabaseClient } from "#test/setup/test-database";

import { TestDatabase } from "../../../setup/test-database.js";

const OWNER_ID = "threads-owner";
const FRIEND_ID = "threads-friend";
const THREAD_COUNT = 100;
const REPLIES_PER_THREAD = 4;
const OTHER_TODO_COUNT = 20;
const BUSY_THREAD = "cm1threadsbusythread0000001";
const BUSY_REPLY_COUNT = 23;
const DELETED_BUSY_REPLY_INDEX = 7;

const planNodeSchema = z
  .object({
    "Node Type": z.string(),
    "Relation Name": z.string().optional(),
    Plans: z.array(z.unknown()).optional(),
  })
  .loose();
const explainSchema = z.array(
  z.object({ Plan: z.unknown(), "Execution Time": z.number() }).loose(),
);

function seqScannedRelations(plan: unknown): string[] {
  const node = planNodeSchema.safeParse(plan);
  if (!node.success) {
    return [];
  }

  const own =
    node.data["Node Type"] === "Seq Scan" && node.data["Relation Name"] != null
      ? [node.data["Relation Name"]]
      : [];
  return [...own, ...(node.data.Plans ?? []).flatMap(seqScannedRelations)];
}

function busyReplyId(index: number): string {
  return `cm1threadsbusyreply${String(index).padStart(8, "0")}`;
}

describe("댓글 v2 묶음·답글 읽기 (실제 PostgreSQL)", () => {
  let testDatabase: TestDatabase;
  let client: TestDatabaseClient;
  let threads: ListTodoCommentThreadsUseCase;
  let replies: ListTodoCommentRepliesUseCase;
  let cursorModule: TestingModule;
  let todoId: number;
  let recording: { sql: string; params: unknown[] }[] | null = null;

  beforeAll(async () => {
    testDatabase = new TestDatabase({
      createClient: (url) =>
        createTestClient(url, {}, (statement, params) => {
          recording?.push({ sql: statement, params });
        }),
    });
    client = await testDatabase.start();
    const { txHost } = createDatabaseTransactionFixture(client);
    const reader = new DrizzleTodoCommentReader(txHost, new DrizzleTodoDetailsReader(txHost));
    const blockReader = new DrizzleUserBlockRepository(txHost);
    cursorModule = await Test.createTestingModule({
      providers: [
        HmacTodoCommentCursorCodecAdapter,
        {
          provide: engagementCommentsConfig.KEY,
          useValue: {
            cursorSigning: {
              configured: undefined,
              legacySecret: "integration-jwt-secret-at-least-32-characters",
            },
          },
        },
      ],
    }).compile();
    const cursorCodec = cursorModule.get(HmacTodoCommentCursorCodecAdapter);
    threads = new ListTodoCommentThreadsUseCase({ reader, cursorCodec, blockReader });
    replies = new ListTodoCommentRepliesUseCase({ reader, cursorCodec, blockReader });

    await testDatabase.cleanup();
    await client.insert(user).values([
      {
        id: OWNER_ID,
        email: "threads-owner@example.com",
        userTag: "THREADSO",
        updatedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
      },
      {
        id: FRIEND_ID,
        email: "threads-friend@example.com",
        userTag: "THREADSF",
        updatedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
      },
    ]);
    const [category] = await client
      .insert(todoCategory)
      .values({
        userId: OWNER_ID,
        name: "묶음",
        color: "#123456",
        updatedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
      })
      .returning();
    if (category === undefined) {
      throw new Error("category fixture was not created");
    }
    const todos = await client
      .insert(todo)
      .values(
        Array.from({ length: OTHER_TODO_COUNT + 1 }, (_, index) => ({
          userId: OWNER_ID,
          categoryId: category.id,
          title: `묶음 할 일 ${index}`,
          startDate: new Date("2026-08-26T00:00:00.000Z"),
        })),
      )
      .returning({ id: todo.id });
    const target = todos.at(0);
    if (target === undefined) {
      throw new Error("todo fixture was not created");
    }
    todoId = target.id;

    // 할 일마다 댓글 100개와 각 4개의 답글(500행)을 만들어 다른 할 일의 행이 인덱스를 거치지 않으면 드러나게 한다.
    await client.execute(sql`
      WITH heads AS (
        INSERT INTO ${todoComment} ("id", "todoId", "authorId", "clientRequestId", "content", "replyCount", "likeCount", "createdAt", "updatedAt")
        SELECT
          'cm1threadshead' || lpad(t."id"::TEXT, 4, '0') || lpad(n::TEXT, 8, '0'),
          t."id",
          ${FRIEND_ID},
          gen_random_uuid(),
          '댓글 ' || n,
          ${REPLIES_PER_THREAD},
          n % 7,
          TIMESTAMP '2026-08-26 00:00:00' + n * INTERVAL '1 minute',
          TIMESTAMP '2026-08-26 00:00:00' + n * INTERVAL '1 minute'
        FROM ${todo} AS t
        CROSS JOIN generate_series(1, ${THREAD_COUNT}) AS n
        RETURNING "id", "todoId", "createdAt"
      )
      INSERT INTO ${todoComment} ("id", "todoId", "authorId", "clientRequestId", "content", "parentId", "replyToCommentId", "createdAt", "updatedAt")
      SELECT
        heads."id" || 'r' || r,
        heads."todoId",
        CASE WHEN r = 2 THEN ${OWNER_ID} ELSE ${FRIEND_ID} END,
        gen_random_uuid(),
        '답글 ' || r,
        heads."id",
        heads."id",
        heads."createdAt" + r * INTERVAL '1 second',
        heads."createdAt" + r * INTERVAL '1 second'
      FROM heads
      CROSS JOIN generate_series(1, ${REPLIES_PER_THREAD}) AS r
    `);
    await client.insert(todoComment).values({
      id: BUSY_THREAD,
      todoId,
      authorId: FRIEND_ID,
      clientRequestId: crypto.randomUUID(),
      content: "답글이 많은 댓글",
      replyCount: BUSY_REPLY_COUNT - 1,
      createdAt: Temporal.Instant.from("2026-08-25T00:00:00.000Z"),
      updatedAt: Temporal.Instant.from("2026-08-25T00:00:00.000Z"),
    });
    await client.insert(todoComment).values(
      Array.from({ length: BUSY_REPLY_COUNT }, (_, index) => ({
        id: busyReplyId(index),
        todoId,
        authorId: index % 2 === 0 ? FRIEND_ID : OWNER_ID,
        clientRequestId: crypto.randomUUID(),
        content: index === DELETED_BUSY_REPLY_INDEX ? null : `답글 ${index}`,
        deletedAt:
          index === DELETED_BUSY_REPLY_INDEX
            ? Temporal.Instant.from("2026-08-25T05:00:00.000Z")
            : null,
        parentId: BUSY_THREAD,
        replyToCommentId: index === 0 ? BUSY_THREAD : busyReplyId(index - 1),
        createdAt: Temporal.Instant.fromEpochMilliseconds(Date.UTC(2026, 7, 25, 1, index)),
        updatedAt: Temporal.Instant.fromEpochMilliseconds(Date.UTC(2026, 7, 25, 1, index)),
      })),
    );
    await client.execute(sql`ANALYZE ${todoComment}`);
  }, 120_000);

  afterAll(async () => {
    await cursorModule?.close();
    await testDatabase.stop();
  });

  async function explain(work: () => Promise<unknown>) {
    const statements: { sql: string; params: unknown[] }[] = [];
    recording = statements;
    try {
      await work();
    } finally {
      recording = null;
    }
    return Promise.all(
      statements
        .filter((statement) => statement.sql.includes('"TodoComment"'))
        .map(async (statement) => {
          const result = await client.$client.query(
            `EXPLAIN (ANALYZE, FORMAT JSON) ${statement.sql}`,
            statement.params,
          );
          const [plan] = explainSchema.parse(result.rows[0]?.["QUERY PLAN"]);
          return {
            executionMs: plan?.["Execution Time"] ?? 0,
            seqScans: seqScannedRelations(plan?.Plan),
          };
        }),
    );
  }

  it("묶음 목록은 양방향 cursor로 겹치거나 빠지지 않고 끝까지 읽힌다", async () => {
    // Given
    const input = { todoId, viewerId: OWNER_ID, sort: "LATEST", size: 30 } as const;
    const seen: string[] = [];

    // When
    let page = await threads.execute({ ...input, page: { kind: "FIRST" } });
    seen.push(...page.items.map((item) => item.comment.id));
    while (page.pagination.nextCursor !== null) {
      page = await threads.execute({
        ...input,
        page: { kind: "CURSOR", cursor: page.pagination.nextCursor },
      });
      seen.push(...page.items.map((item) => item.comment.id));
    }
    const back = await threads.execute({
      ...input,
      page: { kind: "CURSOR", cursor: page.pagination.previousCursor ?? "" },
    });

    // Then
    expect(seen).toHaveLength(THREAD_COUNT + 1);
    expect(new Set(seen).size).toBe(THREAD_COUNT + 1);
    expect(seen.at(-1)).toBe(BUSY_THREAD);
    expect(back.items.map((item) => item.comment.id)).toEqual(seen.slice(-41, -11));
  });

  it("대표 답글은 할 일 주인의 답글이고 답글 수는 지운 답글을 빼고 센다", async () => {
    // Given / When
    const page = await threads.execute({
      todoId,
      viewerId: OWNER_ID,
      sort: "LATEST",
      size: 1,
      page: { kind: "ANCHOR", commentId: busyReplyId(12) },
    });

    // Then
    expect(page.anchor).toEqual({ threadCommentId: BUSY_THREAD, replyId: busyReplyId(12) });
    expect(page.items[0]).toMatchObject({
      comment: { id: BUSY_THREAD },
      previewReply: { id: busyReplyId(1), authorId: OWNER_ID },
      totalCount: BUSY_REPLY_COUNT - 1,
      participantAuthors: [{ id: OWNER_ID, isTodoOwner: true }, { id: FRIEND_ID }],
    });
    expect(page.pagination.hasPrevious).toBe(true);
    expect(page.pagination.hasNext).toBe(false);
  });

  it("답글은 작성 순 cursor로 지운 답글 없이 끝까지 읽히고 aroundReplyId 페이지에 그 답글이 있다", async () => {
    // Given
    const input = { todoId, viewerId: OWNER_ID, threadCommentId: BUSY_THREAD, size: 10 };
    const seen: string[] = [];

    // When
    let page = await replies.execute(input);
    seen.push(...page.items.map((item) => item.id));
    while (page.pagination.nextCursor !== null) {
      page = await replies.execute({ ...input, cursor: page.pagination.nextCursor });
      seen.push(...page.items.map((item) => item.id));
    }
    const around = await replies.execute({ ...input, aroundReplyId: busyReplyId(15) });
    const before = await replies.execute({
      ...input,
      cursor: around.pagination.previousCursor ?? "",
    });
    const deletedAround = await replies.execute({
      ...input,
      aroundReplyId: busyReplyId(DELETED_BUSY_REPLY_INDEX),
    });

    // Then
    const visible = Array.from({ length: BUSY_REPLY_COUNT }, (_, index) => index)
      .filter((index) => index !== DELETED_BUSY_REPLY_INDEX)
      .map(busyReplyId);
    expect(seen).toEqual(visible);
    expect(around.items.map((item) => item.id)).toContain(busyReplyId(15));
    expect(around.pagination).toMatchObject({ hasPrevious: true, hasNext: true });
    expect([...before.items, ...around.items].map((item) => item.id)).toEqual(
      visible.slice(
        visible.indexOf(before.items[0]?.id ?? ""),
        visible.indexOf(around.items.at(-1)?.id ?? "") + 1,
      ),
    );
    expect(deletedAround.items.map((item) => item.id)).toEqual(visible.slice(0, 10));
  });

  it("묶음·답글 쿼리는 다른 할 일의 댓글을 순차 탐색하지 않는다 (EXPLAIN ANALYZE)", async () => {
    // Given
    await client.update(todoComment).set({ likeCount: 9 }).where(eq(todoComment.id, BUSY_THREAD));

    // When
    const threadPlans = await explain(() =>
      threads.execute({
        todoId,
        viewerId: OWNER_ID,
        sort: "POPULAR",
        size: 30,
        page: { kind: "FIRST" },
      }),
    );
    const replyPlans = await explain(() =>
      replies.execute({ todoId, viewerId: OWNER_ID, threadCommentId: BUSY_THREAD, size: 10 }),
    );

    // Then
    const plans = [...threadPlans, ...replyPlans];
    expect(plans.length).toBeGreaterThan(0);
    expect(plans.flatMap((plan) => plan.seqScans)).not.toContain("TodoComment");
    console.info(
      "[todo-comment-threads] EXPLAIN ANALYZE ms",
      JSON.stringify({
        threads: threadPlans.map((plan) => plan.executionMs),
        replies: replyPlans.map((plan) => plan.executionMs),
      }),
    );
  });
});
