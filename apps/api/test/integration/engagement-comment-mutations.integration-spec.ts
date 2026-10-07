import { randomUUID } from "node:crypto";

import { TransactionHost } from "@nestjs-cls/transactional";
import type { SqlMiddleware } from "@prisma/orm-postgres/family-runtime";
import postgres from "@prisma/orm-postgres/runtime";
import { omit } from "es-toolkit";
import { Pool } from "pg";

import type { Contract } from "#api/generated/prisma8/contract.d";
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
import { PrismaTodoCommentRepository } from "#api/modules/engagement/infrastructure/persistence/comments/prisma-todo-comment.repository";
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
import { encodeCreate, encodePatch } from "#api/platform/database/database-records";
import { utcTimestampParameters } from "#api/platform/database/database-timestamp.middleware";
import { createEntityId } from "#api/platform/database/database-values";
import { databaseSqlState } from "#api/platform/database/prisma-error.util";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "#api/shared/application/ports/index";
import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "#test/e2e/helpers/e2e-app-factory";
import { UserFixture, TodoFixture, TodoCategoryFixture, FollowFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

import contractJson from "../../src/generated/prisma8/contract.json" with { type: "json" };
const AT = new Date("2027-01-08T12:00:00.000Z");
let statements: string[] | null = null;
const trace: SqlMiddleware = {
  name: "engagement-query-observer",
  familyId: "sql",
  async afterQuery(plan, result) {
    if (statements !== null && result.source === "driver") statements.push(plan.sql);
  },
  async afterExecute(plan, result) {
    if (statements !== null && result.source === "driver") statements.push(plan.sql);
  },
};
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
      createClient(url) {
        const pool = new Pool({ connectionString: url, max: 4 });
        const native = postgres<Contract>({
          contractJson,
          pg: pool,
          middleware: [utcTimestampParameters, trace],
        });
        let closed = false;
        return {
          ...native,
          async close() {
            if (closed) return;
            closed = true;
            await native.close();
            await pool.end();
          },
        };
      },
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
    await client.orm.public.User.create(encodeCreate("User", owner));
    await client.orm.public.User.create(encodeCreate("User", author));
    userId = owner.id;
    authorId = author.id;
    const category = await client.orm.public.TodoCategory.create(
      encodeCreate(
        "TodoCategory",
        omit(TodoCategoryFixture.create({ userId, sortOrder: 0 }), ["id"]),
      ),
    );
    const todo = await client.orm.public.Todo.create(
      encodeCreate(
        "Todo",
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
      ),
    );
    todoId = todo.id;
    roots = [];
    focusId = "";
    for (let index = 0; index < 3; index++) {
      const root = await client.orm.public.TodoComment.create(
        encodeCreate("TodoComment", {
          id: createEntityId(),
          todoId,
          authorId,
          clientRequestId: randomUUID(),
          content: `루트 ${index}`,
          replyCount: 1,
          createdAt: new Date(AT.getTime() + index * 1000),
        }),
      );
      roots.push(root.id);
      const child = await client.orm.public.TodoComment.create(
        encodeCreate("TodoComment", {
          id: createEntityId(),
          todoId,
          authorId: userId,
          clientRequestId: randomUUID(),
          content: `답글 ${index}`,
          parentId: root.id,
          rootId: root.id,
          path: [root.id],
          depth: 1,
          replyCount: 1,
          createdAt: new Date(AT.getTime() + index * 1000 + 100),
        }),
      );
      const grand = await client.orm.public.TodoComment.create(
        encodeCreate("TodoComment", {
          id: createEntityId(),
          todoId,
          authorId,
          clientRequestId: randomUUID(),
          content: `하위 답글 ${index}`,
          parentId: child.id,
          rootId: root.id,
          path: [root.id, child.id],
          depth: 2,
          createdAt: new Date(AT.getTime() + index * 1000 + 200),
        }),
      );
      if (index === 0) focusId = grand.id;
    }
  });
  afterEach(() => {
    statements = null;
    vi.useRealTimers();
  });
  afterAll(async () => {
    if (context) await destroyE2eApp(context);
    else await database.stop();
  });
  async function measure<T>(name: string, work: () => Promise<T>) {
    statements = [];
    const result = await work();
    const sql = statements.filter(
      (sql) => !/^\s*(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|SET)\b/i.test(sql),
    );
    statements = null;
    process.stdout.write(
      "ENGAGEMENT_SQL_AFTER " +
        JSON.stringify({
          name,
          count: sql.length,
          nativeLikeReads: sql.filter((sql) => sql.includes('FROM "public"."TodoCommentLike"'))
            .length,
          recursive: sql.filter((sql) => sql.includes("WITH RECURSIVE")).length,
          statementHeads: sql.map((sql) => sql.trim().slice(0, 100)),
        }) +
        "\n",
    );
    return { result, count: sql.length };
  }
  it("root 1개와 3개의 Overview는 같은 고정 SQL 수로 읽는다", async () => {
    const overview = context.module.get(GetTodoCommentOverview);
    const one = await measure("overview-size1", () =>
      overview.execute({ todoId, viewerId: userId, sort: "POPULAR", size: 1 }),
    );
    const three = await measure("overview-size3", () =>
      overview.execute({ todoId, viewerId: userId, sort: "POPULAR", size: 3 }),
    );
    expect(one.count).toBe(4);
    expect(three.count).toBe(4);
    expect(one.result.items).toHaveLength(1);
    expect(three.result.items).toHaveLength(3);
  });
  it("대화와 깊은 focus도 전체 작성자·좋아요를 일괄 조회한다", async () => {
    const conversation = context.module.get(GetTodoConversation);
    const normal = await measure("conversation-size9", () =>
      conversation.execute({ todoId, viewerId: userId, sort: "LATEST", size: 9 }),
    );
    const focus = await measure("conversation-focus-size1", () =>
      conversation.execute({
        todoId,
        viewerId: userId,
        sort: "LATEST",
        size: 1,
        focusCommentId: focusId,
      }),
    );
    expect(normal.count).toBe(3);
    expect(normal.result.items).toHaveLength(9);
    process.stdout.write(
      "ENGAGEMENT_FOCUS_AFTER " +
        JSON.stringify({
          requestedSize: 1,
          returnedItems: focus.result.items.length,
          focusIndex: focus.result.focus?.itemIndex,
          precedingAncestors: focus.result.focus?.precedingAncestors.length,
        }) +
        "\n",
    );
    expect(focus.count).toBe(4);
    expect(focus.result.items).toHaveLength(1);
    expect(focus.result.focus).toMatchObject({
      itemIndex: 0,
      precedingAncestors: expect.any(Array),
    });
    expect(focus.result.focus?.precedingAncestors).toHaveLength(2);
    expect(focus.result.items.at(0)?.comment.id).toBe(focusId);
  });
  it("Todo 소유자 상세는 관계들을 한 SQL로 읽는다", async () => {
    const measured = await measure("details-owner", () =>
      context.module.get(GetTodoDetails).execute({ todoId, viewerId: userId }),
    );
    expect(measured.count).toBe(1);
    expect(measured.result.metrics).toMatchObject({ commentCount: 9 });
  });
  it("Like/Unlike Repository의 조건부 쓰기와 counter후 재조회 수를 측정한다", async () => {
    const commentId = roots[0];
    if (commentId === undefined) throw new Error("root fixture missing");
    const like = await measure("repository-set-like", () =>
      uow.run(() => repository.setLike(todoId, commentId, userId)),
    );
    const unlike = await measure("repository-remove-like", () =>
      uow.run(() => repository.removeLike(todoId, commentId, userId)),
    );
    expect(like.result).toMatchObject({ changed: true, isLiked: true, likeCount: 1 });
    expect(unlike.result).toMatchObject({ changed: true, isLiked: false, likeCount: 0 });
    expect(like.count).toBe(4);
    expect(unlike.count).toBe(5);
  });

  it("활성·미알림 좋아요만 해당 댓글 알림 대상으로 한 SQL에서 읽는다", async () => {
    // Given
    const commentId = roots[0];
    if (commentId === undefined) throw new Error("root fixture missing");
    await uow.run(() => repository.setLike(todoId, commentId, userId));
    // When
    const eligible = await measure("pending-like-notification", () =>
      repository.findPendingLikeNotification(todoId, commentId, userId),
    );
    // Then
    expect(eligible.count).toBe(1);
    expect(eligible.result).toEqual({ recipientId: authorId, threadRootId: commentId });
    expect(await repository.findPendingLikeNotification(todoId + 1, commentId, userId)).toBeNull();
    expect(await repository.findPendingLikeNotification(todoId, commentId, authorId)).toBeNull();
    await uow.run(() => repository.markLikeNotified(commentId, userId));
    expect(await repository.findPendingLikeNotification(todoId, commentId, userId)).toBeNull();
    await client.orm.public.TodoCommentLike.where({ commentId, userId }).updateAndCount({
      notifiedAt: null,
      isActive: false,
    });
    expect(await repository.findPendingLikeNotification(todoId, commentId, userId)).toBeNull();
    await client.orm.public.TodoCommentLike.where({ commentId, userId }).updateAndCount({
      isActive: true,
    });
    await client.orm.public.TodoComment.where({ id: commentId }).updateAndCount(
      encodePatch("TodoComment", { deletedAt: AT }),
    );
    expect(await repository.findPendingLikeNotification(todoId, commentId, userId)).toBeNull();
  });

  it("알림 marker의 실제 FK 실패는 알림·outbox·커밋 후 작업을 취소하고 원 좋아요는 보존한다", async () => {
    // Given: 실제 저장소 marker 경계에서만 PostgreSQL FK 실패를 주입한다.
    const commentId = roots[0];
    if (commentId === undefined) throw new Error("root fixture missing");
    const like = context.module.get(LikeTodoComment);
    const txHost =
      context.module.get<TransactionHost<Prisma8TransactionalAdapter>>(TransactionHost);
    const publication = vi.spyOn(context.module.get(PublishPushDeliveryOutbox), "execute");
    const registration = vi.spyOn(context.module.get(PushDeliveryAfterCommitPublisher), "register");
    const cache = context.module.get<NotificationCachePort>(NOTIFICATION_CACHE);
    const invalidation = vi.spyOn(cache, "invalidateUnreadCount");
    let stagedCounts: readonly { readonly count: number }[] = [];
    let markerSqlState: string | undefined;
    vi.spyOn(repository, "markLikeNotified").mockImplementationOnce(async () => {
      stagedCounts = await Promise.all([
        txHost.tx.orm.public.Notification.aggregate((aggregate) => ({ count: aggregate.count() })),
        txHost.tx.orm.public.PushDispatch.aggregate((aggregate) => ({ count: aggregate.count() })),
        txHost.tx.orm.public.PushDispatchOutbox.aggregate((aggregate) => ({
          count: aggregate.count(),
        })),
      ]);
      try {
        await txHost.tx.orm.public.TodoCommentLike.createAndCount([
          encodeCreate("TodoCommentLike", { commentId: createEntityId(), userId, isActive: true }),
        ]);
      } catch (error) {
        markerSqlState = databaseSqlState(error);
        throw error;
      }
    });
    // When
    const first = await like.execute({ todoId, commentId, userId });
    // Then
    expect(markerSqlState).toBe("23503");
    expect(stagedCounts).toEqual([{ count: 1 }, { count: 1 }, { count: 1 }]);
    expect(registration).toHaveBeenCalledTimes(1);
    expect(first).toEqual({ commentId, isLiked: true, likeCount: 1 });
    expect(
      await client.orm.public.TodoCommentLike.where({ commentId, userId }).first(),
    ).toMatchObject({ isActive: true, notifiedAt: null });
    expect(await client.orm.public.TodoComment.where({ id: commentId }).first()).toMatchObject({
      likeCount: 1,
    });
    expect(
      await Promise.all([
        client.orm.public.Notification.aggregate((aggregate) => ({ count: aggregate.count() })),
        client.orm.public.PushDispatch.aggregate((aggregate) => ({ count: aggregate.count() })),
        client.orm.public.PushDispatchOutbox.aggregate((aggregate) => ({
          count: aggregate.count(),
        })),
      ]),
    ).toEqual([{ count: 0 }, { count: 0 }, { count: 0 }]);
    expect(publication).not.toHaveBeenCalled();
    expect(invalidation).not.toHaveBeenCalled();
    // When: 같은 좋아요를 재시도한다.
    const retry = await like.execute({ todoId, commentId, userId });
    await like.execute({ todoId, commentId, userId });
    // Then: 알림은 한 번만 저장·발행한다.
    expect(retry).toEqual(first);
    expect(
      await Promise.all([
        client.orm.public.Notification.aggregate((aggregate) => ({ count: aggregate.count() })),
        client.orm.public.PushDispatch.aggregate((aggregate) => ({ count: aggregate.count() })),
        client.orm.public.PushDispatchOutbox.aggregate((aggregate) => ({
          count: aggregate.count(),
        })),
      ]),
    ).toEqual([{ count: 1 }, { count: 1 }, { count: 1 }]);
    expect(
      await client.orm.public.TodoCommentLike.where({ commentId, userId }).first(),
    ).toMatchObject({ notifiedAt: expect.any(String) });
    expect(publication).toHaveBeenCalledTimes(1);
    expect(invalidation).toHaveBeenCalledTimes(1);
  });
  it("push staging의 실제 FK 실패도 원 좋아요만 남기고 저장 중인 알림을 취소한다", async () => {
    // Given: push staging 포트 경계에서만 실제 FK 실패를 주입한다.
    const commentId = roots[0];
    if (commentId === undefined) throw new Error("root fixture missing");
    const txHost =
      context.module.get<TransactionHost<Prisma8TransactionalAdapter>>(TransactionHost);
    const staging = context.module.get<PushDispatchStagingRepositoryPort>(PUSH_DISPATCH_STAGING);
    const stage = staging.stage.bind(staging);
    const publication = vi.spyOn(context.module.get(PublishPushDeliveryOutbox), "execute");
    let stagedNotificationCount = 0;
    let stagingSqlState: string | undefined;
    vi.spyOn(staging, "stage").mockImplementationOnce(async (input) => {
      const result = await txHost.tx.orm.public.Notification.aggregate((aggregate) => ({
        count: aggregate.count(),
      }));
      stagedNotificationCount = result.count;
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
      await client.orm.public.TodoCommentLike.where({ commentId, userId }).first(),
    ).toMatchObject({ isActive: true, notifiedAt: null });
    expect(
      await Promise.all([
        client.orm.public.Notification.aggregate((a) => ({ count: a.count() })),
        client.orm.public.PushDispatch.aggregate((a) => ({ count: a.count() })),
        client.orm.public.PushDispatchOutbox.aggregate((a) => ({ count: a.count() })),
      ]),
    ).toEqual([{ count: 0 }, { count: 0 }, { count: 0 }]);
    expect(publication).not.toHaveBeenCalled();
  });
  it("좋아요 알림 저장 중 취소 요청은 같은 댓글 잠금을 기다리고 다시 좋아요해도 중복 알림이 없다", async () => {
    // Given: 실제 알림 adapter의 진입만 제어하며 저장·transaction은 그대로 사용한다.
    const commentId = roots[0];
    if (commentId === undefined) throw new Error("root fixture missing");
    const adapter = context.module.get<TodoCommentNotificationPort>(TODO_COMMENT_NOTIFICATION);
    const notify = adapter.notifyCommentLiked.bind(adapter);
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const notification = vi
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
          const rows = await client
            .runtime()
            .query(
              client.raw
                .sql`SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'`
                .returnsRow({ count: "pg/int4@1" })
                .build(),
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
    expect(notification).toHaveBeenCalledTimes(1);
    expect(
      await client.orm.public.TodoComment.where({ id: commentId }).select("likeCount").first(),
    ).toEqual({ likeCount: 1 });
    expect(
      await client.orm.public.TodoCommentLike.where({ commentId, userId }).first(),
    ).toMatchObject({ isActive: true, notifiedAt: expect.any(String) });
    expect(await client.orm.public.Notification.aggregate((a) => ({ count: a.count() }))).toEqual({
      count: 1,
    });
  });

  it("구버전 writer와 unique 경합 후 권한이 사라지면 저장된 댓글 replay도 거부한다", async () => {
    // Given: 구버전 writer는 요청 advisory lock에 참여하지 않는다.
    await client.orm.public.Todo.where({ id: todoId }).updateAndCount({ visibility: "PRIVATE" });
    await client.orm.public.Follow.createAll(
      [
        FollowFixture.create({ followerId: userId, followingId: authorId, status: "ACCEPTED" }),
        FollowFixture.create({ followerId: authorId, followingId: userId, status: "ACCEPTED" }),
      ].map((row) => encodeCreate("Follow", row)),
    );
    const outside = new PrismaTodoCommentRepository(
      createDatabaseTransactionFixture(client).txHost,
    );
    const create = repository.createCommentChain.bind(repository);
    vi.spyOn(repository, "createCommentChain").mockImplementationOnce(async (input) => {
      await outside.createCommentChain(input);
      await client.orm.public.Follow.where({
        followerId: userId,
        followingId: authorId,
      }).deleteAndCount();
      await client.orm.public.Follow.where({
        followerId: authorId,
        followingId: userId,
      }).deleteAndCount();
      return create(input);
    });
    // When / Then
    await expect(
      context.module.get(WriteTodoCommentChain).execute({
        todoId,
        authorId,
        parentId: null,
        items: [{ clientRequestId: randomUUID(), content: "권한이 사라진 댓글" }],
      }),
    ).rejects.toMatchObject({ errorCode: "TODO_0801" });
  });
});
