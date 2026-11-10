import type { CurrentUserPayload } from "@aido/api";
import { eq } from "drizzle-orm";

import { TodoCommentController } from "#api/modules/engagement/comments/presentation/http/v1/todo-comment.controller";
import { TodoCommentV2Controller } from "#api/modules/engagement/comments/presentation/http/v2/todo-comment.controller";
import {
  follow,
  todo,
  todoCategory,
  todoComment,
  todoCommentLike,
  todoItem,
  todoView,
  user,
  userBlock,
  userProfile,
} from "#api/platform/database/schema/index";
import { ErrorCodedException } from "#api/shared/domain/exceptions/error-coded.exception";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "#test/e2e/helpers/index";
import { UserFixture } from "#test/fixtures/index";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

// 같은 seed에서 v1·v2 목록·대화 응답과 cursor 문자열을 스냅샷으로 고정한다. 저장소·reader를 다시 써도 바이트가 같아야 한다
const T0 = Date.parse("2026-08-26T00:00:00.000Z");
const TODO_ID = 7001;
const OTHER_TODO_ID = 7002;
const CATEGORY_ID = 9001;
const SESSION_ID = "cmcharsession000000000001";

const OWNER_ID = "cmcharowner00000000000001";
const FRIEND_A_ID = "cmcharfrienda000000000001";
const FRIEND_B_ID = "cmcharfriendb000000000001";
const FRIEND_C_ID = "cmcharfriendc000000000001";

function at(offsetMs: number): Date {
  return new Date(T0 + offsetMs);
}

// 댓글 테이블은 Temporal 칸이라 같은 시각을 Instant로 넣는다
function instantAt(offsetMs: number): Temporal.Instant {
  return Temporal.Instant.fromEpochMilliseconds(T0 + offsetMs);
}

function toInstant(date: Date | undefined): Temporal.Instant | null {
  return date == null ? null : Temporal.Instant.fromEpochMilliseconds(date.getTime());
}

function commentId(label: string): string {
  return `cmchar${label.padEnd(19, "0")}`;
}

function requestId(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

const ROOT = {
  r1: commentId("r1"),
  r2: commentId("r2"),
  r3: commentId("r3"),
  r4: commentId("r4"),
  r5: commentId("r5"),
  r6: commentId("r6"),
  r7: commentId("r7"),
  other: commentId("other"),
};
const REPLY = {
  r1a: commentId("r1a"),
  r1b: commentId("r1b"),
  r1c: commentId("r1c"),
  r1d: commentId("r1d"),
  r3a: commentId("r3a"),
  r4a: commentId("r4a"),
  r7a: commentId("r7a"),
  r7b: commentId("r7b"),
  r7c: commentId("r7c"),
  r7d: commentId("r7d"),
  r7e: commentId("r7e"),
};
const MINUTE_MS = 60_000;
const SECOND_MS = 1000;

interface CommentSeed {
  readonly id: string;
  readonly authorId: string;
  readonly createdAt: Date;
  readonly parentId?: string;
  readonly replyToCommentId?: string;
  readonly likeCount?: number;
  readonly replyCount?: number;
  readonly deletedAt?: Date;
  readonly editedAt?: Date;
  readonly todoId?: number;
}

const COMMENTS: readonly CommentSeed[] = [
  { id: ROOT.r1, authorId: FRIEND_A_ID, createdAt: at(1 * MINUTE_MS), likeCount: 3, replyCount: 3 },
  {
    id: REPLY.r1a,
    authorId: OWNER_ID,
    createdAt: at(1 * MINUTE_MS + 1 * SECOND_MS),
    parentId: ROOT.r1,
    replyToCommentId: ROOT.r1,
    likeCount: 1,
  },
  {
    id: REPLY.r1b,
    authorId: FRIEND_B_ID,
    createdAt: at(1 * MINUTE_MS + 2 * SECOND_MS),
    parentId: ROOT.r1,
    replyToCommentId: REPLY.r1a,
  },
  {
    id: REPLY.r1c,
    authorId: FRIEND_C_ID,
    createdAt: at(1 * MINUTE_MS + 3 * SECOND_MS),
    parentId: ROOT.r1,
    replyToCommentId: REPLY.r1b,
  },
  {
    id: REPLY.r1d,
    authorId: FRIEND_A_ID,
    createdAt: at(1 * MINUTE_MS + 4 * SECOND_MS),
    parentId: ROOT.r1,
    replyToCommentId: REPLY.r1c,
    deletedAt: at(10 * MINUTE_MS),
  },
  { id: ROOT.r2, authorId: FRIEND_B_ID, createdAt: at(2 * MINUTE_MS), likeCount: 1 },
  { id: ROOT.r3, authorId: FRIEND_C_ID, createdAt: at(3 * MINUTE_MS), likeCount: 5, replyCount: 1 },
  {
    id: REPLY.r3a,
    authorId: FRIEND_A_ID,
    createdAt: at(3 * MINUTE_MS + 1 * SECOND_MS),
    parentId: ROOT.r3,
    replyToCommentId: ROOT.r3,
    likeCount: 1,
  },
  {
    id: ROOT.r4,
    authorId: OWNER_ID,
    createdAt: at(4 * MINUTE_MS),
    replyCount: 1,
    deletedAt: at(11 * MINUTE_MS),
  },
  {
    id: REPLY.r4a,
    authorId: FRIEND_B_ID,
    createdAt: at(4 * MINUTE_MS + 1 * SECOND_MS),
    parentId: ROOT.r4,
    replyToCommentId: ROOT.r4,
  },
  {
    id: ROOT.r5,
    authorId: FRIEND_A_ID,
    createdAt: at(5 * MINUTE_MS),
    deletedAt: at(12 * MINUTE_MS),
  },
  { id: ROOT.r6, authorId: FRIEND_A_ID, createdAt: at(6 * MINUTE_MS), likeCount: 3 },
  {
    id: ROOT.r7,
    authorId: OWNER_ID,
    createdAt: at(7 * MINUTE_MS),
    likeCount: 1,
    replyCount: 5,
    editedAt: at(8 * MINUTE_MS),
  },
  ...(["r7a", "r7b", "r7c", "r7d", "r7e"] as const).map((label, index): CommentSeed => ({
    id: REPLY[label],
    authorId: [FRIEND_A_ID, FRIEND_B_ID, OWNER_ID, FRIEND_C_ID, FRIEND_A_ID][index] ?? OWNER_ID,
    // r7c·r7d는 같은 시각이라 id 순서가 동순위를 가른다
    createdAt: at(7 * MINUTE_MS + Math.min(index, 3) * SECOND_MS + (index === 4 ? SECOND_MS : 0)),
    parentId: ROOT.r7,
    likeCount: label === "r7c" ? 1 : 0,
    replyToCommentId:
      index === 0 ? ROOT.r7 : REPLY[(["r7a", "r7b", "r7c", "r7d"] as const)[index - 1] ?? "r7a"],
  })),
  { id: ROOT.other, authorId: OWNER_ID, createdAt: at(9 * MINUTE_MS), todoId: OTHER_TODO_ID },
];

const LIKES = [
  { commentId: ROOT.r1, userId: OWNER_ID, isActive: true },
  { commentId: REPLY.r3a, userId: OWNER_ID, isActive: true },
  { commentId: ROOT.r2, userId: FRIEND_A_ID, isActive: true },
  { commentId: ROOT.r7, userId: FRIEND_A_ID, isActive: true },
  { commentId: ROOT.r6, userId: FRIEND_A_ID, isActive: false },
  { commentId: REPLY.r7c, userId: FRIEND_A_ID, isActive: true },
];

function viewer(userId: string): CurrentUserPayload {
  return { userId, email: `${userId}@example.com`, sessionId: SESSION_ID, role: "USER" };
}

async function capture<T>(work: () => Promise<T>): Promise<T | { readonly error: string }> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof ErrorCodedException) {
      return { error: error.errorCode };
    }
    throw error;
  }
}

async function seed(client: TestDatabaseClient): Promise<void> {
  const users = [
    { id: OWNER_ID, tag: "CHAROWN1" },
    { id: FRIEND_A_ID, tag: "CHARFRA1" },
    { id: FRIEND_B_ID, tag: "CHARFRB1" },
    { id: FRIEND_C_ID, tag: "CHARFRC1" },
  ];
  await client.insert(user).values(
    users.map(({ id, tag }) =>
      UserFixture.create({
        id,
        email: `${id}@example.com`,
        userTag: tag,
        createdAt: instantAt(0),
        updatedAt: instantAt(0),
      }),
    ),
  );
  await client.insert(userProfile).values([
    { id: commentId("p-owner"), userId: OWNER_ID, name: "주인", profileImage: "russian_blue" },
    { id: commentId("p-a"), userId: FRIEND_A_ID, name: "친구A", profileImage: "cream_cat" },
    { id: commentId("p-c"), userId: FRIEND_C_ID, name: "친구C", profileImage: null },
  ]);
  await client.insert(follow).values(
    [FRIEND_A_ID, FRIEND_B_ID, FRIEND_C_ID].map((friendId, index) => ({
      id: commentId(`f${index}`),
      followerId: OWNER_ID,
      followingId: friendId,
      status: "ACCEPTED" as const,
      createdAt: at(0),
      updatedAt: at(0),
    })),
  );
  await client.insert(userBlock).values({
    id: commentId("block"),
    blockerId: FRIEND_A_ID,
    blockedId: FRIEND_C_ID,
    createdAt: at(0),
  });
  await client.insert(todoCategory).values({
    id: CATEGORY_ID,
    userId: OWNER_ID,
    name: "특성",
    color: "#123456",
    sortOrder: 0,
    createdAt: at(0),
    updatedAt: at(0),
  });
  await client.insert(todo).values(
    [TODO_ID, OTHER_TODO_ID].map((id) => ({
      id,
      userId: OWNER_ID,
      categoryId: CATEGORY_ID,
      title: `특성 할 일 ${id}`,
      startDate: new Date("2026-08-26T00:00:00.000Z"),
      sortOrder: id,
      visibility: "PUBLIC" as const,
      commentCount: id === TODO_ID ? 15 : 1,
      viewCount: 4,
      createdAt: at(0),
      updatedAt: at(0),
    })),
  );
  await client.insert(todoItem).values([
    {
      todoId: TODO_ID,
      title: "첫 항목",
      sortOrder: 1,
      completed: true,
      createdAt: at(0),
      updatedAt: at(0),
    },
    { todoId: TODO_ID, title: "둘째 항목", sortOrder: 0, createdAt: at(0), updatedAt: at(0) },
  ]);
  await client.insert(todoComment).values(
    COMMENTS.map((comment, index) => ({
      id: comment.id,
      todoId: comment.todoId ?? TODO_ID,
      authorId: comment.authorId,
      clientRequestId: requestId(index),
      content: comment.deletedAt == null ? `내용 ${comment.id.slice(6, 10)}` : null,
      parentId: comment.parentId ?? null,
      replyToCommentId: comment.replyToCommentId ?? null,
      likeCount: comment.likeCount ?? 0,
      replyCount: comment.replyCount ?? 0,
      deletedAt: toInstant(comment.deletedAt),
      editedAt: toInstant(comment.editedAt),
      createdAt: Temporal.Instant.fromEpochMilliseconds(comment.createdAt.getTime()),
      updatedAt: Temporal.Instant.fromEpochMilliseconds(comment.createdAt.getTime()),
    })),
  );
  await client
    .insert(todoCommentLike)
    .values(LIKES.map((like) => ({ ...like, createdAt: instantAt(0), updatedAt: instantAt(0) })));
}

describe("댓글 읽기 응답 특성 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let context: E2eTestContext;
  let v1: TodoCommentController;
  let v2: TodoCommentV2Controller;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
    context = await createE2eApp({ testDatabase: database });
    v1 = context.module.get(TodoCommentController);
    v2 = context.module.get(TodoCommentV2Controller);
  });

  beforeEach(async () => {
    await context.reset();
    await seed(client);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    if (context) {
      await destroyE2eApp(context);
    } else {
      await database.stop();
    }
  });

  const params = { todoId: TODO_ID };

  async function walkThreads(
    viewerId: string,
    sort: "LATEST" | "POPULAR",
    size: number,
    appVersion?: string,
  ) {
    const pages = [];
    let page = await v2.getThreads(viewer(viewerId), params, { sort, size }, appVersion);
    pages.push(page);
    while (page.pagination.nextCursor != null) {
      page = await v2.getThreads(
        viewer(viewerId),
        params,
        { sort, size, cursor: page.pagination.nextCursor },
        appVersion,
      );
      pages.push(page);
    }
    while (page.pagination.previousCursor != null) {
      page = await v2.getThreads(
        viewer(viewerId),
        params,
        { sort, size, cursor: page.pagination.previousCursor },
        appVersion,
      );
      pages.push(page);
    }
    return pages;
  }

  async function walkReplies(viewerId: string, threadId: string, size: number) {
    const replyParams = { todoId: TODO_ID, commentId: threadId };
    const pages = [];
    let page = await v2.getReplies(viewer(viewerId), replyParams, { size }, "1.15.0");
    pages.push(page);
    while (page.pagination.nextCursor != null) {
      page = await v2.getReplies(
        viewer(viewerId),
        replyParams,
        { size, cursor: page.pagination.nextCursor },
        "1.15.0",
      );
      pages.push(page);
    }
    while (page.pagination.previousCursor != null) {
      page = await v2.getReplies(
        viewer(viewerId),
        replyParams,
        { size, cursor: page.pagination.previousCursor },
        "1.15.0",
      );
      pages.push(page);
    }
    return pages;
  }

  async function walkOverview(viewerId: string, sort: "LATEST" | "POPULAR", size: number) {
    const pages = [];
    let page = await v1.getOverview(viewer(viewerId), params, { sort, size }, "1.14.0");
    pages.push(page);
    while (page.pagination.nextCursor != null) {
      page = await v1.getOverview(
        viewer(viewerId),
        params,
        { sort, size, after: page.pagination.nextCursor },
        "1.14.0",
      );
      pages.push(page);
    }
    while (page.pagination.previousCursor != null) {
      page = await v1.getOverview(
        viewer(viewerId),
        params,
        { sort, size, before: page.pagination.previousCursor },
        "1.14.0",
      );
      pages.push(page);
    }
    return pages;
  }

  async function walkConversation(
    viewerId: string,
    query: { sort: "LATEST" | "POPULAR"; size: number; focusCommentId?: string },
  ) {
    const pages = [];
    const first = await capture(() => v1.getConversation(viewer(viewerId), params, query));
    pages.push(first);
    if ("error" in first) {
      return pages;
    }
    const sortAndSize = { sort: query.sort, size: query.size };
    let page = first;
    while (page.pagination.nextCursor != null) {
      page = await v1.getConversation(viewer(viewerId), params, {
        ...sortAndSize,
        after: page.pagination.nextCursor,
      });
      pages.push(page);
    }
    while (page.pagination.previousCursor != null) {
      page = await v1.getConversation(viewer(viewerId), params, {
        ...sortAndSize,
        before: page.pagination.previousCursor,
      });
      pages.push(page);
    }
    if (first.pagination.previousCursor != null) {
      pages.push(
        await v1.getConversation(viewer(viewerId), params, {
          ...sortAndSize,
          before: first.pagination.previousCursor,
        }),
      );
    }
    return pages;
  }

  it("v2 묶음 목록은 최신·인기순 양방향 cursor와 anchor 페이지가 같다", async () => {
    // When
    const result = {
      latestAsFriend: await walkThreads(FRIEND_A_ID, "LATEST", 2, "1.15.0"),
      popularAsFriend: await walkThreads(FRIEND_A_ID, "POPULAR", 2, "1.15.0"),
      latestAsOwnerOldApp: await walkThreads(OWNER_ID, "LATEST", 3),
      popularAsOwner: await walkThreads(OWNER_ID, "POPULAR", 4, "1.15.0"),
      anchors: await Promise.all(
        [REPLY.r1b, REPLY.r4a, ROOT.r5, ROOT.r3, REPLY.r7e, commentId("missing")].map(
          (anchorCommentId) =>
            v2.getThreads(
              viewer(FRIEND_A_ID),
              params,
              { sort: "POPULAR", size: 2, anchorCommentId },
              "1.15.0",
            ),
        ),
      ),
      foreignCursor: await capture(async () => {
        const otherPage = await v2.getThreads(
          viewer(OWNER_ID),
          { todoId: OTHER_TODO_ID },
          { sort: "LATEST", size: 1 },
        );
        return v2.getThreads(viewer(OWNER_ID), params, {
          sort: "LATEST",
          size: 1,
          cursor: otherPage.pagination.nextCursor ?? "missing",
        });
      }),
      wrongSortCursor: await capture(async () => {
        const latest = await v2.getThreads(viewer(OWNER_ID), params, { sort: "LATEST", size: 1 });
        return v2.getThreads(viewer(OWNER_ID), params, {
          sort: "POPULAR",
          size: 1,
          cursor: latest.pagination.nextCursor ?? "missing",
        });
      }),
    };

    // Then
    expect(result).toMatchSnapshot();
  });

  it("v2 답글 목록은 작성 순 양방향 cursor와 around 페이지가 같다", async () => {
    // Given
    const replyParams = { todoId: TODO_ID, commentId: ROOT.r7 };

    // When
    const result = {
      r7AsFriend: await walkReplies(FRIEND_A_ID, ROOT.r7, 2),
      r1AsFriend: await walkReplies(FRIEND_A_ID, ROOT.r1, 2),
      r4AsOwner: await walkReplies(OWNER_ID, ROOT.r4, 1),
      around: await Promise.all(
        [REPLY.r7c, REPLY.r7e, REPLY.r1d, REPLY.r3a].map((aroundReplyId) =>
          v2.getReplies(viewer(OWNER_ID), replyParams, { size: 3, aroundReplyId }),
        ),
      ),
      replyAsThread: await capture(() =>
        v2.getReplies(viewer(OWNER_ID), { todoId: TODO_ID, commentId: REPLY.r7a }, { size: 2 }),
      ),
      inaccessible: await capture(() =>
        v2.getReplies(viewer(FRIEND_A_ID), { todoId: 999_999, commentId: ROOT.r7 }, { size: 2 }),
      ),
    };

    // Then
    expect(result).toMatchSnapshot();
  });

  it("v1 개요는 before·after cursor로 같은 페이지를 준다", async () => {
    // When
    const result = {
      latestAsFriend: await walkOverview(FRIEND_A_ID, "LATEST", 2),
      popularAsOwner: await walkOverview(OWNER_ID, "POPULAR", 3),
      oldAppAsOwner: await v1.getOverview(viewer(OWNER_ID), params, { sort: "LATEST", size: 30 }),
    };

    // Then
    expect(result).toMatchSnapshot();
  });

  it("v1 대화는 일반·focus 창과 묶음 범위 cursor가 같다", async () => {
    // When
    const result = {
      latestAsFriend: await walkConversation(FRIEND_A_ID, { sort: "LATEST", size: 3 }),
      popularAsOwner: await walkConversation(OWNER_ID, { sort: "POPULAR", size: 4 }),
      focus: await Promise.all(
        [REPLY.r1b, ROOT.r7, REPLY.r4a, ROOT.r5, REPLY.r7d, commentId("missing")].map(
          (focusCommentId) =>
            walkConversation(FRIEND_A_ID, { sort: "POPULAR", size: 3, focusCommentId }),
        ),
      ),
      focusOldApp: await v1.getConversation(
        viewer(OWNER_ID),
        params,
        { sort: "LATEST", size: 2, focusCommentId: REPLY.r1c },
        "1.9.0",
      ),
    };

    // Then
    expect(result).toMatchSnapshot();
  });

  it("인기순 cursor는 페이지 사이에 점수가 바뀌어도 처음 정한 순위를 이어받는다", async () => {
    // Given
    const firstThreads = await v2.getThreads(viewer(OWNER_ID), params, {
      sort: "POPULAR",
      size: 2,
    });
    const firstConversation = await v1.getConversation(viewer(OWNER_ID), params, {
      sort: "POPULAR",
      size: 3,
    });
    const firstOverview = await v1.getOverview(viewer(OWNER_ID), params, {
      sort: "POPULAR",
      size: 2,
    });
    await client.update(todoComment).set({ likeCount: 0 }).where(eq(todoComment.id, ROOT.r3));
    await client.update(todoComment).set({ likeCount: 9 }).where(eq(todoComment.id, ROOT.r6));
    await client
      .update(todoComment)
      .set({ deletedAt: instantAt(20 * MINUTE_MS), content: null })
      .where(eq(todoComment.id, ROOT.r1));

    // When
    const result = {
      firstThreads,
      nextThreads: await v2.getThreads(viewer(OWNER_ID), params, {
        sort: "POPULAR",
        size: 2,
        cursor: firstThreads.pagination.nextCursor ?? "missing",
      }),
      firstConversation,
      nextConversation: await v1.getConversation(viewer(OWNER_ID), params, {
        sort: "POPULAR",
        size: 3,
        after: firstConversation.pagination.nextCursor ?? "missing",
      }),
      firstOverview,
      nextOverview: await v1.getOverview(viewer(OWNER_ID), params, {
        sort: "POPULAR",
        size: 2,
        after: firstOverview.pagination.nextCursor ?? "missing",
      }),
    };

    // Then
    expect(result).toMatchSnapshot();
  });

  it("상세는 주인이 아닌 사람의 첫 조회만 조회 수에 더한다", async () => {
    // Given
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at(30 * MINUTE_MS));

    // When
    const details = [
      await v1.getDetails(viewer(OWNER_ID), params),
      await v1.getDetails(viewer(FRIEND_A_ID), params, "1.15.0"),
      await v1.getDetails(viewer(FRIEND_A_ID), params, "1.15.0"),
      await v1.getDetails(viewer(FRIEND_B_ID), params),
      await capture(() => v1.getDetails(viewer(FRIEND_A_ID), { todoId: 999_999 })),
    ];
    const [stored] = await client
      .select({ viewCount: todo.viewCount, commentCount: todo.commentCount })
      .from(todo)
      .where(eq(todo.id, TODO_ID));
    const views = await client
      .select({ viewerId: todoView.viewerId })
      .from(todoView)
      .orderBy(todoView.viewerId);

    // Then
    expect({ details, stored, views }).toMatchSnapshot();
  });

  it("쓰기·삭제·좋아요는 할 일 댓글 수·답글 수·좋아요 수를 같은 값으로 바꾼다", async () => {
    // Given
    async function counts() {
      const [stored] = await client
        .select({ commentCount: todo.commentCount, viewCount: todo.viewCount })
        .from(todo)
        .where(eq(todo.id, TODO_ID));
      const rows = await client
        .select({
          id: todoComment.id,
          likeCount: todoComment.likeCount,
          replyCount: todoComment.replyCount,
          isDeleted: todoComment.deletedAt,
        })
        .from(todoComment)
        .where(eq(todoComment.todoId, TODO_ID))
        .orderBy(todoComment.createdAt, todoComment.id);
      return {
        commentCount: stored?.commentCount,
        viewCount: stored?.viewCount,
        comments: rows.map((row) => ({
          likeCount: row.likeCount,
          replyCount: row.replyCount,
          isDeleted: row.isDeleted != null,
        })),
      };
    }
    const chainBody = {
      parentId: null,
      items: [
        { clientRequestId: requestId(900), content: "  새 댓글  " },
        { clientRequestId: requestId(901), content: "이어 쓴 글" },
      ],
    };

    // When
    const steps: Record<string, unknown> = { initial: await counts() };
    const written = await v1.writeComments(viewer(FRIEND_A_ID), params, chainBody);
    steps.afterChain = await counts();
    steps.chainShape = written.comments.map((comment) => ({
      depth: comment.depth,
      content: comment.content,
      replyCount: comment.replyCount,
      isLiked: comment.viewer.isLiked,
      replyTo: comment.replyTo == null ? null : "previous",
    }));
    const replayed = await v1.writeComments(viewer(FRIEND_A_ID), params, chainBody);
    steps.replaySameIds =
      JSON.stringify(replayed.comments.map((comment) => comment.id)) ===
      JSON.stringify(written.comments.map((comment) => comment.id));
    steps.afterReplay = await counts();
    steps.conflict = await capture(() =>
      v1.writeComments(viewer(FRIEND_A_ID), params, {
        ...chainBody,
        items: [{ clientRequestId: requestId(900), content: "다른 내용" }],
      }),
    );
    await v1.writeComments(viewer(FRIEND_B_ID), params, {
      parentId: REPLY.r7c,
      items: [{ clientRequestId: requestId(902), content: "답글에 답글" }],
    });
    steps.afterReply = await counts();
    steps.blockedReply = await capture(() =>
      v1.writeComments(viewer(FRIEND_A_ID), params, {
        parentId: ROOT.r3,
        items: [{ clientRequestId: requestId(903), content: "차단" }],
      }),
    );
    steps.deletedTarget = await capture(() =>
      v1.writeComments(viewer(FRIEND_B_ID), params, {
        parentId: ROOT.r5,
        items: [{ clientRequestId: requestId(904), content: "지운 글" }],
      }),
    );
    steps.deleteReply = await v1.deleteComment(viewer(FRIEND_B_ID), {
      todoId: TODO_ID,
      commentId: REPLY.r7b,
    });
    steps.deleteAgain = await v1.deleteComment(viewer(FRIEND_B_ID), {
      todoId: TODO_ID,
      commentId: REPLY.r7b,
    });
    steps.afterDeleteReply = await counts();
    steps.ownerDeletesRoot = await v1.deleteComment(viewer(OWNER_ID), {
      todoId: TODO_ID,
      commentId: ROOT.r1,
    });
    steps.strangerDelete = await capture(() =>
      v1.deleteComment(viewer(FRIEND_B_ID), { todoId: TODO_ID, commentId: ROOT.r6 }),
    );
    steps.afterDeleteRoot = await counts();
    steps.likes = [
      await v1.likeComment(viewer(FRIEND_B_ID), { todoId: TODO_ID, commentId: ROOT.r6 }),
      await v1.likeComment(viewer(FRIEND_B_ID), { todoId: TODO_ID, commentId: ROOT.r6 }),
      await v1.unlikeComment(viewer(FRIEND_A_ID), { todoId: TODO_ID, commentId: ROOT.r7 }),
      await v1.unlikeComment(viewer(FRIEND_A_ID), { todoId: TODO_ID, commentId: ROOT.r7 }),
      await v1.likeComment(viewer(FRIEND_A_ID), { todoId: TODO_ID, commentId: ROOT.r6 }),
      await capture(() =>
        v1.likeComment(viewer(FRIEND_A_ID), { todoId: TODO_ID, commentId: ROOT.r3 }),
      ),
      await capture(() =>
        v1.likeComment(viewer(FRIEND_B_ID), { todoId: TODO_ID, commentId: ROOT.r5 }),
      ),
      await capture(() =>
        v1.unlikeComment(viewer(FRIEND_B_ID), { todoId: TODO_ID, commentId: ROOT.r1 }),
      ),
    ];
    steps.afterLikes = await counts();
    const edited = await v1.updateComment(
      viewer(OWNER_ID),
      { todoId: TODO_ID, commentId: REPLY.r7c },
      { content: "  고친 내용 " },
    );
    steps.edited = {
      content: edited.comment.content,
      isEdited: edited.comment.isEdited,
      isLiked: edited.comment.viewer.isLiked,
      createdAt: edited.comment.createdAt,
    };
    steps.foreignEdit = await capture(() =>
      v1.updateComment(
        viewer(FRIEND_A_ID),
        { todoId: TODO_ID, commentId: REPLY.r7c },
        { content: "남의 글" },
      ),
    );

    // Then
    expect(steps).toMatchSnapshot();
  });
});
