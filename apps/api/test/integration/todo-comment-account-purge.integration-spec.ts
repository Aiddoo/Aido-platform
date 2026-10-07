import { ClsPluginTransactional } from "@nestjs-cls/transactional";
import { type DynamicModule, Module } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { and } from "@prisma/orm-postgres/orm-client";
import { ClsModule } from "nestjs-cls";
import { vi } from "vitest";

import { SecurityLogRepository } from "#api/auth/infrastructure/persistence/security-log.repository";
import { UserRepository } from "#api/auth/infrastructure/persistence/user.repository";
import { AccountPurgeProcessor } from "#api/auth/infrastructure/queue/account-purge.processor";
import { AccountPurgeJob } from "#api/auth/infrastructure/scheduler/account-purge.job";
import {
  NOTIFICATION_CACHE,
  type NotificationCachePort,
} from "#api/notification/application/ports/notification-cache.port";
import { NOTIFICATION_REPOSITORY } from "#api/notification/application/ports/notification.repository.port";
import { NotificationAccountCleanup } from "#api/notification/index";
import { PrismaNotificationRepository } from "#api/notification/infrastructure/persistence/prisma-notification.repository";
import { MUTATION_LOCK, UNIT_OF_WORK } from "#api/shared/application/ports/index";
import { JOB_RUNTIME } from "#api/shared/application/ports/job-runtime.port";
import { DELETED_COMMENT_AUTHOR, DELETED_COMMENT_AUTHOR_ID } from "#api/shared/domain/system-user";
import { ClsUnitOfWork } from "#api/shared/infrastructure/database/cls-unit-of-work";
import { decodeRecord, encodeCreate } from "#api/shared/infrastructure/database/database-records";
import { DatabaseService } from "#api/shared/infrastructure/database/database.service";
import { PostgresMutationLockAdapter } from "#api/shared/infrastructure/database/postgres-mutation-lock.adapter";
import { requireRecord } from "#api/shared/infrastructure/database/prisma-error.util";
import { Prisma8TransactionalAdapter } from "#api/shared/infrastructure/database/prisma8-transactional.adapter";
import { TODO_COMMENT_ACCOUNT_CLEANUP_STORE } from "#api/todo-comment/application/ports/todo-comment-account-cleanup.store.port";
import {
  TODO_VIEW_CACHE,
  type TodoViewCachePort,
} from "#api/todo-comment/application/ports/todo-view-cache.port";
import { TodoCommentAccountCleanup } from "#api/todo-comment/application/services/todo-comment-account-cleanup";
import { PrismaTodoCommentAccountCleanupStore } from "#api/todo-comment/infrastructure/persistence/prisma-todo-comment-account-cleanup.store";
import { createTestDatabaseService } from "#test/setup/database-context";
import type { TestDatabaseClient } from "#test/setup/test-database";

import { FakeJobRuntime } from "../mocks/fake-job-runtime.js";
import { TestDatabase } from "../setup/test-database.js";

const NOW = new Date("2026-08-26T00:00:00.000Z");
const PURGE_ELIGIBLE_AT = new Date("2026-07-01T00:00:00.000Z");

@Module({})
class AccountPurgeDatabaseTestModule {
  static register(prisma: TestDatabaseClient): DynamicModule {
    return {
      module: AccountPurgeDatabaseTestModule,
      providers: [{ provide: DatabaseService, useValue: createTestDatabaseService(prisma) }],
      exports: [DatabaseService],
    };
  }
}

interface CommentTreeFixture {
  purgedUserId: string;
  otherUserId: string;
  todoId: number;
  purgedRootId: string;
  purgedChildId: string;
  activeGrandchildId: string;
  activeRootId: string;
}

async function createCommentTree(prisma: TestDatabaseClient): Promise<CommentTreeFixture> {
  const owner = decodeRecord(
    "User",
    await prisma.orm.public.User.create(
      encodeCreate("User", {
        id: "account-purge-owner",
        email: "account-purge-owner@example.com",
        userTag: "PURGOWNR",
        status: "ACTIVE",
      }),
    ),
  );
  const purgedUser = decodeRecord(
    "User",
    await prisma.orm.public.User.create(
      encodeCreate("User", {
        id: "account-purge-target",
        email: "account-purge-target@example.com",
        userTag: "PURGTARG",
        status: "SUSPENDED",
        deletedAt: PURGE_ELIGIBLE_AT,
      }),
    ),
  );
  const otherUser = decodeRecord(
    "User",
    await prisma.orm.public.User.create(
      encodeCreate("User", {
        id: "account-purge-other",
        email: "account-purge-other@example.com",
        userTag: "PURGOTHR",
        status: "ACTIVE",
      }),
    ),
  );
  const category = decodeRecord(
    "TodoCategory",
    await prisma.orm.public.TodoCategory.create(
      encodeCreate("TodoCategory", {
        userId: owner.id,
        name: "Account purge",
        color: "#112233",
        sortOrder: 0,
      }),
    ),
  );
  const todo = decodeRecord(
    "Todo",
    await prisma.orm.public.Todo.create(
      encodeCreate("Todo", {
        userId: owner.id,
        categoryId: category.id,
        title: "댓글 사슬을 보존할 할 일",
        startDate: NOW,
        visibility: "PUBLIC",
        commentCount: 4,
      }),
    ),
  );

  const purgedRootId = "purged-root";
  const purgedChildId = "purged-child";
  const activeGrandchildId = "active-grandchild";
  const activeRootId = "active-root";
  await prisma.orm.public.TodoComment.createAndCount(
    [
      {
        id: purgedRootId,
        todoId: todo.id,
        authorId: purgedUser.id,
        parentId: null,
        rootId: null,
        path: [],
        depth: 0,
        clientRequestId: "00000000-0000-4000-8000-000000000001",
        content: "삭제될 루트",
        likeCount: 1,
        replyCount: 1,
      },
      {
        id: purgedChildId,
        todoId: todo.id,
        authorId: purgedUser.id,
        parentId: purgedRootId,
        rootId: purgedRootId,
        path: [purgedRootId],
        depth: 1,
        clientRequestId: "00000000-0000-4000-8000-000000000002",
        content: "삭제될 중간 답글",
        replyCount: 1,
      },
      {
        id: activeGrandchildId,
        todoId: todo.id,
        authorId: otherUser.id,
        parentId: purgedChildId,
        rootId: purgedRootId,
        path: [purgedRootId, purgedChildId],
        depth: 2,
        clientRequestId: "00000000-0000-4000-8000-000000000003",
        content: "보존할 후속 답글",
      },
      {
        id: activeRootId,
        todoId: todo.id,
        authorId: otherUser.id,
        parentId: null,
        rootId: null,
        path: [],
        depth: 0,
        clientRequestId: "00000000-0000-4000-8000-000000000004",
        content: "다른 사용자의 루트",
        likeCount: 1,
      },
    ].map((value) => encodeCreate("TodoComment", value)),
  );
  await prisma.orm.public.TodoCommentLike.createAndCount(
    [
      { commentId: purgedRootId, userId: otherUser.id, isActive: true },
      { commentId: activeRootId, userId: purgedUser.id, isActive: true },
    ].map((value) => encodeCreate("TodoCommentLike", value)),
  );

  return {
    purgedUserId: purgedUser.id,
    otherUserId: otherUser.id,
    todoId: todo.id,
    purgedRootId,
    purgedChildId,
    activeGrandchildId,
    activeRootId,
  };
}

describe("댓글 계정 purge (실제 PostgreSQL)", () => {
  let testDatabase: TestDatabase;
  let prisma: TestDatabaseClient;
  let module: TestingModule;
  let purgeJob: AccountPurgeJob;
  let notificationCache: NotificationCachePort;
  let todoViewCache: TodoViewCachePort;

  beforeAll(async () => {
    testDatabase = new TestDatabase();
    prisma = await testDatabase.start();
    notificationCache = {
      wrapUnreadCount: vi.fn(),
      invalidateUnreadCount: vi.fn(),
      invalidatePushTokens: vi.fn(),
      invalidateUserPreference: vi.fn(),
    };
    todoViewCache = { invalidateForTodo: vi.fn() };
    const databaseModule = AccountPurgeDatabaseTestModule.register(prisma);
    module = await Test.createTestingModule({
      imports: [
        databaseModule,
        ClsModule.forRoot({
          global: true,
          plugins: [
            new ClsPluginTransactional({
              imports: [databaseModule],
              adapter: new Prisma8TransactionalAdapter(),
            }),
          ],
        }),
      ],
      providers: [
        ClsUnitOfWork,
        { provide: UNIT_OF_WORK, useExisting: ClsUnitOfWork },
        PostgresMutationLockAdapter,
        { provide: MUTATION_LOCK, useExisting: PostgresMutationLockAdapter },
        PrismaTodoCommentAccountCleanupStore,
        {
          provide: TODO_COMMENT_ACCOUNT_CLEANUP_STORE,
          useExisting: PrismaTodoCommentAccountCleanupStore,
        },
        TodoCommentAccountCleanup,
        PrismaNotificationRepository,
        { provide: NOTIFICATION_REPOSITORY, useExisting: PrismaNotificationRepository },
        NotificationAccountCleanup,
        { provide: NOTIFICATION_CACHE, useValue: notificationCache },
        { provide: TODO_VIEW_CACHE, useValue: todoViewCache },
        UserRepository,
        SecurityLogRepository,
        AccountPurgeJob,
        { provide: JOB_RUNTIME, useValue: new FakeJobRuntime() },
        {
          provide: AccountPurgeProcessor,
          useValue: { setPurgeJob: vi.fn() },
        },
      ],
    }).compile();
    await module.init();
    purgeJob = module.get(AccountPurgeJob);
  }, 60_000);

  beforeEach(async () => {
    vi.clearAllMocks();
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
  });

  afterAll(async () => {
    await module?.close();
    await testDatabase?.stop();
  });

  it("purge 전에 cleanup을 빼면 RESTRICT FK가 댓글 사슬 유실을 막는다", async () => {
    // Given
    const fixture = await createCommentTree(prisma);

    // When / Then
    await expect(
      prisma.orm.public.User.where((row) => row.id.eq(fixture.purgedUserId))
        .delete()
        .then((row) => decodeRecord("User", requireRecord(row))),
    ).rejects.toMatchObject({
      kind: "sql_query",
      sqlState: "23503",
      constraint: "TodoComment_authorId_fkey",
    });
    await expect(
      prisma.orm.public.TodoComment.where((row) => row.todoId.eq(fixture.todoId))
        .aggregate((aggregate) => ({ count: aggregate.count() }))
        .then(({ count }) => count),
    ).resolves.toBe(4);
  });

  it("cleanup 마지막 재귀속이 막히면 앞선 묘비화와 counter 변경도 함께 rollback한다", async () => {
    const fixture = await createCommentTree(prisma);
    const notification = decodeRecord(
      "Notification",
      await prisma.orm.public.Notification.create(
        encodeCreate("Notification", {
          userId: fixture.otherUserId,
          type: "TODO_SHARED",
          title: "새 댓글",
          body: "보낸 사람 정보",
          metadata: {
            senderId: fixture.purgedUserId,
            commentId: fixture.purgedRootId,
            activityKind: "COMMENT",
          },
        }),
      ),
    );
    decodeRecord(
      "User",
      requireRecord(
        await prisma.orm.public.User.where((row) => row.id.eq(DELETED_COMMENT_AUTHOR_ID)).delete(),
      ),
    );

    await purgeJob.purgeDeletedAccounts();

    await expect(
      prisma.orm.public.User.where((row) => row.id.eq(fixture.purgedUserId))
        .first()
        .then((row) => decodeRecord("User", row)),
    ).resolves.not.toBeNull();
    await expect(
      prisma.orm.public.TodoComment.where((row) => row.id.eq(fixture.purgedRootId))
        .first()
        .then((row) => decodeRecord("TodoComment", row)),
    ).resolves.toMatchObject({
      authorId: fixture.purgedUserId,
      content: "삭제될 루트",
      deletedAt: null,
      likeCount: 1,
    });
    await expect(
      prisma.orm.public.Todo.where((row) => row.id.eq(fixture.todoId))
        .first()
        .then((row) => decodeRecord("Todo", row)),
    ).resolves.toMatchObject({
      commentCount: 4,
    });
    await expect(
      prisma.orm.public.Notification.where((row) => row.id.eq(notification.id))
        .first()
        .then((row) => decodeRecord("Notification", row)),
    ).resolves.not.toBeNull();
    expect(vi.mocked(notificationCache.invalidateUnreadCount)).not.toHaveBeenCalled();
  });

  it("서로 다른 사용자의 같은 멱등 키는 sentinel 재귀속 전에 다시 키워 충돌하지 않는다", async () => {
    const owner = decodeRecord(
      "User",
      await prisma.orm.public.User.create(
        encodeCreate("User", {
          id: "collision-owner",
          email: "collision-owner@example.com",
          userTag: "COLLOWNR",
          status: "ACTIVE",
        }),
      ),
    );
    const deletedUsers = await Promise.all(
      ["A", "B"].map((suffix) =>
        prisma.orm.public.User.create(
          encodeCreate("User", {
            id: `collision-user-${suffix}`,
            email: `collision-user-${suffix}@example.com`,
            userTag: `COLLUSR${suffix}`,
            status: "SUSPENDED",
            deletedAt: PURGE_ELIGIBLE_AT,
          }),
        ).then((row) => decodeRecord("User", row)),
      ),
    );
    const category = decodeRecord(
      "TodoCategory",
      await prisma.orm.public.TodoCategory.create(
        encodeCreate("TodoCategory", { userId: owner.id, name: "Collision", color: "#123456" }),
      ),
    );
    const todo = decodeRecord(
      "Todo",
      await prisma.orm.public.Todo.create(
        encodeCreate("Todo", {
          userId: owner.id,
          categoryId: category.id,
          title: "같은 멱등 키",
          startDate: NOW,
          commentCount: 2,
        }),
      ),
    );
    const sharedRequestId = "00000000-0000-4000-8000-000000000099";
    await prisma.orm.public.TodoComment.createAndCount(
      deletedUsers
        .map((user, index) => ({
          id: `collision-comment-${index}`,
          todoId: todo.id,
          authorId: user.id,
          clientRequestId: sharedRequestId,
          requestFingerprint: "a".repeat(64),
          content: `댓글 ${index}`,
        }))
        .map((value) => encodeCreate("TodoComment", value)),
    );

    await purgeJob.purgeDeletedAccounts();

    const comments = decodeRecord(
      "TodoComment",
      await prisma.orm.public.TodoComment.where((row) => row.todoId.eq(todo.id))
        .orderBy((row) => row.id.asc())
        .all(),
    );
    expect(comments).toHaveLength(2);
    expect(new Set(comments.map((comment) => comment.clientRequestId)).size).toBe(2);
    expect(comments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          authorId: DELETED_COMMENT_AUTHOR_ID,
          requestFingerprint: null,
          content: null,
        }),
      ]),
    );
    await expect(
      prisma.orm.public.User.where((row) => row.id.in(deletedUsers.map((user) => user.id)))
        .aggregate((aggregate) => ({ count: aggregate.count() }))
        .then(({ count }) => count),
    ).resolves.toBe(0);
  });

  it("작성 댓글은 묘비로 보존하고 likes와 모든 counter를 정산한 뒤 계정을 지운다", async () => {
    // Given
    const fixture = await createCommentTree(prisma);
    await prisma.orm.public.Notification.createAndCount(
      (
        [
          {
            userId: fixture.otherUserId,
            type: "TODO_SHARED",
            title: "새 댓글",
            body: "삭제 예정 사용자의 이름이 복사된 알림",
            actionType: "DEEP_LINK",
            metadata: {
              senderId: fixture.purgedUserId,
              commentId: fixture.purgedRootId,
              activityKind: "COMMENT",
            },
          },
          {
            userId: fixture.otherUserId,
            type: "FOLLOW_NEW",
            title: "친구 요청",
            body: "삭제 예정 사용자의 이름이 복사된 알림",
            friendId: fixture.purgedUserId,
          },
          {
            userId: fixture.otherUserId,
            type: "SYSTEM_NOTICE",
            title: "보존할 알림",
            body: "계정과 관계없는 내용",
          },
        ] satisfies Parameters<typeof encodeCreate<"Notification">>[1][]
      ).map((value) => encodeCreate("Notification", value)),
    );

    // When
    await purgeJob.purgeDeletedAccounts();

    // Then - 계정은 삭제되지만 다른 사용자의 descendant와 대화 rail은 남는다
    await expect(
      prisma.orm.public.User.where((row) => row.id.eq(fixture.purgedUserId))
        .first()
        .then((row) => decodeRecord("User", row)),
    ).resolves.toBeNull();
    await expect(
      prisma.orm.public.User.where((row) => row.id.eq(DELETED_COMMENT_AUTHOR_ID))
        .include("accounts")
        .first()
        .then((row) => decodeRecord("User", row)),
    ).resolves.toMatchObject({
      status: "LOCKED",
      deletedAt: null,
      accounts: [],
    });
    const comments = decodeRecord(
      "TodoComment",
      await prisma.orm.public.TodoComment.where((row) => row.todoId.eq(fixture.todoId))
        .orderBy((row) => row.depth.asc())
        .all(),
    );
    const rollbackCompatibleComments = decodeRecord(
      "TodoComment",
      await prisma.orm.public.TodoComment.where((row) =>
        row.id.in([fixture.purgedRootId, fixture.purgedChildId]),
      )
        .include("author", (related) => related.include("profile"))
        .all(),
    );
    expect(rollbackCompatibleComments).toHaveLength(2);
    expect(
      rollbackCompatibleComments.every(
        (comment) => requireRecord(comment.author).id === DELETED_COMMENT_AUTHOR_ID,
      ),
    ).toBe(true);
    expect(comments).toHaveLength(4);
    expect(comments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: fixture.purgedRootId,
          authorId: DELETED_COMMENT_AUTHOR_ID,
          content: null,
          deletedAt: expect.any(Date),
          likeCount: 0,
          replyCount: 1,
        }),
        expect.objectContaining({
          id: fixture.purgedChildId,
          authorId: DELETED_COMMENT_AUTHOR_ID,
          content: null,
          deletedAt: expect.any(Date),
          replyCount: 1,
        }),
        expect.objectContaining({
          id: fixture.activeGrandchildId,
          authorId: fixture.otherUserId,
          content: "보존할 후속 답글",
        }),
        expect.objectContaining({
          id: fixture.activeRootId,
          authorId: fixture.otherUserId,
          likeCount: 0,
        }),
      ]),
    );

    const todo = decodeRecord(
      "Todo",
      requireRecord(await prisma.orm.public.Todo.where((row) => row.id.eq(fixture.todoId)).first()),
    );
    expect(todo.commentCount).toBe(2);
    await expect(
      prisma.orm.public.TodoCommentLike.where((row) =>
        and(row.commentId.eq(fixture.activeRootId), row.userId.eq(fixture.purgedUserId)),
      )
        .first()
        .then((row) => decodeRecord("TodoCommentLike", row)),
    ).resolves.toBeNull();
    await expect(
      prisma.orm.public.TodoCommentLike.where((row) =>
        and(row.commentId.eq(fixture.purgedRootId), row.userId.eq(fixture.otherUserId)),
      )
        .first()
        .then((row) => decodeRecord("TodoCommentLike", row)),
    ).resolves.toMatchObject({ isActive: false });
    expect(vi.mocked(todoViewCache.invalidateForTodo)).toHaveBeenCalledWith(fixture.todoId);
    await expect(
      prisma.orm.public.Notification.where((row) => row.userId.eq(fixture.otherUserId))
        .all()
        .then((row) => decodeRecord("Notification", row)),
    ).resolves.toEqual([
      expect.objectContaining({ type: "SYSTEM_NOTICE", body: "계정과 관계없는 내용" }),
    ]);
    expect(vi.mocked(notificationCache.invalidateUnreadCount)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(notificationCache.invalidateUnreadCount)).toHaveBeenCalledWith(
      fixture.otherUserId,
    );

    const securityLog = decodeRecord(
      "SecurityLog",
      await prisma.orm.public.SecurityLog.where((row) =>
        row.event.eq("ACCOUNT_HARD_DELETED"),
      ).first(),
    );
    expect(securityLog?.metadata).toMatchObject({ purgedUserId: fixture.purgedUserId });
  });
});
