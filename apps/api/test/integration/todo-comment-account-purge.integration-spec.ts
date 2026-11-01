import { ClsPluginTransactional } from "@nestjs-cls/transactional";
import { TransactionalAdapterDrizzleOrm } from "@nestjs-cls/transactional-adapter-drizzle-orm";
import { type DynamicModule, Module } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { eq, inArray } from "drizzle-orm";
import { ClsModule } from "nestjs-cls";
import { vi } from "vitest";

import { TODO_COMMENT_ACCOUNT_CLEANUP_STORE } from "#api/modules/engagement/application/ports/comments/todo-comment-account-cleanup.store.port";
import {
  TODO_VIEW_CACHE,
  type TodoViewCachePort,
} from "#api/modules/engagement/application/ports/comments/todo-view-cache.port";
import { TodoCommentAccountCleanup } from "#api/modules/engagement/application/services/comments/todo-comment-account-cleanup.service";
import { TODO_COMMENT_ACCOUNT_CLEANUP } from "#api/modules/engagement/engagement-comments.public";
import { DrizzleTodoCommentAccountCleanupStore } from "#api/modules/engagement/infrastructure/persistence/comments/drizzle-todo-comment-account-cleanup.store";
import {
  AUTH_USER_REPOSITORY,
  AUTH_SECURITY_LOG_REPOSITORY,
} from "#api/modules/identity/application/ports/auth/auth-persistence.port";
import { PurgeDeletedAccounts } from "#api/modules/identity/application/use-cases/auth/purge-deleted-accounts.use-case";
import { DrizzleSecurityLogRepository } from "#api/modules/identity/infrastructure/persistence/auth/drizzle-security-log.repository";
import { DrizzleUserRepository } from "#api/modules/identity/infrastructure/persistence/auth/drizzle-user.repository";
import {
  NOTIFICATION_CACHE,
  type NotificationCachePort,
} from "#api/modules/notification/application/ports/delivery/notification-cache.port";
import { NOTIFICATION_REPOSITORY } from "#api/modules/notification/application/ports/delivery/notification.repository.port";
import { DrizzleNotificationRepository } from "#api/modules/notification/infrastructure/persistence/delivery/drizzle-notification.repository";
import { ClsUnitOfWork } from "#api/platform/database/cls-unit-of-work";
import { databaseConstraint, databaseSqlState } from "#api/platform/database/database-error.util";
import { DRIZZLE } from "#api/platform/database/database.client";
import { PostgresMutationLockAdapter } from "#api/platform/database/postgres-mutation-lock.adapter";
import {
  notification as notificationTable,
  todo as todoTable,
  todoCategory,
  todoComment,
  todoCommentLike,
  user as userTable,
} from "#api/platform/database/schema/index";
import { MUTATION_LOCK, UNIT_OF_WORK } from "#api/shared/application/ports/index";
import { DELETED_COMMENT_AUTHOR, DELETED_COMMENT_AUTHOR_ID } from "#api/shared/domain/system-user";
import type { TestDatabaseClient } from "#test/setup/test-database";

import { todoCommentAccountCleanupProvider } from "../../src/modules/engagement/engagement-comments-application.providers.js";
import {
  accountNotificationCleanupProvider,
  accountTodoCommentCleanupProvider,
} from "../../src/modules/identity/identity-auth-account-cleanup.providers.js";
import { purgeDeletedAccountsProvider } from "../../src/modules/identity/identity-auth-application.providers.js";
import { notificationAccountCleanupProvider } from "../../src/modules/notification/notification-delivery-application.providers.js";
import { TestDatabase } from "../setup/test-database.js";

const NOW = new Date("2026-08-26T00:00:00.000Z");
const PURGE_ELIGIBLE_AT = new Date("2026-07-01T00:00:00.000Z");

@Module({})
class AccountPurgeDatabaseTestModule {
  static register(client: TestDatabaseClient): DynamicModule {
    return {
      module: AccountPurgeDatabaseTestModule,
      providers: [{ provide: DRIZZLE, useValue: client }],
      exports: [DRIZZLE],
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

async function createCommentTree(client: TestDatabaseClient): Promise<CommentTreeFixture> {
  const [owner, purgedUser, otherUser] = await client
    .insert(userTable)
    .values([
      {
        id: "account-purge-owner",
        email: "account-purge-owner@example.com",
        userTag: "PURGOWNR",
        status: "ACTIVE",
      },
      {
        id: "account-purge-target",
        email: "account-purge-target@example.com",
        userTag: "PURGTARG",
        status: "SUSPENDED",
        deletedAt: PURGE_ELIGIBLE_AT,
      },
      {
        id: "account-purge-other",
        email: "account-purge-other@example.com",
        userTag: "PURGOTHR",
        status: "ACTIVE",
      },
    ])
    .returning();
  if (owner === undefined || purgedUser === undefined || otherUser === undefined) {
    throw new Error("user fixture was not created");
  }
  const [category] = await client
    .insert(todoCategory)
    .values({ userId: owner.id, name: "Account purge", color: "#112233", sortOrder: 0 })
    .returning();
  if (category === undefined) {
    throw new Error("category fixture was not created");
  }
  const [todo] = await client
    .insert(todoTable)
    .values({
      userId: owner.id,
      categoryId: category.id,
      title: "댓글 사슬을 보존할 할 일",
      startDate: NOW,
      visibility: "PUBLIC",
      commentCount: 4,
    })
    .returning();
  if (todo === undefined) {
    throw new Error("todo fixture was not created");
  }

  const purgedRootId = "purged-root";
  const purgedChildId = "purged-child";
  const activeGrandchildId = "active-grandchild";
  const activeRootId = "active-root";
  await client.insert(todoComment).values([
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
  ]);
  await client.insert(todoCommentLike).values([
    { commentId: purgedRootId, userId: otherUser.id, isActive: true },
    { commentId: activeRootId, userId: purgedUser.id, isActive: true },
  ]);

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
  let client: TestDatabaseClient;
  let module: TestingModule;
  let purgeDeletedAccounts: PurgeDeletedAccounts;
  let notificationCache: NotificationCachePort;
  let todoViewCache: TodoViewCachePort;

  beforeAll(async () => {
    testDatabase = new TestDatabase();
    client = await testDatabase.start();
    notificationCache = {
      wrapUnreadCount: vi.fn(),
      invalidateUnreadCount: vi.fn(),
      invalidatePushTokens: vi.fn(),
      invalidateUserPreference: vi.fn(),
    };
    todoViewCache = { invalidateForTodo: vi.fn() };
    const databaseModule = AccountPurgeDatabaseTestModule.register(client);
    module = await Test.createTestingModule({
      imports: [
        databaseModule,
        ClsModule.forRoot({
          global: true,
          plugins: [
            new ClsPluginTransactional({
              imports: [databaseModule],
              adapter: new TransactionalAdapterDrizzleOrm({ drizzleInstanceToken: DRIZZLE }),
            }),
          ],
        }),
      ],
      providers: [
        ClsUnitOfWork,
        { provide: UNIT_OF_WORK, useExisting: ClsUnitOfWork },
        PostgresMutationLockAdapter,
        { provide: MUTATION_LOCK, useExisting: PostgresMutationLockAdapter },
        DrizzleTodoCommentAccountCleanupStore,
        {
          provide: TODO_COMMENT_ACCOUNT_CLEANUP_STORE,
          useExisting: DrizzleTodoCommentAccountCleanupStore,
        },
        todoCommentAccountCleanupProvider,
        { provide: TODO_COMMENT_ACCOUNT_CLEANUP, useExisting: TodoCommentAccountCleanup },
        DrizzleNotificationRepository,
        { provide: NOTIFICATION_REPOSITORY, useExisting: DrizzleNotificationRepository },
        notificationAccountCleanupProvider,
        { provide: NOTIFICATION_CACHE, useValue: notificationCache },
        { provide: TODO_VIEW_CACHE, useValue: todoViewCache },
        DrizzleUserRepository,
        DrizzleSecurityLogRepository,
        { provide: AUTH_USER_REPOSITORY, useExisting: DrizzleUserRepository },
        { provide: AUTH_SECURITY_LOG_REPOSITORY, useExisting: DrizzleSecurityLogRepository },
        accountNotificationCleanupProvider,
        accountTodoCommentCleanupProvider,
        purgeDeletedAccountsProvider,
      ],
    }).compile();
    await module.init();
    purgeDeletedAccounts = module.get(PurgeDeletedAccounts);
  }, 60_000);

  beforeEach(async () => {
    vi.clearAllMocks();
    await testDatabase.cleanup();
    await client.insert(userTable).values({
      id: DELETED_COMMENT_AUTHOR_ID,
      email: DELETED_COMMENT_AUTHOR.email,
      userTag: DELETED_COMMENT_AUTHOR.userTag,
      status: "LOCKED",
    });
  });

  afterAll(async () => {
    await module?.close();
    await testDatabase?.stop();
  });

  it("purge 전에 정리 단계를 빼면 RESTRICT 외래 키가 댓글 사슬 유실을 막는다", async () => {
    // Given
    const fixture = await createCommentTree(client);

    // When
    const deletion = client.delete(userTable).where(eq(userTable.id, fixture.purgedUserId));

    // Then
    const failure = await deletion.then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(databaseSqlState(failure)).toBe("23503");
    expect(databaseConstraint(failure)).toBe("TodoComment_authorId_fkey");
    expect(await client.$count(todoComment, eq(todoComment.todoId, fixture.todoId))).toBe(4);
  });

  it("정리 마지막의 작성자 재귀속이 막히면 앞선 묘비화와 카운터 변경도 함께 롤백한다", async () => {
    // Given
    const fixture = await createCommentTree(client);
    const [notification] = await client
      .insert(notificationTable)
      .values({
        userId: fixture.otherUserId,
        type: "TODO_SHARED",
        title: "새 댓글",
        body: "보낸 사람 정보",
        metadata: {
          senderId: fixture.purgedUserId,
          commentId: fixture.purgedRootId,
          activityKind: "COMMENT",
        },
      })
      .returning();
    if (notification === undefined) {
      throw new Error("notification fixture was not created");
    }
    await client.delete(userTable).where(eq(userTable.id, DELETED_COMMENT_AUTHOR_ID));

    // When
    await purgeDeletedAccounts.execute();

    // Then
    expect(
      await client.query.user.findFirst({ where: { id: fixture.purgedUserId } }),
    ).toBeDefined();
    expect(
      await client.query.todoComment.findFirst({ where: { id: fixture.purgedRootId } }),
    ).toMatchObject({
      authorId: fixture.purgedUserId,
      content: "삭제될 루트",
      deletedAt: null,
      likeCount: 1,
    });
    expect(await client.query.todo.findFirst({ where: { id: fixture.todoId } })).toMatchObject({
      commentCount: 4,
    });
    expect(
      await client.query.notification.findFirst({ where: { id: notification.id } }),
    ).toBeDefined();
    expect(vi.mocked(notificationCache.invalidateUnreadCount)).not.toHaveBeenCalled();
  });

  it("서로 다른 사용자의 같은 멱등 키는 작성자를 삭제 사용자로 바꾸기 전에 다시 키워 충돌하지 않는다", async () => {
    // Given
    const [owner] = await client
      .insert(userTable)
      .values({
        id: "collision-owner",
        email: "collision-owner@example.com",
        userTag: "COLLOWNR",
        status: "ACTIVE",
      })
      .returning();
    const deletedUsers = await client
      .insert(userTable)
      .values(
        ["A", "B"].map((suffix) => ({
          id: `collision-user-${suffix}`,
          email: `collision-user-${suffix}@example.com`,
          userTag: `COLLUSR${suffix}`,
          status: "SUSPENDED" as const,
          deletedAt: PURGE_ELIGIBLE_AT,
        })),
      )
      .returning();
    if (owner === undefined) {
      throw new Error("owner fixture was not created");
    }
    const [category] = await client
      .insert(todoCategory)
      .values({ userId: owner.id, name: "Collision", color: "#123456" })
      .returning();
    if (category === undefined) {
      throw new Error("category fixture was not created");
    }
    const [todo] = await client
      .insert(todoTable)
      .values({
        userId: owner.id,
        categoryId: category.id,
        title: "같은 멱등 키",
        startDate: NOW,
        commentCount: 2,
      })
      .returning();
    if (todo === undefined) {
      throw new Error("todo fixture was not created");
    }
    const sharedRequestId = "00000000-0000-4000-8000-000000000099";
    await client.insert(todoComment).values(
      deletedUsers.map((user, index) => ({
        id: `collision-comment-${index}`,
        todoId: todo.id,
        authorId: user.id,
        clientRequestId: sharedRequestId,
        requestFingerprint: "a".repeat(64),
        content: `댓글 ${index}`,
      })),
    );

    // When
    await purgeDeletedAccounts.execute();

    // Then
    const comments = await client.query.todoComment.findMany({
      where: { todoId: todo.id },
      orderBy: { id: "asc" },
    });
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
    expect(
      await client.$count(
        userTable,
        inArray(
          userTable.id,
          deletedUsers.map((user) => user.id),
        ),
      ),
    ).toBe(0);
  });

  it("작성한 댓글은 묘비로 보존하고 좋아요와 모든 카운터를 정산한 뒤 계정을 지운다", async () => {
    // Given
    const fixture = await createCommentTree(client);
    await client.insert(notificationTable).values([
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
    ]);

    // When
    await purgeDeletedAccounts.execute();

    // Then
    expect(
      await client.query.user.findFirst({ where: { id: fixture.purgedUserId } }),
    ).toBeUndefined();
    expect(
      await client.query.user.findFirst({
        where: { id: DELETED_COMMENT_AUTHOR_ID },
        with: { accounts: true },
      }),
    ).toMatchObject({ status: "LOCKED", deletedAt: null, accounts: [] });
    const comments = await client.query.todoComment.findMany({
      where: { todoId: fixture.todoId },
      orderBy: { depth: "asc" },
    });
    const rollbackCompatibleComments = await client.query.todoComment.findMany({
      where: { id: { in: [fixture.purgedRootId, fixture.purgedChildId] } },
      with: { author: { with: { profile: true } } },
    });
    expect(rollbackCompatibleComments).toHaveLength(2);
    expect(
      rollbackCompatibleComments.every(
        (comment) => comment.author.id === DELETED_COMMENT_AUTHOR_ID,
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
    expect(await client.query.todo.findFirst({ where: { id: fixture.todoId } })).toMatchObject({
      commentCount: 2,
    });
    expect(
      await client.query.todoCommentLike.findFirst({
        where: { commentId: fixture.activeRootId, userId: fixture.purgedUserId },
      }),
    ).toBeUndefined();
    expect(
      await client.query.todoCommentLike.findFirst({
        where: { commentId: fixture.purgedRootId, userId: fixture.otherUserId },
      }),
    ).toMatchObject({ isActive: false });
    expect(vi.mocked(todoViewCache.invalidateForTodo)).toHaveBeenCalledWith(fixture.todoId);
    expect(
      await client.query.notification.findMany({ where: { userId: fixture.otherUserId } }),
    ).toEqual([expect.objectContaining({ type: "SYSTEM_NOTICE", body: "계정과 관계없는 내용" })]);
    expect(vi.mocked(notificationCache.invalidateUnreadCount)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(notificationCache.invalidateUnreadCount)).toHaveBeenCalledWith(
      fixture.otherUserId,
    );
    const hardDeleted = await client.query.securityLog.findFirst({
      where: { event: "ACCOUNT_HARD_DELETED" },
    });
    expect(hardDeleted?.metadata).toMatchObject({ purgedUserId: fixture.purgedUserId });
  });
});
