import { randomUUID } from "node:crypto";

import { todoConversationConnectionSchema } from "@aido/api";
import { Test, type TestingModule } from "@nestjs/testing";
import { eq } from "drizzle-orm";

import { TodoCommentIdempotencyRace } from "#api/modules/engagement/comments/application/comments.errors";
import type { TodoCommentCursorCodecPort } from "#api/modules/engagement/comments/application/ports/todo-comment-cursor-codec.port";
import { GetTodoConversationUseCase } from "#api/modules/engagement/comments/application/use-cases/get-todo-conversation.use-case";
import { ListTodoCommentThreadsUseCase } from "#api/modules/engagement/comments/application/use-cases/list-todo-comment-threads.use-case";
import { CommentPlacement } from "#api/modules/engagement/comments/domain/comment-placement.vo";
import { DELETED_COMMENT_AUTHOR } from "#api/modules/engagement/comments/domain/comments.constants";
import { matchTodoCommentChainReplay } from "#api/modules/engagement/comments/domain/todo-comment-chain.domain-service";
import { TodoCommentContent } from "#api/modules/engagement/comments/domain/todo-comment-content.vo";
import { TodoComment } from "#api/modules/engagement/comments/domain/todo-comment.aggregate";
import { engagementCommentsConfig } from "#api/modules/engagement/comments/engagement-comments.config";
import { HmacTodoCommentCursorCodecAdapter } from "#api/modules/engagement/comments/infrastructure/adapters/hmac-todo-comment-cursor-codec.adapter";
import { DrizzleTodoCommentReader } from "#api/modules/engagement/comments/infrastructure/persistence/drizzle-todo-comment.reader";
import { DrizzleTodoCommentRepository } from "#api/modules/engagement/comments/infrastructure/persistence/drizzle-todo-comment.repository";
import { toTodoConversationResponse } from "#api/modules/engagement/comments/presentation/http/v1/todo-comment-response.mapper";
import { DrizzleTodoDetailsReader } from "#api/modules/planning/todos/infrastructure/persistence/drizzle-todo-details.reader";
import { DrizzleUserBlockRepository } from "#api/modules/social/blocks/infrastructure/persistence/drizzle-user-block.repository";
import {
  todo,
  todoCategory,
  todoComment,
  user,
  userProfile,
} from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import type { TestDatabaseClient } from "#test/setup/test-database";

import { TestDatabase } from "../../../setup/test-database.js";

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

type CommentRow = Omit<typeof todoComment.$inferInsert, "updatedAt">;
const TODO_START_DATE = new Date("2026-08-26T00:00:00.000Z");
const COMMENT_UPDATED_AT = Temporal.Instant.from("2026-08-26T00:00:00.000Z");

describe("Todo comment conversation reader (실제 PostgreSQL)", () => {
  let testDatabase: TestDatabase;
  let client: TestDatabaseClient;
  let reader: DrizzleTodoCommentReader;
  let blockRepository: DrizzleUserBlockRepository;
  let repository: DrizzleTodoCommentRepository;
  let cursorCodec: TodoCommentCursorCodecPort;
  let cursorModule: TestingModule;
  let todoId: number;
  let recording: string[] | null = null;

  beforeAll(async () => {
    testDatabase = new TestDatabase({
      createClient: (url) =>
        createTestClient(url, {}, (statement) => {
          recording?.push(statement);
        }),
    });
    client = await testDatabase.start();
    const { txHost } = createDatabaseTransactionFixture(client);
    reader = new DrizzleTodoCommentReader(txHost, new DrizzleTodoDetailsReader(txHost));
    blockRepository = new DrizzleUserBlockRepository(txHost);
    repository = new DrizzleTodoCommentRepository(txHost);
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
    cursorCodec = cursorModule.get(HmacTodoCommentCursorCodecAdapter);
  }, 60_000);

  async function insertComments(rows: CommentRow | readonly CommentRow[]) {
    const list: readonly CommentRow[] = "todoId" in rows ? [rows] : rows;
    await client
      .insert(todoComment)
      .values(list.map((row) => ({ updatedAt: row.createdAt ?? COMMENT_UPDATED_AT, ...row })));
  }

  async function updateComment(id: string, values: Partial<typeof todoComment.$inferInsert>) {
    await client.update(todoComment).set(values).where(eq(todoComment.id, id));
  }

  async function softDeleteComment(id: string, deletedAt: Temporal.Instant) {
    await updateComment(id, { authorId: DELETED_COMMENT_AUTHOR.id, content: null, deletedAt });
  }

  async function recordStatements<T>(work: () => Promise<T>) {
    const statements: string[] = [];
    recording = statements;
    try {
      const result = await work();
      return { result, count: statements.length };
    } finally {
      recording = null;
    }
  }

  beforeEach(async () => {
    await testDatabase.cleanup();
    await client.insert(user).values([
      {
        id: DELETED_COMMENT_AUTHOR.id,
        email: DELETED_COMMENT_AUTHOR.email,
        userTag: DELETED_COMMENT_AUTHOR.userTag,
        updatedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
        status: "LOCKED",
      },
      {
        id: "conversation-owner",
        email: "conversation-owner@example.com",
        userTag: "CONVOWNR",
        updatedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
      },
      {
        id: "conversation-author",
        email: "conversation-author@example.com",
        userTag: "CONVAUTH",
        updatedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
      },
    ]);
    const [category] = await client
      .insert(todoCategory)
      .values({ userId: "conversation-owner", name: "Conversation", color: "#123456" })
      .returning();
    if (category === undefined) {
      throw new Error("category fixture was not created");
    }
    const [createdTodo] = await client
      .insert(todo)
      .values({
        userId: "conversation-owner",
        categoryId: category.id,
        title: "한 화면의 댓글 대화",
        startDate: TODO_START_DATE,
        commentCount: 5,
      })
      .returning();
    if (createdTodo === undefined) {
      throw new Error("todo fixture was not created");
    }
    todoId = createdTodo.id;

    const siblingCreatedAt = Temporal.Instant.from("2026-08-26T02:00:00.000Z");
    await insertComments([
      {
        id: ROOT_A,
        todoId,
        authorId: "conversation-author",
        clientRequestId: "00000000-0000-4000-8000-000000000001",
        content: "오래된 루트",
        replyCount: 3,
        createdAt: Temporal.Instant.from("2026-08-26T01:00:00.000Z"),
      },
      {
        id: ROOT_B,
        todoId,
        authorId: "conversation-author",
        clientRequestId: "00000000-0000-4000-8000-000000000002",
        content: "최신 루트",
        createdAt: Temporal.Instant.from("2026-08-26T03:00:00.000Z"),
      },
      {
        id: CHILD_Z,
        todoId,
        authorId: "conversation-author",
        parentId: ROOT_A,
        replyToCommentId: ROOT_A,
        clientRequestId: "00000000-0000-4000-8000-000000000003",
        content: "같은 시각 id가 뒤인 형제",
        createdAt: siblingCreatedAt,
      },
      {
        id: CHILD_A,
        todoId,
        authorId: "conversation-author",
        parentId: ROOT_A,
        replyToCommentId: ROOT_A,
        clientRequestId: "00000000-0000-4000-8000-000000000004",
        content: "같은 시각 id가 앞인 형제",
        createdAt: siblingCreatedAt,
      },
      {
        id: GRANDCHILD,
        todoId,
        authorId: "conversation-author",
        parentId: ROOT_A,
        replyToCommentId: CHILD_A,
        clientRequestId: "00000000-0000-4000-8000-000000000005",
        content: "답글에 단 답글",
        createdAt: Temporal.Instant.from("2026-08-26T02:30:00.000Z"),
      },
    ]);
  });

  afterAll(async () => {
    await cursorModule?.close();
    await testDatabase.stop();
  });

  it("묶음은 최신순, 묶음 안은 머리 다음 답글을 작성 순으로 정렬하고 같은 시각이면 id 순서를 지키며 쿼리 1번에 읽는다", async () => {
    // Given
    const input = {
      todoId,
      sort: "LATEST",
      size: 3,
      mode: "INITIAL",
      scope: "TODO",
    } as const;

    // When
    const { result: window, count } = await recordStatements(() => reader.listConversation(input));

    // Then
    expect(window?.items.map((item) => item.id)).toEqual([ROOT_B, ROOT_A, CHILD_A]);
    expect(window?.items.map((item) => item.threadCommentId)).toEqual([null, null, ROOT_A]);
    expect(window?.nextItem?.id).toBe(CHILD_Z);
    expect(window?.hasPrevious).toBe(false);
    expect(window?.hasNext).toBe(true);
    expect(count).toBe(1);
  });

  it("개요는 쿼리 2번으로 주인의 답글 미리보기와 참여자를 묶음별로 고르고 답글 수는 머리 값을 쓴다", async () => {
    // Given
    await client.insert(user).values([
      {
        id: "conversation-participant-a",
        email: "conversation-participant-a@example.com",
        userTag: "CONVPARA",
        updatedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
      },
      {
        id: "conversation-participant-b",
        email: "conversation-participant-b@example.com",
        userTag: "CONVPARB",
        updatedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
      },
    ]);
    await client.insert(userProfile).values([
      { userId: "conversation-participant-a", name: "참여자 A" },
      { userId: "conversation-participant-b", name: "참여자 B" },
    ]);
    await insertComments([
      {
        id: OWNER_REPLY,
        todoId,
        authorId: "conversation-owner",
        parentId: ROOT_A,
        replyToCommentId: ROOT_A,
        clientRequestId: "00000000-0000-4000-8000-000000000009",
        content: "할 일 주인의 답글",
        createdAt: Temporal.Instant.from("2026-08-26T02:40:00.000Z"),
      },
      {
        id: PARTICIPANT_A_REPLY,
        todoId,
        authorId: "conversation-participant-a",
        parentId: ROOT_A,
        replyToCommentId: ROOT_A,
        clientRequestId: "00000000-0000-4000-8000-000000000010",
        content: "참여자 A의 답글",
        createdAt: Temporal.Instant.from("2026-08-26T02:50:00.000Z"),
      },
      {
        id: PARTICIPANT_B_REPLY,
        todoId,
        authorId: "conversation-participant-b",
        parentId: ROOT_A,
        replyToCommentId: ROOT_A,
        clientRequestId: "00000000-0000-4000-8000-000000000011",
        content: "참여자 B의 답글",
        createdAt: Temporal.Instant.from("2026-08-26T02:55:00.000Z"),
      },
    ]);
    await updateComment(ROOT_A, { replyCount: 5 });
    await softDeleteComment(CHILD_A, Temporal.Instant.from("2026-08-26T03:30:00.000Z"));

    // When
    const { result: window, count } = await recordStatements(() =>
      reader.listThreads({ todoId, sort: "POPULAR", size: 1, mode: "INITIAL" }),
    );

    // Then
    expect(window?.items).toHaveLength(1);
    expect(window?.items[0]).toMatchObject({
      comment: { id: ROOT_A },
      previewReply: { id: OWNER_REPLY, authorId: "conversation-owner" },
      totalCount: 5,
      participantAuthors: [
        { id: "conversation-owner", isTodoOwner: true },
        { id: "conversation-author", isTodoOwner: false },
        { id: "conversation-participant-a", isTodoOwner: false },
      ],
    });
    expect(window?.hasNext).toBe(true);
    expect(count).toBe(2);
  });

  it("주인의 답글이 없으면 개요의 직접 답글 미리보기는 createdAt과 id가 가장 앞선 답글이다", async () => {
    // Given
    const replyCreatedAt = Temporal.Instant.from("2026-08-26T04:00:00.000Z");
    await insertComments([
      {
        id: "conversation-preview-z",
        todoId,
        authorId: "conversation-author",
        parentId: ROOT_B,
        replyToCommentId: ROOT_B,
        clientRequestId: "00000000-0000-4000-8000-000000000012",
        content: "id가 뒤인 답글",
        createdAt: replyCreatedAt,
      },
      {
        id: "conversation-preview-a",
        todoId,
        authorId: "conversation-author",
        parentId: ROOT_B,
        replyToCommentId: ROOT_B,
        clientRequestId: "00000000-0000-4000-8000-000000000013",
        content: "id가 앞인 답글",
        createdAt: replyCreatedAt,
      },
    ]);
    await updateComment(ROOT_B, { replyCount: 2 });

    // When
    const window = await reader.listThreads({
      todoId,
      sort: "LATEST",
      size: 1,
      mode: "INITIAL",
    });

    // Then
    expect(window?.items[0]).toMatchObject({
      comment: { id: ROOT_B },
      previewReply: { id: "conversation-preview-a" },
      totalCount: 2,
    });
  });

  it.each([0, 5])(
    "개요의 인기순 cursor는 경계 루트의 점수가 %i로 바뀌어도 처음 정한 순위로 다음 루트를 읽는다",
    async (nextLikeCount) => {
      // Given
      await updateComment(ROOT_A, { likeCount: 3 });
      await updateComment(ROOT_B, { likeCount: 2 });
      const useCase = new ListTodoCommentThreadsUseCase({
        reader: reader,
        cursorCodec: cursorCodec,
        blockReader: blockRepository,
      });
      const firstPage = await useCase.execute({
        todoId,
        viewerId: "conversation-owner",
        sort: "POPULAR",
        size: 1,
        page: { kind: "FIRST" },
      });
      const cursor = firstPage.pagination.nextCursor;
      if (cursor === null) {
        throw new Error("Overview first page must have a next cursor");
      }
      await updateComment(ROOT_A, { likeCount: nextLikeCount });

      // When
      const secondPage = await useCase.execute({
        todoId,
        viewerId: "conversation-owner",
        sort: "POPULAR",
        size: 1,
        page: { kind: "CURSOR", cursor },
      });

      // Then
      expect(firstPage.items.map((item) => item.comment.id)).toEqual([ROOT_A]);
      expect(secondPage.items.map((item) => item.comment.id)).toEqual([ROOT_B]);
    },
  );

  it("개요 cursor의 루트가 삭제 처리되어도 바뀌지 않는 루트 위치로 계속 읽는다", async () => {
    // Given
    const useCase = new ListTodoCommentThreadsUseCase({
      reader: reader,
      cursorCodec: cursorCodec,
      blockReader: blockRepository,
    });
    const firstPage = await useCase.execute({
      todoId,
      viewerId: "conversation-owner",
      sort: "LATEST",
      size: 1,
      page: { kind: "FIRST" },
    });
    const cursor = firstPage.pagination.nextCursor;
    if (cursor === null) {
      throw new Error("Overview first page must have a next cursor");
    }
    await softDeleteComment(ROOT_B, Temporal.Instant.from("2026-08-26T04:00:00.000Z"));

    // When
    const secondPage = await useCase.execute({
      todoId,
      viewerId: "conversation-owner",
      sort: "LATEST",
      size: 1,
      page: { kind: "CURSOR", cursor, direction: "AFTER" },
    });

    // Then
    expect(firstPage.items.map((item) => item.comment.id)).toEqual([ROOT_B]);
    expect(secondPage.items.map((item) => item.comment.id)).toEqual([ROOT_A]);
  });

  it("after 경계에서도 같은 묶음의 답글 순서를 이어 간다", async () => {
    // Given
    const input = {
      todoId,
      sort: "LATEST",
      size: 2,
      mode: "AFTER",
      scope: "TODO",
      anchorCommentId: CHILD_A,
      anchorThreadId: ROOT_A,
      anchorPosition: { rootLikeCount: 0, rootReplyCount: 3 },
    } as const;

    // When
    const window = await reader.listConversation(input);

    // Then
    expect(window?.items.map((item) => item.id)).toEqual([CHILD_Z, GRANDCHILD]);
    expect(window?.previousItem?.id).toBe(CHILD_A);
    expect(window?.hasPrevious).toBe(true);
    expect(window?.hasNext).toBe(false);
  });

  it("before 조회는 기준 댓글 직전부터 역방향으로 읽고 정방향으로 돌려준다", async () => {
    // Given
    const input = {
      todoId,
      sort: "LATEST",
      size: 2,
      mode: "BEFORE",
      scope: "TODO",
      anchorCommentId: GRANDCHILD,
      anchorThreadId: ROOT_A,
      anchorPosition: { rootLikeCount: 0, rootReplyCount: 3 },
    } as const;

    // When
    const window = await reader.listConversation(input);

    // Then
    expect(window?.items.map((item) => item.id)).toEqual([CHILD_A, CHILD_Z]);
    expect(window?.previousItem?.id).toBe(ROOT_A);
    expect(window?.nextItem?.id).toBe(GRANDCHILD);
    expect(window?.hasPrevious).toBe(true);
    expect(window?.hasNext).toBe(true);
  });

  it("인기순은 루트 묶음만 재정렬하고 묶음 안의 순서는 그대로 둔다", async () => {
    // Given
    await updateComment(ROOT_A, { likeCount: 5 });

    // When
    const window = await reader.listConversation({
      todoId,
      sort: "POPULAR",
      size: 5,
      mode: "INITIAL",
      scope: "TODO",
    });

    // Then
    expect(window?.items.map((item) => item.id)).toEqual([
      ROOT_A,
      CHILD_A,
      CHILD_Z,
      GRANDCHILD,
      ROOT_B,
    ]);
  });

  it("인기순 루트 점수가 내려가도 같은 대화의 여러 페이지가 처음 정한 순위를 이어받는다", async () => {
    // Given
    await updateComment(ROOT_A, { likeCount: 3 });
    await updateComment(ROOT_B, { likeCount: 2 });
    const firstPage = await reader.listConversation({
      todoId,
      sort: "POPULAR",
      size: 2,
      mode: "INITIAL",
      scope: "TODO",
    });
    const firstAnchor = firstPage?.items.at(-1);
    if (firstAnchor === undefined) {
      throw new Error("POPULAR first page must have an anchor");
    }
    await updateComment(ROOT_A, { likeCount: 0 });

    // When
    const secondPage = await reader.listConversation({
      todoId,
      sort: "POPULAR",
      size: 2,
      mode: "AFTER",
      scope: "TODO",
      anchorCommentId: firstAnchor.id,
      anchorThreadId: firstAnchor.threadCommentId ?? firstAnchor.id,
      anchorPosition: firstAnchor.conversationPosition,
    });
    const secondAnchor = secondPage?.items.at(-1);
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
      anchorThreadId: secondAnchor.threadCommentId ?? secondAnchor.id,
      anchorPosition: secondAnchor.conversationPosition,
    });

    // Then
    expect(firstPage?.items.map((item) => item.id)).toEqual([ROOT_A, CHILD_A]);
    expect(secondPage?.items.map((item) => item.id)).toEqual([CHILD_Z, GRANDCHILD]);
    expect(secondAnchor.conversationPosition).toEqual({
      rootLikeCount: 3,
      rootReplyCount: 3,
    });
    expect(thirdPage?.items.map((item) => item.id)).toEqual([ROOT_B]);
  });

  it.each([0, 4])(
    "인기순 경계 루트의 점수가 %i로 바뀌어도 아직 보지 않은 루트만 반환한다",
    async (nextLikeCount) => {
      // Given
      await updateComment(ROOT_A, { likeCount: 3 });
      await updateComment(ROOT_B, { likeCount: 2 });
      await insertComments({
        id: ROOT_C,
        todoId,
        authorId: "conversation-author",
        clientRequestId: "00000000-0000-4000-8000-000000000006",
        content: "인기 경계 뒤의 루트",
        likeCount: 1,
        createdAt: Temporal.Instant.from("2026-08-26T00:30:00.000Z"),
      });
      const firstPage = await reader.listConversation({
        todoId,
        sort: "POPULAR",
        size: 5,
        mode: "INITIAL",
        scope: "TODO",
      });
      const anchor = firstPage?.items.at(-1);
      if (anchor === undefined) {
        throw new Error("POPULAR boundary page must have an anchor");
      }
      await updateComment(ROOT_B, { likeCount: nextLikeCount });

      // When
      const nextPage = await reader.listConversation({
        todoId,
        sort: "POPULAR",
        size: 2,
        mode: "AFTER",
        scope: "TODO",
        anchorCommentId: anchor.id,
        anchorThreadId: anchor.threadCommentId ?? anchor.id,
        anchorPosition: anchor.conversationPosition,
      });

      // Then
      expect(firstPage?.items.map((item) => item.id)).toEqual([
        ROOT_A,
        CHILD_A,
        CHILD_Z,
        GRANDCHILD,
        ROOT_B,
      ]);
      expect(nextPage?.items.map((item) => item.id)).toEqual([ROOT_C]);
    },
  );

  it("페이지 cursor의 마지막 댓글이 삭제 처리되어도 DB에 남은 위치에서 계속 읽는다", async () => {
    // Given
    await insertComments([
      {
        id: NEW_ROOT,
        todoId,
        authorId: "conversation-author",
        clientRequestId: "00000000-0000-4000-8000-000000000007",
        content: "가장 최신 루트",
        replyCount: 1,
        createdAt: Temporal.Instant.from("2026-08-26T04:00:00.000Z"),
      },
      {
        id: DELETED_LEAF,
        todoId,
        authorId: "conversation-author",
        parentId: NEW_ROOT,
        replyToCommentId: NEW_ROOT,
        clientRequestId: "00000000-0000-4000-8000-000000000008",
        content: "경계가 될 leaf",
        createdAt: Temporal.Instant.from("2026-08-26T05:00:00.000Z"),
      },
    ]);
    const firstPage = await reader.listConversation({
      todoId,
      sort: "LATEST",
      size: 2,
      mode: "INITIAL",
      scope: "TODO",
    });
    const anchor = firstPage?.items.at(-1);
    if (anchor === undefined) {
      throw new Error("LATEST page must have a leaf anchor");
    }
    await softDeleteComment(DELETED_LEAF, Temporal.Instant.from("2026-08-26T06:00:00.000Z"));
    const anchorInput = {
      todoId,
      sort: "LATEST",
      size: 2,
      scope: "TODO",
      anchorCommentId: anchor.id,
      anchorThreadId: anchor.threadCommentId ?? anchor.id,
      anchorPosition: anchor.conversationPosition,
    } as const;

    // When
    const nextPage = await reader.listConversation({ ...anchorInput, mode: "AFTER" });
    const previousPage = await reader.listConversation({ ...anchorInput, mode: "BEFORE" });

    // Then
    expect(firstPage?.items.map((item) => item.id)).toEqual([NEW_ROOT, DELETED_LEAF]);
    expect(nextPage?.items.at(0)?.id).toBe(ROOT_B);
    expect(nextPage?.previousItem).toMatchObject({
      id: DELETED_LEAF,
      deletedAt: expect.any(Temporal.Instant),
    });
    expect(previousPage?.items.map((item) => item.id)).toEqual([NEW_ROOT]);
    expect(previousPage?.nextItem).toMatchObject({
      id: DELETED_LEAF,
      deletedAt: expect.any(Temporal.Instant),
    });
  });

  it("focus 창은 끝 경계에서 당겨 채우고 정확한 항목 위치를 준다", async () => {
    // Given
    const input = {
      todoId,
      sort: "LATEST",
      size: 3,
      mode: "FOCUS",
      scope: "THREAD",
      anchorCommentId: GRANDCHILD,
    } as const;

    // When
    const window = await reader.listConversation(input);

    // Then
    expect(window?.items.map((item) => item.id)).toEqual([CHILD_A, CHILD_Z, GRANDCHILD]);
    expect(window?.anchorIndex).toBe(2);
    expect(window?.items.some((item) => item.id === ROOT_B)).toBe(false);
  });

  it("focus는 다른 큰 묶음이 있어도 선택한 묶음만 읽는다", async () => {
    // Given
    await insertComments(
      Array.from({ length: 500 }, (_, index) => ({
        id: `conversation-distractor-${index}`,
        todoId,
        authorId: "conversation-author",
        clientRequestId: randomUUID(),
        content: `관계없는 원문 ${index}`,
        createdAt: Temporal.Instant.from("2026-08-26T05:00:00.000Z"),
      })),
    );

    // When
    const window = await reader.listConversation({
      todoId,
      sort: "LATEST",
      size: 10,
      mode: "FOCUS",
      scope: "THREAD",
      anchorCommentId: CHILD_A,
    });

    // Then
    expect(window?.items.map((item) => item.id)).toEqual([ROOT_A, CHILD_A, CHILD_Z, GRANDCHILD]);
  });

  it("머리 댓글 focus는 그 묶음의 머리와 답글만 반환한다", async () => {
    // Given
    const input = {
      todoId,
      sort: "LATEST",
      size: 10,
      mode: "FOCUS",
      scope: "THREAD",
      anchorCommentId: ROOT_A,
    } as const;

    // When
    const window = await reader.listConversation(input);

    // Then
    expect(window?.items.map((item) => item.id)).toEqual([ROOT_A, CHILD_A, CHILD_Z, GRANDCHILD]);
    expect(window?.hasPrevious).toBe(false);
    expect(window?.hasNext).toBe(false);
  });

  it("cursor의 threadId가 실제 루트와 다르면 기준 댓글을 찾지 않는다", async () => {
    // Given
    const input = {
      todoId,
      sort: "LATEST",
      size: 2,
      mode: "AFTER",
      scope: "TODO",
      anchorCommentId: CHILD_A,
      anchorThreadId: ROOT_B,
      anchorPosition: { rootLikeCount: 0, rootReplyCount: 3 },
    } as const;

    // When
    const window = await reader.listConversation(input);

    // Then
    expect(window).toBeNull();
  });

  it("삭제된 답글로 열어도 묘비로 focus를 채우고 1.14.0 이하 앱의 대화 계약을 지킨다", async () => {
    // Given
    await softDeleteComment(CHILD_A, Temporal.Instant.from("2026-08-26T04:00:00.000Z"));
    const useCase = new GetTodoConversationUseCase({
      reader: reader,
      cursorCodec: cursorCodec,
      blockReader: blockRepository,
    });

    // When
    const response = toTodoConversationResponse(
      await useCase.execute({
        todoId,
        viewerId: "conversation-owner",
        sort: "LATEST",
        focusCommentId: CHILD_A,
        size: 3,
      }),
    );

    // Then
    expect(response.focus).toMatchObject({ commentId: CHILD_A, itemIndex: 1 });
    expect(response.items.map((item) => item.comment.id)).toEqual([ROOT_A, CHILD_A, CHILD_Z]);
    expect(response.items[1]).toMatchObject({
      comment: { id: CHILD_A, isDeleted: true, author: null, content: null, depth: 1 },
      isFocused: true,
    });
    expect(
      [...response.items, ...(response.focus?.precedingAncestors ?? [])].every(
        (item) => todoConversationConnectionSchema.safeParse(item.connection).success,
      ),
    ).toBe(true);
  });

  it("답글에 단 답글 focus는 같은 묶음 안에서 머리 lane과 @대상을 그린다", async () => {
    // Given
    const useCase = new GetTodoConversationUseCase({
      reader: reader,
      cursorCodec: cursorCodec,
      blockReader: blockRepository,
    });

    // When
    const response = toTodoConversationResponse(
      await useCase.execute({
        todoId,
        viewerId: "conversation-owner",
        sort: "LATEST",
        focusCommentId: GRANDCHILD,
        size: 2,
      }),
    );

    // Then
    expect(response.items.map((item) => item.comment.id)).toEqual([CHILD_Z, GRANDCHILD]);
    expect(response.items.at(-1)).toMatchObject({
      comment: { parentId: ROOT_A, depth: 1, replyTo: { commentId: CHILD_A } },
      connection: {
        visualDepth: 1,
        upperLaneDepths: [0],
        lowerLaneDepths: [],
        incomingBranch: { fromDepth: 0, toDepth: 1 },
      },
      isFocused: true,
    });
    expect(response.focus?.precedingAncestors.map((item) => item.comment.id)).toEqual([ROOT_A]);
    expect(
      [...response.items, ...(response.focus?.precedingAncestors ?? [])].every(
        (item) => todoConversationConnectionSchema.safeParse(item.connection).success,
      ),
    ).toBe(true);
  });

  it("답글 없는 삭제 댓글 focus는 다른 묶음으로 대체하지 않고 묘비 하나만 돌려준다", async () => {
    // Given
    await softDeleteComment(ROOT_B, Temporal.Instant.from("2026-08-26T04:00:00.000Z"));
    const useCase = new GetTodoConversationUseCase({
      reader: reader,
      cursorCodec: cursorCodec,
      blockReader: blockRepository,
    });

    // When
    const response = toTodoConversationResponse(
      await useCase.execute({
        todoId,
        viewerId: "conversation-owner",
        sort: "LATEST",
        focusCommentId: ROOT_B,
        size: 3,
      }),
    );

    // Then
    expect(response).toMatchObject({
      items: [{ comment: { id: ROOT_B, isDeleted: true }, isFocused: true }],
      focus: { commentId: ROOT_B, itemIndex: 0 },
      pagination: { hasPrevious: false, hasNext: false },
    });
  });

  it("지문이 없는 구버전 행도 구조와 내용이 같으면 안전하게 replay한다", async () => {
    // Given
    const input = {
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
    };

    // When
    const replayed = matchTodoCommentChainReplay({
      request: input,
      stored: await repository.listByAuthorIdAndClientRequestIds(
        UserId.reconstitute(input.authorId),
        input.items.map((item) => item.clientRequestId),
      ),
    });

    // Then
    expect(replayed).toEqual({ ok: true, commentIds: [ROOT_A, CHILD_A] });
  });

  it("지문이 없는 멱등 키의 내용이 다르면 replay하지 않는다", async () => {
    // Given
    const input = {
      todoId,
      authorId: "conversation-author",
      parentId: null,
      items: [
        {
          clientRequestId: "00000000-0000-4000-8000-000000000001",
          content: "다른 명령",
        },
      ],
    };

    // When
    const replay = matchTodoCommentChainReplay({
      request: input,
      stored: await repository.listByAuthorIdAndClientRequestIds(
        UserId.reconstitute(input.authorId),
        input.items.map((item) => item.clientRequestId),
      ),
    });

    // Then
    expect(replay).toEqual({ ok: false });
  });

  it("구버전 서버가 먼저 쓴 멱등 키의 SQLSTATE 23505를 애플리케이션 경합 오류로 번역한다", async () => {
    // Given
    const comment = TodoComment.create({
      id: await repository.nextId(),
      todoId,
      authorId: UserId.reconstitute("conversation-author"),
      placement: CommentPlacement.create(null),
      content: TodoCommentContent.create("오래된 루트"),
      clientRequestId: "00000000-0000-4000-8000-000000000001",
      requestFingerprint: "f".repeat(64),
      createdAt: COMMENT_UPDATED_AT,
    });

    // When
    const creation = repository.save(comment);

    // Then
    await expect(creation).rejects.toBeInstanceOf(TodoCommentIdempotencyRace);
  });
});
