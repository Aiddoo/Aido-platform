import { randomUUID } from "node:crypto";

import { TransactionHost } from "@nestjs-cls/transactional";
import { and, eq, sql } from "drizzle-orm";
import { omit } from "es-toolkit";

import {
  TODO_COMMENT_NOTIFICATION,
  type TodoCommentNotificationPort,
} from "#api/modules/engagement/application/ports/comments/todo-comment-notification.port";
import {
  TODO_COMMENT_REPOSITORY,
  type TodoCommentRepositoryPort,
} from "#api/modules/engagement/application/ports/comments/todo-comment.repository.port";
import { GetTodoCommentOverview } from "#api/modules/engagement/application/use-cases/comments/get-todo-comment-overview.use-case";
import { GetTodoConversation } from "#api/modules/engagement/application/use-cases/comments/get-todo-conversation.use-case";
import { GetTodoDetails } from "#api/modules/engagement/application/use-cases/comments/get-todo-details.use-case";
import { LikeTodoComment } from "#api/modules/engagement/application/use-cases/comments/like-todo-comment.use-case";
import { UnlikeTodoComment } from "#api/modules/engagement/application/use-cases/comments/unlike-todo-comment.use-case";
import { WriteTodoCommentChain } from "#api/modules/engagement/application/use-cases/comments/write-todo-comment-chain.use-case";
import { DrizzleTodoCommentRepository } from "#api/modules/engagement/infrastructure/persistence/comments/drizzle-todo-comment.repository";
import {
  NOTIFICATION_CACHE,
  type NotificationCachePort,
} from "#api/modules/notification/application/ports/delivery/notification-cache.port";
import {
  PUSH_DISPATCH_STAGING,
  type PushDispatchStagingRepositoryPort,
} from "#api/modules/notification/application/ports/delivery/push-dispatch-staging.repository.port";
import { PushDeliveryAfterCommitPublisher } from "#api/modules/notification/application/services/delivery/push-delivery-after-commit.publisher";
import { PublishPushDeliveryOutbox } from "#api/modules/notification/application/use-cases/delivery/publish-push-delivery-outbox.use-case";
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
import { UNIT_OF_WORK, type UnitOfWorkPort } from "#api/shared/application/ports/index";
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
  let uow: UnitOfWorkPort;
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
    repository = context.module.get(TODO_COMMENT_REPOSITORY);
    uow = context.module.get(UNIT_OF_WORK);
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
        createdAt: new Date(AT.getTime() + index * 1000),
      });
      await client.insert(todoComment).values({
        id: childId,
        todoId,
        authorId: userId,
        clientRequestId: randomUUID(),
        content: `답글 ${index}`,
        parentId: rootId,
        replyToCommentId: rootId,
        rootId,
        path: [rootId],
        depth: 1,
        createdAt: new Date(AT.getTime() + index * 1000 + 100),
      });
      await client.insert(todoComment).values({
        id: grandId,
        todoId,
        authorId,
        clientRequestId: randomUUID(),
        content: `하위 답글 ${index}`,
        parentId: rootId,
        replyToCommentId: childId,
        rootId,
        path: [rootId],
        depth: 1,
        createdAt: new Date(AT.getTime() + index * 1000 + 200),
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
  it("루트 댓글이 1개든 3개든 개요는 같은 수의 쿼리로 읽는다", async () => {
    // Given
    const overview = context.module.get(GetTodoCommentOverview);

    // When
    const one = await measure(() =>
      overview.execute({ todoId, viewerId: userId, sort: "POPULAR", size: 1 }),
    );
    const three = await measure(() =>
      overview.execute({ todoId, viewerId: userId, sort: "POPULAR", size: 3 }),
    );

    // Then
    expect(one.count).toBe(5);
    expect(three.count).toBe(5);
    expect(one.result.items).toHaveLength(1);
    expect(three.result.items).toHaveLength(3);
  });

  it("대화와 답글의 답글 focus 조회도 전체 작성자와 좋아요를 일괄 조회한다", async () => {
    // Given
    const conversation = context.module.get(GetTodoConversation);

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
      precedingAncestors: expect.any(Array),
    });
    expect(focus.result.focus?.precedingAncestors).toHaveLength(1);
    expect(focus.result.items.at(0)?.comment.id).toBe(focusId);
  });

  it("할 일 소유자 상세는 관계를 쿼리 1번으로 읽는다", async () => {
    // Given
    const getDetails = context.module.get(GetTodoDetails);

    // When
    const measured = await measure(() => getDetails.execute({ todoId, viewerId: userId }));

    // Then
    expect(measured.count).toBe(1);
    expect(measured.result.metrics).toMatchObject({ commentCount: 9 });
  });

  it("좋아요와 좋아요 취소는 조건부 쓰기와 카운터 재조회를 정해진 쿼리 수로 수행한다", async () => {
    // Given
    const commentId = roots[0];
    if (commentId === undefined) {
      throw new Error("root fixture missing");
    }

    // When
    const like = await measure(() => uow.run(() => repository.setLike(todoId, commentId, userId)));
    const unlike = await measure(() =>
      uow.run(() => repository.removeLike(todoId, commentId, userId)),
    );

    // Then
    expect(like.result).toMatchObject({ changed: true, isLiked: true, likeCount: 1 });
    expect(unlike.result).toMatchObject({ changed: true, isLiked: false, likeCount: 0 });
    expect(like.count).toBe(4);
    expect(unlike.count).toBe(5);
  });

  it("활성 상태이고 아직 알리지 않은 좋아요만 해당 댓글의 알림 대상으로 쿼리 1번에 읽는다", async () => {
    // Given
    const commentId = roots[0];
    if (commentId === undefined) {
      throw new Error("root fixture missing");
    }
    await uow.run(() => repository.setLike(todoId, commentId, userId));

    // When
    const eligible = await measure(() =>
      repository.findPendingLikeNotification(todoId, commentId, userId),
    );
    const otherTodo = await repository.findPendingLikeNotification(todoId + 1, commentId, userId);
    const selfLike = await repository.findPendingLikeNotification(todoId, commentId, authorId);
    await uow.run(() => repository.markLikeNotified(commentId, userId));
    const notified = await repository.findPendingLikeNotification(todoId, commentId, userId);
    await client
      .update(todoCommentLike)
      .set({ notifiedAt: null, isActive: false })
      .where(and(eq(todoCommentLike.commentId, commentId), eq(todoCommentLike.userId, userId)));
    const inactive = await repository.findPendingLikeNotification(todoId, commentId, userId);
    await client
      .update(todoCommentLike)
      .set({ isActive: true })
      .where(and(eq(todoCommentLike.commentId, commentId), eq(todoCommentLike.userId, userId)));
    await client.update(todoComment).set({ deletedAt: AT }).where(eq(todoComment.id, commentId));
    const deleted = await repository.findPendingLikeNotification(todoId, commentId, userId);

    // Then
    expect(eligible.count).toBe(1);
    expect(eligible.result).toEqual({ recipientId: authorId, threadRootId: commentId });
    expect(otherTodo).toBeNull();
    expect(selfLike).toBeNull();
    expect(notified).toBeNull();
    expect(inactive).toBeNull();
    expect(deleted).toBeNull();
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
    const like = context.module.get(LikeTodoComment);
    const txHost =
      context.module.get<TransactionHost<DrizzleTransactionalAdapter>>(TransactionHost);
    const publication = vi.spyOn(context.module.get(PublishPushDeliveryOutbox), "execute");
    const registration = vi.spyOn(context.module.get(PushDeliveryAfterCommitPublisher), "register");
    const cache = context.module.get<NotificationCachePort>(NOTIFICATION_CACHE);
    const invalidation = vi.spyOn(cache, "invalidateUnreadCount");
    let stagedCounts: number[] = [];
    let markerSqlState: string | undefined;
    vi.spyOn(repository, "markLikeNotified").mockImplementationOnce(async () => {
      stagedCounts = await notificationTableCounts(txHost.tx);
      try {
        await txHost.tx
          .insert(todoCommentLike)
          .values({ commentId: createEntityId(), userId, isActive: true });
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
    ).toMatchObject({ notifiedAt: expect.any(Date) });
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
    const staging = context.module.get<PushDispatchStagingRepositoryPort>(PUSH_DISPATCH_STAGING);
    const stage = staging.stage.bind(staging);
    const publication = vi.spyOn(context.module.get(PublishPushDeliveryOutbox), "execute");
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
    const result = await context.module.get(LikeTodoComment).execute({ todoId, commentId, userId });

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
    const adapter = context.module.get<TodoCommentNotificationPort>(TODO_COMMENT_NOTIFICATION);
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
    const like = context.module.get(LikeTodoComment);
    const first = like.execute({ todoId, commentId, userId });
    await Promise.race([
      entered.promise,
      first.then(() => {
        throw new Error("알림 진입 이전 완료");
      }),
    ]);

    // When
    const cancellation = context.module
      .get(UnlikeTodoComment)
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
    ).toMatchObject({ isActive: true, notifiedAt: expect.any(Date) });
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
    const create = repository.createCommentChain.bind(repository);
    vi.spyOn(repository, "createCommentChain").mockImplementationOnce(async (input) => {
      await outside.createCommentChain(input);
      await client
        .delete(follow)
        .where(and(eq(follow.followerId, userId), eq(follow.followingId, authorId)));
      await client
        .delete(follow)
        .where(and(eq(follow.followerId, authorId), eq(follow.followingId, userId)));
      return create(input);
    });

    // When
    const outcome = context.module.get(WriteTodoCommentChain).execute({
      todoId,
      authorId,
      parentId: null,
      items: [{ clientRequestId: randomUUID(), content: "권한이 사라진 댓글" }],
    });

    // Then
    await expect(outcome).rejects.toMatchObject({ errorCode: "TODO_0801" });
  });
});
