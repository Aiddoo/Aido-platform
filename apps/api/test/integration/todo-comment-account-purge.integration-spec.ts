import { ClsPluginTransactional } from "@nestjs-cls/transactional";
import { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { type DynamicModule, Module } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { ClsModule } from "nestjs-cls";

import { SecurityLogRepository } from "@/auth/infrastructure/persistence/security-log.repository";
import { UserRepository } from "@/auth/infrastructure/persistence/user.repository";
import { AccountPurgeProcessor } from "@/auth/infrastructure/queue/account-purge.processor";
import { AccountPurgeJob } from "@/auth/infrastructure/scheduler/account-purge.job";
import type { PrismaClient } from "@/generated/prisma/client";
import { NOTIFICATION_REPOSITORY, NotificationAccountCleanup } from "@/notification";
import {
	NOTIFICATION_CACHE,
	type NotificationCachePort,
} from "@/notification/application/ports/notification-cache.port";
import { NotificationRepository } from "@/notification/infrastructure/persistence/notification.repository";
import { MUTATION_LOCK, UNIT_OF_WORK } from "@/shared/application/ports";
import { JOB_RUNTIME } from "@/shared/application/ports/job-runtime.port";
import { DELETED_COMMENT_AUTHOR, DELETED_COMMENT_AUTHOR_ID } from "@/shared/domain/system-user";
import { ClsUnitOfWork } from "@/shared/infrastructure/database/cls-unit-of-work";
import { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { PostgresMutationLockAdapter } from "@/shared/infrastructure/database/postgres-mutation-lock.adapter";
import { TODO_COMMENT_ACCOUNT_CLEANUP_STORE } from "@/todo-comment/application/ports/todo-comment-account-cleanup.store.port";
import {
	TODO_VIEW_CACHE,
	type TodoViewCachePort,
} from "@/todo-comment/application/ports/todo-view-cache.port";
import { TodoCommentAccountCleanup } from "@/todo-comment/application/services/todo-comment-account-cleanup";
import { PrismaTodoCommentAccountCleanupStore } from "@/todo-comment/infrastructure/persistence/prisma-todo-comment-account-cleanup.store";

import { FakeJobRuntime } from "../mocks/fake-job-runtime";
import { TestDatabase } from "../setup/test-database";

const NOW = new Date("2026-08-26T00:00:00.000Z");
const PURGE_ELIGIBLE_AT = new Date("2026-07-01T00:00:00.000Z");

@Module({})
class AccountPurgeDatabaseTestModule {
	static register(prisma: PrismaClient): DynamicModule {
		return {
			module: AccountPurgeDatabaseTestModule,
			providers: [{ provide: DatabaseService, useValue: prisma }],
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

async function createCommentTree(prisma: PrismaClient): Promise<CommentTreeFixture> {
	const owner = await prisma.user.create({
		data: {
			id: "account-purge-owner",
			email: "account-purge-owner@example.com",
			userTag: "PURGOWNR",
			status: "ACTIVE",
		},
	});
	const purgedUser = await prisma.user.create({
		data: {
			id: "account-purge-target",
			email: "account-purge-target@example.com",
			userTag: "PURGTARG",
			status: "SUSPENDED",
			deletedAt: PURGE_ELIGIBLE_AT,
		},
	});
	const otherUser = await prisma.user.create({
		data: {
			id: "account-purge-other",
			email: "account-purge-other@example.com",
			userTag: "PURGOTHR",
			status: "ACTIVE",
		},
	});
	const category = await prisma.todoCategory.create({
		data: {
			userId: owner.id,
			name: "Account purge",
			color: "#112233",
			sortOrder: 0,
		},
	});
	const todo = await prisma.todo.create({
		data: {
			userId: owner.id,
			categoryId: category.id,
			title: "댓글 사슬을 보존할 할 일",
			startDate: NOW,
			visibility: "PUBLIC",
			commentCount: 4,
		},
	});

	const purgedRootId = "purged-root";
	const purgedChildId = "purged-child";
	const activeGrandchildId = "active-grandchild";
	const activeRootId = "active-root";
	await prisma.todoComment.createMany({
		data: [
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
		],
	});
	await prisma.todoCommentLike.createMany({
		data: [
			{ commentId: purgedRootId, userId: otherUser.id, isActive: true },
			{ commentId: activeRootId, userId: purgedUser.id, isActive: true },
		],
	});

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
	let prisma: PrismaClient;
	let module: TestingModule;
	let purgeJob: AccountPurgeJob;
	let notificationCache: NotificationCachePort;
	let todoViewCache: TodoViewCachePort;

	beforeAll(async () => {
		testDatabase = new TestDatabase();
		prisma = await testDatabase.start();
		notificationCache = {
			wrapUnreadCount: jest.fn(),
			invalidateUnreadCount: jest.fn(),
			invalidatePushTokens: jest.fn(),
			invalidateUserPreference: jest.fn(),
		};
		todoViewCache = { invalidateForTodo: jest.fn() };
		const databaseModule = AccountPurgeDatabaseTestModule.register(prisma);
		module = await Test.createTestingModule({
			imports: [
				databaseModule,
				ClsModule.forRoot({
					global: true,
					plugins: [
						new ClsPluginTransactional({
							imports: [databaseModule],
							adapter: new TransactionalAdapterPrisma<DatabaseService>({
								prismaInjectionToken: DatabaseService,
							}),
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
				NotificationRepository,
				{ provide: NOTIFICATION_REPOSITORY, useExisting: NotificationRepository },
				NotificationAccountCleanup,
				{ provide: NOTIFICATION_CACHE, useValue: notificationCache },
				{ provide: TODO_VIEW_CACHE, useValue: todoViewCache },
				UserRepository,
				SecurityLogRepository,
				AccountPurgeJob,
				{ provide: JOB_RUNTIME, useValue: new FakeJobRuntime() },
				{
					provide: AccountPurgeProcessor,
					useValue: { setPurgeJob: jest.fn() },
				},
			],
		}).compile();
		await module.init();
		purgeJob = module.get(AccountPurgeJob);
	}, 60_000);

	beforeEach(async () => {
		jest.clearAllMocks();
		await testDatabase.cleanup();
		await prisma.user.create({
			data: {
				id: DELETED_COMMENT_AUTHOR_ID,
				email: DELETED_COMMENT_AUTHOR.email,
				userTag: DELETED_COMMENT_AUTHOR.userTag,
				status: "LOCKED",
			},
		});
	});

	afterAll(async () => {
		await module?.close();
		await testDatabase?.stop();
	});

	it("purge 전에 cleanup을 빼면 RESTRICT FK가 댓글 사슬 유실을 막는다", async () => {
		// Given
		const fixture = await createCommentTree(prisma);

		// When / Then
		await expect(prisma.user.delete({ where: { id: fixture.purgedUserId } })).rejects.toMatchObject(
			{
				code: "P2003",
			},
		);
		await expect(prisma.todoComment.count({ where: { todoId: fixture.todoId } })).resolves.toBe(4);
	});

	it("cleanup 마지막 재귀속이 막히면 앞선 묘비화와 counter 변경도 함께 rollback한다", async () => {
		const fixture = await createCommentTree(prisma);
		const notification = await prisma.notification.create({
			data: {
				userId: fixture.otherUserId,
				type: "TODO_SHARED",
				title: "새 댓글",
				body: "보낸 사람 정보",
				metadata: {
					senderId: fixture.purgedUserId,
					commentId: fixture.purgedRootId,
					activityKind: "COMMENT",
				},
			},
		});
		await prisma.user.delete({ where: { id: DELETED_COMMENT_AUTHOR_ID } });

		await purgeJob.purgeDeletedAccounts();

		await expect(
			prisma.user.findUnique({ where: { id: fixture.purgedUserId } }),
		).resolves.not.toBeNull();
		await expect(
			prisma.todoComment.findUnique({ where: { id: fixture.purgedRootId } }),
		).resolves.toMatchObject({
			authorId: fixture.purgedUserId,
			content: "삭제될 루트",
			deletedAt: null,
			likeCount: 1,
		});
		await expect(prisma.todo.findUnique({ where: { id: fixture.todoId } })).resolves.toMatchObject({
			commentCount: 4,
		});
		await expect(
			prisma.notification.findUnique({ where: { id: notification.id } }),
		).resolves.not.toBeNull();
		expect(jest.mocked(notificationCache.invalidateUnreadCount)).not.toHaveBeenCalled();
	});

	it("서로 다른 사용자의 같은 멱등 키는 sentinel 재귀속 전에 다시 키워 충돌하지 않는다", async () => {
		const owner = await prisma.user.create({
			data: {
				id: "collision-owner",
				email: "collision-owner@example.com",
				userTag: "COLLOWNR",
				status: "ACTIVE",
			},
		});
		const deletedUsers = await Promise.all(
			["A", "B"].map((suffix) =>
				prisma.user.create({
					data: {
						id: `collision-user-${suffix}`,
						email: `collision-user-${suffix}@example.com`,
						userTag: `COLLUSR${suffix}`,
						status: "SUSPENDED",
						deletedAt: PURGE_ELIGIBLE_AT,
					},
				}),
			),
		);
		const category = await prisma.todoCategory.create({
			data: { userId: owner.id, name: "Collision", color: "#123456" },
		});
		const todo = await prisma.todo.create({
			data: {
				userId: owner.id,
				categoryId: category.id,
				title: "같은 멱등 키",
				startDate: NOW,
				commentCount: 2,
			},
		});
		const sharedRequestId = "00000000-0000-4000-8000-000000000099";
		await prisma.todoComment.createMany({
			data: deletedUsers.map((user, index) => ({
				id: `collision-comment-${index}`,
				todoId: todo.id,
				authorId: user.id,
				clientRequestId: sharedRequestId,
				requestFingerprint: "a".repeat(64),
				content: `댓글 ${index}`,
			})),
		});

		await purgeJob.purgeDeletedAccounts();

		const comments = await prisma.todoComment.findMany({
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
		await expect(
			prisma.user.count({ where: { id: { in: deletedUsers.map((user) => user.id) } } }),
		).resolves.toBe(0);
	});

	it("작성 댓글은 묘비로 보존하고 likes와 모든 counter를 정산한 뒤 계정을 지운다", async () => {
		// Given
		const fixture = await createCommentTree(prisma);
		await prisma.notification.createMany({
			data: [
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
			],
		});

		// When
		await purgeJob.purgeDeletedAccounts();

		// Then - 계정은 삭제되지만 다른 사용자의 descendant와 대화 rail은 남는다
		await expect(
			prisma.user.findUnique({ where: { id: fixture.purgedUserId } }),
		).resolves.toBeNull();
		await expect(
			prisma.user.findUnique({
				where: { id: DELETED_COMMENT_AUTHOR_ID },
				include: { accounts: true },
			}),
		).resolves.toMatchObject({
			status: "LOCKED",
			deletedAt: null,
			accounts: [],
		});
		const comments = await prisma.todoComment.findMany({
			where: { todoId: fixture.todoId },
			orderBy: { depth: "asc" },
		});
		const rollbackCompatibleComments = await prisma.todoComment.findMany({
			where: { id: { in: [fixture.purgedRootId, fixture.purgedChildId] } },
			include: { author: { include: { profile: true } } },
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

		const todo = await prisma.todo.findUniqueOrThrow({ where: { id: fixture.todoId } });
		expect(todo.commentCount).toBe(2);
		await expect(
			prisma.todoCommentLike.findUnique({
				where: {
					commentId_userId: {
						commentId: fixture.activeRootId,
						userId: fixture.purgedUserId,
					},
				},
			}),
		).resolves.toBeNull();
		await expect(
			prisma.todoCommentLike.findUnique({
				where: {
					commentId_userId: {
						commentId: fixture.purgedRootId,
						userId: fixture.otherUserId,
					},
				},
			}),
		).resolves.toMatchObject({ isActive: false });
		expect(jest.mocked(todoViewCache.invalidateForTodo)).toHaveBeenCalledWith(fixture.todoId);
		await expect(
			prisma.notification.findMany({ where: { userId: fixture.otherUserId } }),
		).resolves.toEqual([
			expect.objectContaining({ type: "SYSTEM_NOTICE", body: "계정과 관계없는 내용" }),
		]);
		expect(jest.mocked(notificationCache.invalidateUnreadCount)).toHaveBeenCalledTimes(1);
		expect(jest.mocked(notificationCache.invalidateUnreadCount)).toHaveBeenCalledWith(
			fixture.otherUserId,
		);

		const securityLog = await prisma.securityLog.findFirst({
			where: { event: "ACCOUNT_HARD_DELETED" },
		});
		expect(securityLog?.metadata).toMatchObject({ purgedUserId: fixture.purgedUserId });
	});
});
