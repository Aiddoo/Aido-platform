import { randomUUID } from "node:crypto";

import { TransactionHost } from "@nestjs-cls/transactional";
import { and, eq, sql } from "drizzle-orm";
import { omit } from "es-toolkit";

import { TodoCommentLikeRepositoryPort } from "#api/modules/engagement/comments/application/ports/todo-comment-like.repository.port";
import { TodoCommentNotificationPort } from "#api/modules/engagement/comments/application/ports/todo-comment-notification.port";
import { TodoCommentRepositoryPort } from "#api/modules/engagement/comments/application/ports/todo-comment.repository.port";
import { GetTodoConversationUseCase } from "#api/modules/engagement/comments/application/use-cases/get-todo-conversation.use-case";
import { GetTodoDetailsUseCase } from "#api/modules/engagement/comments/application/use-cases/get-todo-details.use-case";
import { LikeTodoCommentUseCase } from "#api/modules/engagement/comments/application/use-cases/like-todo-comment.use-case";
import { ListTodoCommentThreadsUseCase } from "#api/modules/engagement/comments/application/use-cases/list-todo-comment-threads.use-case";
import { UnlikeTodoCommentUseCase } from "#api/modules/engagement/comments/application/use-cases/unlike-todo-comment.use-case";
import { WriteTodoCommentChainUseCase } from "#api/modules/engagement/comments/application/use-cases/write-todo-comment-chain.use-case";
import { TodoComment } from "#api/modules/engagement/comments/domain/todo-comment.aggregate";
import { DrizzleTodoCommentRepository } from "#api/modules/engagement/comments/infrastructure/persistence/drizzle-todo-comment.repository";
import { NotificationCachePort } from "#api/modules/notification/inbox/application/ports/notification-cache.port";
import { PushDispatchStagingRepositoryPort } from "#api/modules/notification/push/application/ports/push-dispatch-staging.repository.port";
import { PublishPushDeliveryAfterCommitUseCase } from "#api/modules/notification/push/application/use-cases/publish-push-delivery-after-commit.use-case";
import { PublishPushDeliveryOutboxUseCase } from "#api/modules/notification/push/application/use-cases/publish-push-delivery-outbox.use-case";
import { databaseSqlState } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { createEntityId } from "#api/platform/database/entity-id";
import {
  follow,
  notification,
  pushDispatch,
  pushDispatchOutbox,
  todo,
  todoCategory,
  todoComment,
  todoCommentLike,
  user as userTable,
} from "#api/platform/database/schema/index";
import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "#test/e2e/helpers/e2e-app-factory";
import { UserFixture, TodoFixture, TodoCategoryFixture, FollowFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const AT = new Date("2027-01-08T12:00:00.000Z");
let statements: string[] | null = null;
describe("Engagement 댓글 실제 PostgreSQL 회귀", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let context: E2eTestContext;
  let userId: string;
  let authorId: string;
  let todoId: number;
  let roots: string[];
  let focusId: string;
  let repository: TodoCommentRepositoryPort;
  let likeRepository: TodoCommentLikeRepositoryPort;
  beforeAll(async () => {
    database = new TestDatabase({
      createClient: (url) =>
        createTestClient(url, { max: 4 }, (statement) => {
          if (statements !== null) {
            statements.push(statement);
          }
        }),
    });
    client = await database.start();
    context = await createE2eApp({ testDatabase: database });
    repository = context.module.get(TodoCommentRepositoryPort);
    likeRepository = context.module.get(TodoCommentLikeRepositoryPort);
  });
  beforeEach(async () => {
    statements = null;
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AT);
    const owner = UserFixture.create();
    const author = UserFixture.create();
    await client.insert(userTable).values([owner, author]);
    userId = owner.id;
    authorId = author.id;
    const [category] = await client
      .insert(todoCategory)
      .values(omit(TodoCategoryFixture.create({ userId, sortOrder: 0 }), ["id"]))
      .returning({ id: todoCategory.id });
    if (category === undefined) {
      throw new Error("category fixture missing");
    }
    const [createdTodo] = await client
      .insert(todo)
      .values(
        omit(
          TodoFixture.create({
            userId,
            categoryId: category.id,
            visibility: "PUBLIC",
            startDate: AT,
            sortOrder: 0,
            commentCount: 9,
          }),
          ["id"],
        ),
      )
      .returning({ id: todo.id });
    if (createdTodo === undefined) {
      throw new Error("todo fixture missing");
    }
    todoId = createdTodo.id;
    roots = [];
    focusId = "";
    for (let index = 0; index < 3; index++) {
      const rootId = createEntityId();
      const childId = createEntityId();
      const grandId = createEntityId();
      roots.push(rootId);
      await client.insert(todoComment).values({
        id: rootId,
        todoId,
        authorId,
        clientRequestId: randomUUID(),
        content: `루트 ${index}`,
        replyCount: 2,
        createdAt: Temporal.Instant.fromEpochMilliseconds(AT.getTime() + index * 1000),
        updatedAt: Temporal.Instant.fromEpochMilliseconds(AT.getTime()),
      });
      await client.insert(todoComment).values({
        id: childId,
        todoId,
        authorId: userId,
        clientRequestId: randomUUID(),
        content: `답글 ${index}`,
        parentId: rootId,
        replyToCommentId: rootId,
        createdAt: Temporal.Instant.fromEpochMilliseconds(AT.getTime() + index * 1000 + 100),
        updatedAt: Temporal.Instant.fromEpochMilliseconds(AT.getTime()),
      });
      await client.insert(todoComment).values({
        id: grandId,
        todoId,
        authorId,
        clientRequestId: randomUUID(),
        content: `하위 답글 ${index}`,
        parentId: rootId,
        replyToCommentId: childId,
        createdAt: Temporal.Instant.fromEpochMilliseconds(AT.getTime() + index * 1000 + 200),
        updatedAt: Temporal.Instant.fromEpochMilliseconds(AT.getTime()),
      });
      if (index === 0) {
        focusId = grandId;
      }
    }
  });
  afterEach(() => {
    statements = null;
    vi.useRealTimers();
  });
  afterAll(async () => {
    if (context) {
      await destroyE2eApp(context);
    } else {
      await database.stop();
    }
  });
  async function measure<T>(work: () => Promise<T>) {
    statements = [];
    const result = await work();
    const executed = statements.filter(
      (statement) => !/^\s*(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|SET)\b/i.test(statement),
    );
    statements = null;
    return { result, count: executed.length };
  }
  it("묶음이 1개든 3개든 목록은 같은 수의 쿼리로 읽는다", async () => {
    // Given
    const threads = context.module.get(ListTodoCommentThreadsUseCase);

    // When
    const one = await measure(() =>
      threads.execute({
        todoId,
        viewerId: userId,
        sort: "POPULAR",
        size: 1,
        page: { kind: "FIRST" },
      }),
    );
    const three = await measure(() =>
      threads.execute({
        todoId,
        viewerId: userId,
        sort: "POPULAR",
        size: 3,
        page: { kind: "FIRST" },
      }),
    );

    // Then
    expect(one.count).toBe(5);
    expect(three.count).toBe(5);
    expect(one.result.items).toHaveLength(1);
    expect(three.result.items).toHaveLength(3);
  });

  it("대화와 답글의 답글 focus 조회도 전체 작성자와 좋아요를 일괄 조회한다", async () => {
    // Given
    const conversation = context.module.get(GetTodoConversationUseCase);

    // When
    const normal = await measure(() =>
      conversation.execute({ todoId, viewerId: userId, sort: "LATEST", size: 9 }),
    );
    const focus = await measure(() =>
      conversation.execute({
        todoId,
        viewerId: userId,
        sort: "LATEST",
        size: 1,
        focusCommentId: focusId,
      }),
    );

    // Then
    expect(normal.count).toBe(4);
    expect(normal.result.items).toHaveLength(9);
    expect(focus.count).toBe(5);
    expect(focus.result.items).toHaveLength(1);
    expect(focus.result.focus).toMatchObject({
      itemIndex: 0,
      precedingThreadComments: expect.any(Array),
    });
    expect(focus.result.focus?.precedingThreadComments).toHaveLength(1);
    expect(focus.result.items.at(0)?.id).toBe(focusId);
  });

  // 할 일·카테고리·항목은 planning 조회 포트가 한 번에, 주인 프로필은 engagement가 따로 읽는다
  it("할 일 소유자 상세는 할 일 1번·주인 프로필 1번으로 읽는다", async () => {
    // Given
    const getDetails = context.module.get(GetTodoDetailsUseCase);

    // When
    const measured = await measure(() => getDetails.execute({ todoId, viewerId: userId }));

    // Then
    expect(measured.count).toBe(2);
    expect(measured.result).toMatchObject({ commentCount: 9 });
  });

  async function notificationTableCounts(source: Pick<typeof client, "$count">) {
    return Promise.all([
      source.$count(notification),
      source.$count(pushDispatch),
      source.$count(pushDispatchOutbox),
    ]);
  }

  it("알림 완료 표시가 외래 키 오류로 실패하면 알림과 outbox와 커밋 후 작업을 취소하고 원래 좋아요는 보존한다", async () => {
    // Given
    const commentId = roots[0];
    if (commentId === undefined) {
      throw new Error("root fixture missing");
    }
    const like = context.module.get(LikeTodoCommentUseCase);
    const txHost =
      context.module.get<TransactionHost<DrizzleTransactionalAdapter>>(TransactionHost);
    const publication = vi.spyOn(context.module.get(PublishPushDeliveryOutboxUseCase), "execute");
    const registration = vi.spyOn(
      context.module.get(PublishPushDeliveryAfterCommitUseCase),
      "register",
    );
    const cache = context.module.get<NotificationCachePort>(NotificationCachePort);
    const invalidation = vi.spyOn(cache, "invalidateUnreadCount");
    let stagedCounts: number[] = [];
    let markerSqlState: string | undefined;
    const saveLike = likeRepository.save.bind(likeRepository);
    let hasFailed = false;
    vi.spyOn(likeRepository, "save").mockImplementation(async (savedLike) => {
      if (!savedLike.wasEverNotified || hasFailed) {
        return saveLike(savedLike);
      }
      hasFailed = true;
      stagedCounts = await notificationTableCounts(txHost.tx);
      try {
        await txHost.tx.insert(todoCommentLike).values({
          commentId: createEntityId(),
          userId,
          isActive: true,
          updatedAt: Temporal.Now.instant(),
        });
      } catch (error) {
        markerSqlState = databaseSqlState(error);
        throw error;
      }
    });

    // When
    const first = await like.execute({ todoId, commentId, userId });

    // Then
    expect(markerSqlState).toBe("23503");
    expect(stagedCounts).toEqual([1, 1, 1]);
    expect(registration).toHaveBeenCalledTimes(1);
    expect(first).toEqual({ commentId, isLiked: true, likeCount: 1 });
    expect(
      await client.query.todoCommentLike.findFirst({ where: { commentId, userId } }),
    ).toMatchObject({ isActive: true, notifiedAt: null });
    expect(await client.query.todoComment.findFirst({ where: { id: commentId } })).toMatchObject({
      likeCount: 1,
    });
    expect(await notificationTableCounts(client)).toEqual([0, 0, 0]);
    expect(publication).not.toHaveBeenCalled();
    expect(invalidation).not.toHaveBeenCalled();

    // When
    const retry = await like.execute({ todoId, commentId, userId });
    await like.execute({ todoId, commentId, userId });

    // Then
    expect(retry).toEqual(first);
    expect(await notificationTableCounts(client)).toEqual([1, 1, 1]);
    expect(
      await client.query.todoCommentLike.findFirst({ where: { commentId, userId } }),
    ).toMatchObject({ notifiedAt: expect.any(Temporal.Instant) });
    expect(publication).toHaveBeenCalledTimes(1);
    expect(invalidation).toHaveBeenCalledTimes(1);
  });

  it("푸시 준비 단계가 외래 키 오류로 실패해도 원래 좋아요만 남기고 저장 중인 알림을 취소한다", async () => {
    // Given
    const commentId = roots[0];
    if (commentId === undefined) {
      throw new Error("root fixture missing");
    }
    const txHost =
      context.module.get<TransactionHost<DrizzleTransactionalAdapter>>(TransactionHost);
    const staging = context.module.get(PushDispatchStagingRepositoryPort);
    const stage = staging.stage.bind(staging);
    const publication = vi.spyOn(context.module.get(PublishPushDeliveryOutboxUseCase), "execute");
    let stagedNotificationCount = 0;
    let stagingSqlState: string | undefined;
    vi.spyOn(staging, "stage").mockImplementationOnce(async (input) => {
      stagedNotificationCount = await txHost.tx.$count(notification);
      try {
        return await stage({ ...input, notificationId: -1 });
      } catch (error) {
        stagingSqlState = databaseSqlState(error);
        throw error;
      }
    });

    // When
    const result = await context.module
      .get(LikeTodoCommentUseCase)
      .execute({ todoId, commentId, userId });

    // Then
    expect(stagedNotificationCount).toBe(1);
    expect(stagingSqlState).toBe("23503");
    expect(result).toEqual({ commentId, isLiked: true, likeCount: 1 });
    expect(
      await client.query.todoCommentLike.findFirst({ where: { commentId, userId } }),
    ).toMatchObject({ isActive: true, notifiedAt: null });
    expect(await notificationTableCounts(client)).toEqual([0, 0, 0]);
    expect(publication).not.toHaveBeenCalled();
  });

  it("좋아요 알림을 저장하는 중의 취소 요청은 같은 댓글 잠금을 기다리고 다시 좋아요해도 알림이 중복되지 않는다", async () => {
    // Given
    const commentId = roots[0];
    if (commentId === undefined) {
      throw new Error("root fixture missing");
    }
    const adapter = context.module.get(TodoCommentNotificationPort);
    const notify = adapter.notifyCommentLiked.bind(adapter);
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const notifySpy = vi
      .spyOn(adapter, "notifyCommentLiked")
      .mockImplementationOnce(async (input) => {
        entered.resolve();
        await release.promise;
        await notify(input);
      });
    const like = context.module.get(LikeTodoCommentUseCase);
    const first = like.execute({ todoId, commentId, userId });
    await Promise.race([
      entered.promise,
      first.then(() => {
        throw new Error("알림 진입 이전 완료");
      }),
    ]);

    // When
    const cancellation = context.module
      .get(UnlikeTodoCommentUseCase)
      .execute({ todoId, commentId, userId });
    try {
      await vi.waitFor(
        async () => {
          const { rows } = await client.execute<{ count: number }>(
            sql`SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'`,
          );
          expect(rows.at(0)?.count).toBe(1);
        },
        { timeout: 5000, interval: 10 },
      );
    } finally {
      release.resolve();
      await first;
      await cancellation;
    }
    await like.execute({ todoId, commentId, userId });

    // Then
    expect(notifySpy).toHaveBeenCalledTimes(1);
    expect(
      await client.query.todoComment.findFirst({
        columns: { likeCount: true },
        where: { id: commentId },
      }),
    ).toEqual({ likeCount: 1 });
    expect(
      await client.query.todoCommentLike.findFirst({ where: { commentId, userId } }),
    ).toMatchObject({ isActive: true, notifiedAt: expect.any(Temporal.Instant) });
    expect(await client.$count(notification)).toBe(1);
  });

  it("구버전 작성기와 unique 경합한 뒤 권한이 사라지면 저장된 댓글을 다시 보내도 거부한다", async () => {
    // Given
    await client.update(todo).set({ visibility: "PRIVATE" }).where(eq(todo.id, todoId));
    await client
      .insert(follow)
      .values([
        FollowFixture.create({ followerId: userId, followingId: authorId, status: "ACCEPTED" }),
        FollowFixture.create({ followerId: authorId, followingId: userId, status: "ACCEPTED" }),
      ]);
    const outside = new DrizzleTodoCommentRepository(
      createDatabaseTransactionFixture(client).txHost,
    );
    const save = repository.save.bind(repository);
    vi.spyOn(repository, "save").mockImplementationOnce(async (comment) => {
      // 구버전 작성기가 같은 멱등 키로 다른 id의 글을 먼저 커밋한다
      await outside.save(
        TodoComment.reconstitute({ ...comment.toPrimitives(), id: createEntityId() }),
      );
      await client
        .delete(follow)
        .where(and(eq(follow.followerId, userId), eq(follow.followingId, authorId)));
      await client
        .delete(follow)
        .where(and(eq(follow.followerId, authorId), eq(follow.followingId, userId)));
      return save(comment);
    });

    // When
    const outcome = context.module.get(WriteTodoCommentChainUseCase).execute({
      todoId,
      authorId,
      parentId: null,
      items: [{ clientRequestId: randomUUID(), content: "권한이 사라진 댓글" }],
    });

    // Then
    await expect(outcome).rejects.toMatchObject({ errorCode: "TODO_0801" });
  });
});
