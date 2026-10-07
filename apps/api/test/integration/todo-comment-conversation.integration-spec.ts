import { randomUUID } from "node:crypto";

import { z } from "@aido/api";
import { Test, type TestingModule } from "@nestjs/testing";
import sql from "sql-template-tag";
import { vi } from "vitest";

import type { TodoCommentCursorCodecPort } from "#api/modules/engagement/application/ports/comments/todo-comment-cursor-codec.port";
import {
  TodoCommentIdempotencyConflict,
  TodoCommentIdempotencyRace,
} from "#api/modules/engagement/application/ports/comments/todo-comment.repository.port";
import { GetTodoCommentOverview } from "#api/modules/engagement/application/use-cases/comments/get-todo-comment-overview.use-case";
import { GetTodoConversation } from "#api/modules/engagement/application/use-cases/comments/get-todo-conversation.use-case";
import { ThreadPlacement } from "#api/modules/engagement/domain/value-objects/comments/thread-placement.vo";
import { PrismaTodoCommentReader } from "#api/modules/engagement/infrastructure/persistence/comments/prisma-todo-comment.reader";
import { PrismaTodoCommentRepository } from "#api/modules/engagement/infrastructure/persistence/comments/prisma-todo-comment.repository";
import { buildTodoConversationTreeCtes } from "#api/modules/engagement/infrastructure/persistence/comments/todo-conversation-tree.sql";
import { HmacTodoCommentCursorCodec } from "#api/modules/engagement/infrastructure/security/comments/hmac-todo-comment-cursor.codec";
import { TypedConfigService } from "#api/platform/config/services/config.service";
import { decodeRecord, encodeCreate, encodePatch } from "#api/platform/database/database-records";
import { sqlRowSpec, sqlStatement } from "#api/platform/database/database-sql";
import { createEntityId } from "#api/platform/database/database-values";
import { requireRecord } from "#api/platform/database/prisma-error.util";
import { DELETED_COMMENT_AUTHOR, DELETED_COMMENT_AUTHOR_ID } from "#api/shared/domain/system-user";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import type { TestDatabaseClient } from "#test/setup/test-database";
import { createUserDatabaseFixture } from "#test/setup/user-database-fixture";

import { TestDatabase } from "../setup/test-database.js";

const ROOT_A = "cm1conversationroota00000001";
const ROOT_B = "cm1conversationrootb00000001";
const CHILD_A = "cm1conversationchilda0000001";
const CHILD_Z = "cm1conversationchildz0000001";
const GRANDCHILD = "cm1conversationgrandchild0001";
const ROOT_C = "cm1conversationrootc00000001";
const NEW_ROOT = "cm1conversationnewroot000001";
const DELETED_LEAF = "cm1conversationdeletedleaf001";
const OWNER_REPLY = "cm1conversationownerreply0001";
const PARTICIPANT_A_REPLY = "cm1conversationparticipantareply1";
const PARTICIPANT_B_REPLY = "cm1conversationparticipantbreply1";

const explainPlanNodeSchema = z
  .object({
    "Node Type": z.string(),
    "Actual Rows": z.number().optional(),
    Plans: z.array(z.unknown()).optional(),
  })
  .loose();

function findPlanActualRows(plan: unknown, nodeType: string): number | null {
  const parsed = explainPlanNodeSchema.safeParse(plan);
  if (!parsed.success) {
    return null;
  }

  if (parsed.data["Node Type"] === nodeType) {
    return parsed.data["Actual Rows"] ?? null;
  }

  for (const child of parsed.data.Plans ?? []) {
    const actualRows = findPlanActualRows(child, nodeType);
    if (actualRows !== null) {
      return actualRows;
    }
  }

  return null;
}

describe("Todo comment conversation reader (실제 PostgreSQL)", () => {
  let testDatabase: TestDatabase;
  let prisma: TestDatabaseClient;
  let reader: PrismaTodoCommentReader;
  let repository: PrismaTodoCommentRepository;
  let cursorCodec: TodoCommentCursorCodecPort;
  let cursorModule: TestingModule;
  let todoId: number;

  beforeAll(async () => {
    testDatabase = new TestDatabase();
    prisma = await testDatabase.start();
    const { txHost } = createDatabaseTransactionFixture(prisma);
    reader = new PrismaTodoCommentReader(txHost);
    repository = new PrismaTodoCommentRepository(txHost);
    cursorModule = await Test.createTestingModule({
      providers: [
        HmacTodoCommentCursorCodec,
        {
          provide: TypedConfigService,
          useValue: { jwtSecret: "integration-jwt-secret-at-least-32-characters" },
        },
      ],
    }).compile();
    cursorCodec = cursorModule.get(HmacTodoCommentCursorCodec);
  }, 60_000);

  beforeEach(async () => {
    await testDatabase.cleanup();
    decodeRecord(
      "User",
      await prisma.orm.public.User.create(
        encodeCreate("User", {
          id: DELETED_COMMENT_AUTHOR_ID,
          email: DELETED_COMMENT_AUTHOR.email,
          userTag: DELETED_COMMENT_AUTHOR.userTag,
          status: "LOCKED",
        }),
      ),
    );
    const owner = decodeRecord(
      "User",
      await prisma.orm.public.User.create(
        encodeCreate("User", {
          id: "conversation-owner",
          email: "conversation-owner@example.com",
          userTag: "CONVOWNR",
        }),
      ),
    );
    const author = decodeRecord(
      "User",
      await prisma.orm.public.User.create(
        encodeCreate("User", {
          id: "conversation-author",
          email: "conversation-author@example.com",
          userTag: "CONVAUTH",
        }),
      ),
    );
    const category = decodeRecord(
      "TodoCategory",
      await prisma.orm.public.TodoCategory.create(
        encodeCreate("TodoCategory", { userId: owner.id, name: "Conversation", color: "#123456" }),
      ),
    );
    const todo = decodeRecord(
      "Todo",
      await prisma.orm.public.Todo.create(
        encodeCreate("Todo", {
          userId: owner.id,
          categoryId: category.id,
          title: "한 화면의 댓글 대화",
          startDate: new Date("2026-08-26T00:00:00.000Z"),
          commentCount: 5,
        }),
      ),
    );
    todoId = todo.id;

    const rootCreatedAt = new Date("2026-08-26T01:00:00.000Z");
    const siblingCreatedAt = new Date("2026-08-26T02:00:00.000Z");
    decodeRecord(
      "TodoComment",
      await prisma.orm.public.TodoComment.create(
        encodeCreate("TodoComment", {
          id: ROOT_A,
          todoId,
          authorId: author.id,
          clientRequestId: "00000000-0000-4000-8000-000000000001",
          content: "오래된 루트",
          replyCount: 2,
          createdAt: rootCreatedAt,
        }),
      ),
    );
    decodeRecord(
      "TodoComment",
      await prisma.orm.public.TodoComment.create(
        encodeCreate("TodoComment", {
          id: ROOT_B,
          todoId,
          authorId: author.id,
          clientRequestId: "00000000-0000-4000-8000-000000000002",
          content: "최신 루트",
          createdAt: new Date("2026-08-26T03:00:00.000Z"),
        }),
      ),
    );
    decodeRecord(
      "TodoComment",
      await prisma.orm.public.TodoComment.create(
        encodeCreate("TodoComment", {
          id: CHILD_Z,
          todoId,
          authorId: author.id,
          parentId: ROOT_A,
          rootId: ROOT_A,
          path: [ROOT_A],
          depth: 1,
          clientRequestId: "00000000-0000-4000-8000-000000000003",
          content: "같은 시각 id가 뒤인 형제",
          createdAt: siblingCreatedAt,
        }),
      ),
    );
    decodeRecord(
      "TodoComment",
      await prisma.orm.public.TodoComment.create(
        encodeCreate("TodoComment", {
          id: CHILD_A,
          todoId,
          authorId: author.id,
          parentId: ROOT_A,
          rootId: ROOT_A,
          path: [ROOT_A],
          depth: 1,
          clientRequestId: "00000000-0000-4000-8000-000000000004",
          content: "같은 시각 id가 앞인 형제",
          replyCount: 1,
          createdAt: siblingCreatedAt,
        }),
      ),
    );
    decodeRecord(
      "TodoComment",
      await prisma.orm.public.TodoComment.create(
        encodeCreate("TodoComment", {
          id: GRANDCHILD,
          todoId,
          authorId: author.id,
          parentId: CHILD_A,
          rootId: ROOT_A,
          path: [ROOT_A, CHILD_A],
          depth: 2,
          clientRequestId: "00000000-0000-4000-8000-000000000005",
          content: "형제보다 먼저 이어지는 자손",
          createdAt: new Date("2026-08-26T02:30:00.000Z"),
        }),
      ),
    );
  });

  afterAll(async () => {
    await cursorModule?.close();
    await testDatabase.stop();
  });

  it("root 최신순과 parent-before-child DFS, id tie-break를 한 쿼리에서 지킨다", async () => {
    const querySpy = vi.spyOn(prisma.runtime(), "query");

    const window = await reader.listConversation({
      todoId,
      sort: "LATEST",
      size: 3,
      mode: "INITIAL",
      scope: "TODO",
    });

    expect(window?.items.map((item) => item.id)).toEqual([ROOT_B, ROOT_A, CHILD_A]);
    expect(window?.items.map((item) => item.continuingAncestorDepths)).toEqual([[], [], [0]]);
    expect(window?.nextRecord?.id).toBe(GRANDCHILD);
    expect(window?.nextRecord?.continuingAncestorDepths).toEqual([0]);
    expect(window?.hasPrevious).toBe(false);
    expect(window?.hasNext).toBe(true);
    expect(querySpy).toHaveBeenCalledTimes(1);
    querySpy.mockRestore();
  });

  it("overview는 두 쿼리로 owner 답글 preview와 descendant 요약을 root별 계산한다", async () => {
    const participantA = decodeRecord(
      "User",
      await createUserDatabaseFixture(
        prisma,
        encodeCreate("User", {
          id: "conversation-participant-a",
          email: "conversation-participant-a@example.com",
          userTag: "CONVPARA",
        }),
        { profile: encodePatch("UserProfile", { id: createEntityId(), name: "참여자 A" }) },
      ),
    );
    const participantB = decodeRecord(
      "User",
      await createUserDatabaseFixture(
        prisma,
        encodeCreate("User", {
          id: "conversation-participant-b",
          email: "conversation-participant-b@example.com",
          userTag: "CONVPARB",
        }),
        { profile: encodePatch("UserProfile", { id: createEntityId(), name: "참여자 B" }) },
      ),
    );
    await prisma.orm.public.TodoComment.createAndCount(
      [
        {
          id: OWNER_REPLY,
          todoId,
          authorId: "conversation-owner",
          parentId: ROOT_A,
          rootId: ROOT_A,
          path: [ROOT_A],
          depth: 1,
          clientRequestId: "00000000-0000-4000-8000-000000000009",
          content: "할 일 주인의 답글",
          createdAt: new Date("2026-08-26T02:40:00.000Z"),
        },
        {
          id: PARTICIPANT_A_REPLY,
          todoId,
          authorId: participantA.id,
          parentId: ROOT_A,
          rootId: ROOT_A,
          path: [ROOT_A],
          depth: 1,
          clientRequestId: "00000000-0000-4000-8000-000000000010",
          content: "참여자 A의 답글",
          createdAt: new Date("2026-08-26T02:50:00.000Z"),
        },
        {
          id: PARTICIPANT_B_REPLY,
          todoId,
          authorId: participantB.id,
          parentId: ROOT_A,
          rootId: ROOT_A,
          path: [ROOT_A],
          depth: 1,
          clientRequestId: "00000000-0000-4000-8000-000000000011",
          content: "참여자 B의 답글",
          createdAt: new Date("2026-08-26T02:55:00.000Z"),
        },
      ].map((value) => encodeCreate("TodoComment", value)),
    );
    decodeRecord(
      "TodoComment",
      requireRecord(
        await prisma.orm.public.TodoComment.where((row) => row.id.eq(ROOT_A)).update(
          encodePatch("TodoComment", { replyCount: 5 }),
        ),
      ),
    );
    decodeRecord(
      "TodoComment",
      requireRecord(
        await prisma.orm.public.TodoComment.where((row) => row.id.eq(CHILD_A)).update(
          encodePatch("TodoComment", {
            authorId: DELETED_COMMENT_AUTHOR_ID,
            content: null,
            deletedAt: new Date("2026-08-26T03:30:00.000Z"),
          }),
        ),
      ),
    );
    const querySpy = vi.spyOn(prisma.runtime(), "query");

    const window = await reader.listOverview({
      todoId,
      sort: "POPULAR",
      size: 1,
      mode: "INITIAL",
    });

    expect(window?.items).toHaveLength(1);
    expect(window?.items[0]).toMatchObject({
      comment: { id: ROOT_A },
      previewReply: { id: OWNER_REPLY, authorId: "conversation-owner" },
      totalCount: 6,
      participantAuthors: [
        { id: "conversation-owner", isTodoOwner: true },
        { id: "conversation-author", isTodoOwner: false },
        { id: participantA.id, isTodoOwner: false },
      ],
    });
    expect(window?.hasNext).toBe(true);
    expect(querySpy).toHaveBeenCalledTimes(2);
    querySpy.mockRestore();
  });

  it("overview direct reply preview는 owner가 없으면 createdAt과 id가 가장 앞선 답글이다", async () => {
    const replyCreatedAt = new Date("2026-08-26T04:00:00.000Z");
    await prisma.orm.public.TodoComment.createAndCount(
      [
        {
          id: "conversation-preview-z",
          todoId,
          authorId: "conversation-author",
          parentId: ROOT_B,
          rootId: ROOT_B,
          path: [ROOT_B],
          depth: 1,
          clientRequestId: "00000000-0000-4000-8000-000000000012",
          content: "id가 뒤인 답글",
          createdAt: replyCreatedAt,
        },
        {
          id: "conversation-preview-a",
          todoId,
          authorId: "conversation-author",
          parentId: ROOT_B,
          rootId: ROOT_B,
          path: [ROOT_B],
          depth: 1,
          clientRequestId: "00000000-0000-4000-8000-000000000013",
          content: "id가 앞인 답글",
          createdAt: replyCreatedAt,
        },
      ].map((value) => encodeCreate("TodoComment", value)),
    );
    decodeRecord(
      "TodoComment",
      requireRecord(
        await prisma.orm.public.TodoComment.where((row) => row.id.eq(ROOT_B)).update(
          encodePatch("TodoComment", { replyCount: 2 }),
        ),
      ),
    );

    const window = await reader.listOverview({
      todoId,
      sort: "LATEST",
      size: 1,
      mode: "INITIAL",
    });

    expect(window?.items[0]).toMatchObject({
      comment: { id: ROOT_B },
      previewReply: { id: "conversation-preview-a" },
      totalCount: 2,
    });
  });

  it.each([0, 5])(
    "overview POPULAR cursor는 boundary score가 %i로 바뀌어도 frozen rank로 다음 root를 읽는다",
    async (nextLikeCount) => {
      decodeRecord(
        "TodoComment",
        requireRecord(
          await prisma.orm.public.TodoComment.where((row) => row.id.eq(ROOT_A)).update(
            encodePatch("TodoComment", { likeCount: 3 }),
          ),
        ),
      );
      decodeRecord(
        "TodoComment",
        requireRecord(
          await prisma.orm.public.TodoComment.where((row) => row.id.eq(ROOT_B)).update(
            encodePatch("TodoComment", { likeCount: 2 }),
          ),
        ),
      );
      const useCase = new GetTodoCommentOverview({
        reader: reader,
        cursorCodec: cursorCodec,
      });
      const firstPage = await useCase.execute({
        todoId,
        viewerId: "conversation-owner",
        sort: "POPULAR",
        size: 1,
      });
      const cursor = firstPage.pagination.nextCursor;
      if (cursor === null) {
        throw new Error("Overview first page must have a next cursor");
      }
      expect(firstPage.items.map((item) => item.comment.id)).toEqual([ROOT_A]);

      decodeRecord(
        "TodoComment",
        requireRecord(
          await prisma.orm.public.TodoComment.where((row) => row.id.eq(ROOT_A)).update(
            encodePatch("TodoComment", { likeCount: nextLikeCount }),
          ),
        ),
      );
      const secondPage = await useCase.execute({
        todoId,
        viewerId: "conversation-owner",
        sort: "POPULAR",
        after: cursor,
        size: 1,
      });

      expect(secondPage.items.map((item) => item.comment.id)).toEqual([ROOT_B]);
    },
  );

  it("overview cursor의 root가 soft-delete되어도 불변 root 위치로 계속 읽는다", async () => {
    const useCase = new GetTodoCommentOverview({ reader: reader, cursorCodec: cursorCodec });
    const firstPage = await useCase.execute({
      todoId,
      viewerId: "conversation-owner",
      sort: "LATEST",
      size: 1,
    });
    const cursor = firstPage.pagination.nextCursor;
    if (cursor === null) {
      throw new Error("Overview first page must have a next cursor");
    }
    expect(firstPage.items.map((item) => item.comment.id)).toEqual([ROOT_B]);

    decodeRecord(
      "TodoComment",
      requireRecord(
        await prisma.orm.public.TodoComment.where((row) => row.id.eq(ROOT_B)).update(
          encodePatch("TodoComment", {
            authorId: DELETED_COMMENT_AUTHOR_ID,
            content: null,
            deletedAt: new Date("2026-08-26T04:00:00.000Z"),
          }),
        ),
      ),
    );
    const secondPage = await useCase.execute({
      todoId,
      viewerId: "conversation-owner",
      sort: "LATEST",
      after: cursor,
      size: 1,
    });

    expect(secondPage.items.map((item) => item.comment.id)).toEqual([ROOT_A]);
  });

  it("after 경계에서도 같은 root block의 연속성을 보존한다", async () => {
    const window = await reader.listConversation({
      todoId,
      sort: "LATEST",
      size: 2,
      mode: "AFTER",
      scope: "TODO",
      anchorCommentId: CHILD_A,
      anchorThreadId: ROOT_A,
      anchorPosition: { rootLikeCount: 0, rootReplyCount: 2 },
    });

    expect(window?.items.map((item) => item.id)).toEqual([GRANDCHILD, CHILD_Z]);
    expect(window?.items.map((item) => item.continuingAncestorDepths)).toEqual([[0], []]);
    expect(window?.previousRecord?.id).toBe(CHILD_A);
    expect(window?.hasPrevious).toBe(true);
    expect(window?.hasNext).toBe(false);
  });

  it("before keyset은 anchor 직전 행부터 역방향으로 읽고 정방향으로 돌려준다", async () => {
    const window = await reader.listConversation({
      todoId,
      sort: "LATEST",
      size: 2,
      mode: "BEFORE",
      scope: "TODO",
      anchorCommentId: GRANDCHILD,
      anchorThreadId: ROOT_A,
      anchorPosition: { rootLikeCount: 0, rootReplyCount: 2 },
    });

    expect(window?.items.map((item) => item.id)).toEqual([ROOT_A, CHILD_A]);
    expect(window?.items.map((item) => item.continuingAncestorDepths)).toEqual([[], [0]]);
    expect(window?.previousRecord?.id).toBe(ROOT_B);
    expect(window?.nextRecord?.id).toBe(GRANDCHILD);
    expect(window?.nextRecord?.continuingAncestorDepths).toEqual([0]);
    expect(window?.hasPrevious).toBe(true);
    expect(window?.hasNext).toBe(true);
  });

  it("POPULAR은 root block만 재정렬하고 block 내부 DFS는 그대로 둔다", async () => {
    decodeRecord(
      "TodoComment",
      requireRecord(
        await prisma.orm.public.TodoComment.where((row) => row.id.eq(ROOT_A)).update(
          encodePatch("TodoComment", { likeCount: 5 }),
        ),
      ),
    );

    const window = await reader.listConversation({
      todoId,
      sort: "POPULAR",
      size: 5,
      mode: "INITIAL",
      scope: "TODO",
    });

    expect(window?.items.map((item) => item.id)).toEqual([
      ROOT_A,
      CHILD_A,
      GRANDCHILD,
      CHILD_Z,
      ROOT_B,
    ]);
  });

  it("POPULAR root 점수가 내려가도 같은 thread의 여러 page가 최초 rank를 이어받는다", async () => {
    decodeRecord(
      "TodoComment",
      requireRecord(
        await prisma.orm.public.TodoComment.where((row) => row.id.eq(ROOT_A)).update(
          encodePatch("TodoComment", { likeCount: 3 }),
        ),
      ),
    );
    decodeRecord(
      "TodoComment",
      requireRecord(
        await prisma.orm.public.TodoComment.where((row) => row.id.eq(ROOT_B)).update(
          encodePatch("TodoComment", { likeCount: 2 }),
        ),
      ),
    );
    const firstPage = await reader.listConversation({
      todoId,
      sort: "POPULAR",
      size: 2,
      mode: "INITIAL",
      scope: "TODO",
    });
    const firstAnchor = firstPage?.items.at(-1);

    expect(firstPage?.items.map((item) => item.id)).toEqual([ROOT_A, CHILD_A]);
    if (firstAnchor === undefined) {
      throw new Error("POPULAR first page must have an anchor");
    }

    decodeRecord(
      "TodoComment",
      requireRecord(
        await prisma.orm.public.TodoComment.where((row) => row.id.eq(ROOT_A)).update(
          encodePatch("TodoComment", { likeCount: 0 }),
        ),
      ),
    );
    const secondPage = await reader.listConversation({
      todoId,
      sort: "POPULAR",
      size: 2,
      mode: "AFTER",
      scope: "TODO",
      anchorCommentId: firstAnchor.id,
      anchorThreadId: firstAnchor.rootId ?? firstAnchor.id,
      anchorPosition: firstAnchor.conversationPosition,
    });
    const secondAnchor = secondPage?.items.at(-1);

    expect(secondPage?.items.map((item) => item.id)).toEqual([GRANDCHILD, CHILD_Z]);
    expect(secondAnchor?.conversationPosition).toEqual({
      rootLikeCount: 3,
      rootReplyCount: 2,
    });
    if (secondAnchor === undefined) {
      throw new Error("POPULAR second page must have an anchor");
    }

    const thirdPage = await reader.listConversation({
      todoId,
      sort: "POPULAR",
      size: 2,
      mode: "AFTER",
      scope: "TODO",
      anchorCommentId: secondAnchor.id,
      anchorThreadId: secondAnchor.rootId ?? secondAnchor.id,
      anchorPosition: secondAnchor.conversationPosition,
    });

    expect(thirdPage?.items.map((item) => item.id)).toEqual([ROOT_B]);
  });

  it.each([0, 4])(
    "POPULAR boundary root 점수가 %i로 바뀌어도 아직 보지 않은 root만 반환한다",
    async (nextLikeCount) => {
      decodeRecord(
        "TodoComment",
        requireRecord(
          await prisma.orm.public.TodoComment.where((row) => row.id.eq(ROOT_A)).update(
            encodePatch("TodoComment", { likeCount: 3 }),
          ),
        ),
      );
      decodeRecord(
        "TodoComment",
        requireRecord(
          await prisma.orm.public.TodoComment.where((row) => row.id.eq(ROOT_B)).update(
            encodePatch("TodoComment", { likeCount: 2 }),
          ),
        ),
      );
      decodeRecord(
        "TodoComment",
        await prisma.orm.public.TodoComment.create(
          encodeCreate("TodoComment", {
            id: ROOT_C,
            todoId,
            authorId: "conversation-author",
            clientRequestId: "00000000-0000-4000-8000-000000000006",
            content: "인기 경계 뒤의 루트",
            likeCount: 1,
            createdAt: new Date("2026-08-26T00:30:00.000Z"),
          }),
        ),
      );
      const firstPage = await reader.listConversation({
        todoId,
        sort: "POPULAR",
        size: 5,
        mode: "INITIAL",
        scope: "TODO",
      });
      const anchor = firstPage?.items.at(-1);

      expect(firstPage?.items.map((item) => item.id)).toEqual([
        ROOT_A,
        CHILD_A,
        GRANDCHILD,
        CHILD_Z,
        ROOT_B,
      ]);
      if (anchor === undefined) {
        throw new Error("POPULAR boundary page must have an anchor");
      }

      decodeRecord(
        "TodoComment",
        requireRecord(
          await prisma.orm.public.TodoComment.where((row) => row.id.eq(ROOT_B)).update(
            encodePatch("TodoComment", { likeCount: nextLikeCount }),
          ),
        ),
      );
      const nextPage = await reader.listConversation({
        todoId,
        sort: "POPULAR",
        size: 2,
        mode: "AFTER",
        scope: "TODO",
        anchorCommentId: anchor.id,
        anchorThreadId: anchor.rootId ?? anchor.id,
        anchorPosition: anchor.conversationPosition,
      });

      expect(nextPage?.items.map((item) => item.id)).toEqual([ROOT_C]);
    },
  );

  it("page cursor의 leaf가 soft-delete되어도 DB에 남은 불변 위치에서 계속 읽는다", async () => {
    decodeRecord(
      "TodoComment",
      await prisma.orm.public.TodoComment.create(
        encodeCreate("TodoComment", {
          id: NEW_ROOT,
          todoId,
          authorId: "conversation-author",
          clientRequestId: "00000000-0000-4000-8000-000000000007",
          content: "가장 최신 루트",
          replyCount: 1,
          createdAt: new Date("2026-08-26T04:00:00.000Z"),
        }),
      ),
    );
    decodeRecord(
      "TodoComment",
      await prisma.orm.public.TodoComment.create(
        encodeCreate("TodoComment", {
          id: DELETED_LEAF,
          todoId,
          authorId: "conversation-author",
          parentId: NEW_ROOT,
          rootId: NEW_ROOT,
          path: [NEW_ROOT],
          depth: 1,
          clientRequestId: "00000000-0000-4000-8000-000000000008",
          content: "경계가 될 leaf",
          createdAt: new Date("2026-08-26T05:00:00.000Z"),
        }),
      ),
    );
    const firstPage = await reader.listConversation({
      todoId,
      sort: "LATEST",
      size: 2,
      mode: "INITIAL",
      scope: "TODO",
    });
    const anchor = firstPage?.items.at(-1);

    expect(firstPage?.items.map((item) => item.id)).toEqual([NEW_ROOT, DELETED_LEAF]);
    if (anchor === undefined) {
      throw new Error("LATEST page must have a leaf anchor");
    }

    decodeRecord(
      "TodoComment",
      requireRecord(
        await prisma.orm.public.TodoComment.where((row) => row.id.eq(DELETED_LEAF)).update(
          encodePatch("TodoComment", {
            authorId: DELETED_COMMENT_AUTHOR_ID,
            content: null,
            deletedAt: new Date("2026-08-26T06:00:00.000Z"),
          }),
        ),
      ),
    );
    const nextPage = await reader.listConversation({
      todoId,
      sort: "LATEST",
      size: 2,
      mode: "AFTER",
      scope: "TODO",
      anchorCommentId: anchor.id,
      anchorThreadId: anchor.rootId ?? anchor.id,
      anchorPosition: anchor.conversationPosition,
    });

    expect(nextPage?.items.at(0)?.id).toBe(ROOT_B);
    expect(nextPage?.previousRecord).toMatchObject({
      id: DELETED_LEAF,
      deletedAt: expect.any(String),
    });

    const previousPage = await reader.listConversation({
      todoId,
      sort: "LATEST",
      size: 2,
      mode: "BEFORE",
      scope: "TODO",
      anchorCommentId: anchor.id,
      anchorThreadId: anchor.rootId ?? anchor.id,
      anchorPosition: anchor.conversationPosition,
    });

    expect(previousPage?.items.map((item) => item.id)).toEqual([NEW_ROOT]);
    expect(previousPage?.nextRecord).toMatchObject({
      id: DELETED_LEAF,
      deletedAt: expect.any(String),
    });
  });

  it("focus window를 끝 경계에서 당겨 채우고 정확한 item index를 준다", async () => {
    const window = await reader.listConversation({
      todoId,
      sort: "LATEST",
      size: 3,
      mode: "FOCUS",
      scope: "THREAD",
      anchorCommentId: CHILD_Z,
    });

    expect(window?.items.map((item) => item.id)).toEqual([CHILD_A, GRANDCHILD, CHILD_Z]);
    expect(window?.anchorIndex).toBe(2);
    expect(window?.items.some((item) => item.id === ROOT_B)).toBe(false);
  });

  it("focus 재귀 CTE는 큰 다른 thread를 순회하지 않고 선택한 root만 확장한다", async () => {
    await prisma.orm.public.TodoComment.createAndCount(
      Array.from({ length: 500 }, (_, index) => ({
        id: `conversation-distractor-${index}`,
        todoId,
        authorId: "conversation-author",
        clientRequestId: randomUUID(),
        content: `관계없는 원문 ${index}`,
        createdAt: new Date("2026-08-26T05:00:00.000Z"),
      })).map((value) => encodeCreate("TodoComment", value)),
    );

    const rows = await prisma.runtime().query(
      sqlStatement(
        prisma,
        sql`
			EXPLAIN (ANALYZE, FORMAT JSON)
			WITH RECURSIVE ${buildTodoConversationTreeCtes({
        todoId,
        mode: "FOCUS",
        scope: "THREAD",
        anchorCommentId: CHILD_A,
      })}
			SELECT * FROM tree
		`,
      )
        .returnsRow(sqlRowSpec({ "QUERY PLAN": "pg/json@1" }))
        .build(),
    );
    const planDocument = z
      .array(z.object({ Plan: z.unknown() }).loose())
      .parse(rows.at(0)?.["QUERY PLAN"]);

    expect(findPlanActualRows(planDocument.at(0)?.Plan, "Recursive Union")).toBe(4);
  });

  it("root focus는 선택한 root와 후손만 반환한다", async () => {
    const window = await reader.listConversation({
      todoId,
      sort: "LATEST",
      size: 10,
      mode: "FOCUS",
      scope: "THREAD",
      anchorCommentId: ROOT_A,
    });

    expect(window?.items.map((item) => item.id)).toEqual([ROOT_A, CHILD_A, GRANDCHILD, CHILD_Z]);
    expect(window?.hasPrevious).toBe(false);
    expect(window?.hasNext).toBe(false);
  });

  it("cursor threadId가 실제 root와 다르면 anchor를 찾지 않는다", async () => {
    await expect(
      reader.listConversation({
        todoId,
        sort: "LATEST",
        size: 2,
        mode: "AFTER",
        scope: "TODO",
        anchorCommentId: CHILD_A,
        anchorThreadId: ROOT_B,
        anchorPosition: { rootLikeCount: 0, rootReplyCount: 2 },
      }),
    ).resolves.toBeNull();
  });

  it("후손 때문에 보존된 삭제 댓글 focus는 같은 thread만 안전하게 보여 준다", async () => {
    decodeRecord(
      "TodoComment",
      requireRecord(
        await prisma.orm.public.TodoComment.where((row) => row.id.eq(CHILD_A)).update(
          encodePatch("TodoComment", {
            authorId: DELETED_COMMENT_AUTHOR_ID,
            content: null,
            deletedAt: new Date("2026-08-26T04:00:00.000Z"),
          }),
        ),
      ),
    );
    const useCase = new GetTodoConversation({ reader: reader, cursorCodec: cursorCodec });

    const response = await useCase.execute({
      todoId,
      viewerId: "conversation-owner",
      sort: "LATEST",
      focusCommentId: CHILD_A,
      size: 3,
    });

    expect(response.focus).toBeNull();
    expect(response.items.map((item) => item.comment.id)).toEqual([ROOT_A, CHILD_A, GRANDCHILD]);
    expect(response.items.at(-1)).toMatchObject({
      comment: { id: GRANDCHILD },
    });
    expect(response.items[1]).toMatchObject({
      comment: { id: CHILD_A, isDeleted: true, author: null, content: null },
      isFocused: false,
    });
  });

  it("삭제된 leaf focus는 다른 root로 fallback하지 않고 빈 대화를 반환한다", async () => {
    decodeRecord(
      "TodoComment",
      requireRecord(
        await prisma.orm.public.TodoComment.where((row) => row.id.eq(CHILD_Z)).update(
          encodePatch("TodoComment", {
            authorId: DELETED_COMMENT_AUTHOR_ID,
            content: null,
            deletedAt: new Date("2026-08-26T04:00:00.000Z"),
          }),
        ),
      ),
    );
    const useCase = new GetTodoConversation({ reader: reader, cursorCodec: cursorCodec });

    const response = await useCase.execute({
      todoId,
      viewerId: "conversation-owner",
      sort: "LATEST",
      focusCommentId: CHILD_Z,
      size: 3,
    });

    expect(response).toMatchObject({
      items: [],
      focus: null,
      pagination: { hasPrevious: false, hasNext: false },
    });
  });

  it("지문이 없는 구버전 행도 구조와 내용이 같으면 안전하게 replay한다", async () => {
    await expect(
      repository.findCommentChainReplay({
        todoId,
        authorId: "conversation-author",
        parentId: null,
        items: [
          {
            clientRequestId: "00000000-0000-4000-8000-000000000001",
            content: "오래된 루트",
          },
          {
            clientRequestId: "00000000-0000-4000-8000-000000000004",
            content: "같은 시각 id가 앞인 형제",
          },
        ],
      }),
    ).resolves.toEqual([ROOT_A, CHILD_A]);
  });

  it("지문이 없는 멱등 키의 내용이 다르면 replay하지 않는다", async () => {
    await expect(
      repository.findCommentChainReplay({
        todoId,
        authorId: "conversation-author",
        parentId: null,
        items: [
          {
            clientRequestId: "00000000-0000-4000-8000-000000000001",
            content: "다른 명령",
          },
        ],
      }),
    ).rejects.toBeInstanceOf(TodoCommentIdempotencyConflict);
  });

  it("구버전 pod가 먼저 쓴 멱등 키의 SQLSTATE 23505를 application race로 번역한다", async () => {
    await expect(
      repository.createCommentChain({
        todoId,
        authorId: "conversation-author",
        placement: ThreadPlacement.topLevel(),
        items: [
          {
            clientRequestId: "00000000-0000-4000-8000-000000000001",
            content: "오래된 루트",
          },
        ],
      }),
    ).rejects.toBeInstanceOf(TodoCommentIdempotencyRace);
  });
});
