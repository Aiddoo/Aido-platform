/**
 * Follow 모듈 통합 테스트 (Mock DB)
 *
 * @description
 * 클린아키텍처(무버스 use-case) 구조로 재작성. FollowFacade·use-case·FollowReader가
 * PrismaFollowRepository(Mock DB)·캐시/알림 어댑터와 함께 DI로 올바르게 조립되고
 * 동작하는지 검증한다. HTTP 계약(예외 정규화)은 e2e가 담당하고, 여기서는
 * 애플리케이션 예외(ApplicationException) 발생 여부만 확인한다.
 *
 * 실행: pnpm --filter @aido/api test follow.integration-spec
 */

import { TransactionHost } from "@nestjs-cls/transactional";
import { Test, type TestingModule } from "@nestjs/testing";
import { FollowBuilder, UserBuilder } from "@test/builders";
import { createMockDatabaseService } from "@test/mocks/mock-database.factory";
import { createUnitOfWorkMock } from "@test/mocks/ports";
import { suppressLogger } from "@test/setup/suppress-logger";

import { FOLLOW_CACHE } from "@/follow/application/ports/follow-cache.port";
import { FOLLOW_NOTIFIER } from "@/follow/application/ports/follow-notifier.port";
import { FOLLOW_REPOSITORY } from "@/follow/application/ports/follow.repository.port";
import { SearchUsersUseCase } from "@/follow/application/queries/search-users/search-users.use-case";
import { FollowReader } from "@/follow/application/services/follow.reader";
import { FriendshipEffects } from "@/follow/application/services/friendship-effects.service";
import { AcceptFriendRequestUseCase } from "@/follow/application/use-cases/accept-friend-request/accept-friend-request.use-case";
import { RejectFriendRequestUseCase } from "@/follow/application/use-cases/reject-friend-request/reject-friend-request.use-case";
import { RemoveFriendUseCase } from "@/follow/application/use-cases/remove-friend/remove-friend.use-case";
import { ReorderFriendUseCase } from "@/follow/application/use-cases/reorder-friend/reorder-friend.use-case";
import { SendFriendRequestByTagUseCase } from "@/follow/application/use-cases/send-friend-request-by-tag/send-friend-request-by-tag.use-case";
import { SendFriendRequestUseCase } from "@/follow/application/use-cases/send-friend-request/send-friend-request.use-case";
import { FollowCacheAdapter } from "@/follow/infrastructure/adapters/follow-cache.adapter";
import { FollowNotifierAdapter } from "@/follow/infrastructure/adapters/follow-notifier.adapter";
import { PrismaFollowRepository } from "@/follow/infrastructure/persistence/prisma-follow.repository";
import { NotificationQueueService } from "@/notification/queue";
import { EntitlementService } from "@/shared/application/entitlement/entitlement.service";
import { PaginationService } from "@/shared/application/pagination/services/pagination.service";
import { UNIT_OF_WORK } from "@/shared/application/ports";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";

describe("Follow 모듈 통합 테스트 (Mock DB)", () => {
	let module: TestingModule;
	let followReader: FollowReader;
	let sendUseCase: SendFriendRequestUseCase;
	let sendByTagUseCase: SendFriendRequestByTagUseCase;
	let acceptUseCase: AcceptFriendRequestUseCase;
	let rejectUseCase: RejectFriendRequestUseCase;
	let removeUseCase: RemoveFriendUseCase;

	const mockFollowDb = {
		create: jest.fn(),
		findUnique: jest.fn(),
		findFirst: jest.fn(),
		findMany: jest.fn(),
		update: jest.fn(),
		delete: jest.fn(),
		count: jest.fn(),
		updateMany: jest.fn().mockResolvedValue({ count: 0 }),
		aggregate: jest.fn().mockResolvedValue({ _max: { sortOrder: 0 } }),
	};
	const mockUserDb = { findUnique: jest.fn(), findFirst: jest.fn() };
	const mockDatabaseService = createMockDatabaseService({
		follow: mockFollowDb,
		user: mockUserDb,
	});

	const mockNotificationQueueService = {
		enqueueFollowNew: jest.fn(),
		enqueueFollowMutual: jest.fn(),
		enqueueMilestoneReached: jest.fn(),
	};

	const mockCacheService = {
		getMutualFriend: jest.fn(),
		setMutualFriend: jest.fn(),
		invalidateMutualFriend: jest.fn().mockResolvedValue(undefined),
		invalidateMutualFriendIds: jest.fn().mockResolvedValue(undefined),
		invalidateFriendCount: jest.fn().mockResolvedValue(undefined),
		wrapFriendCount: jest.fn().mockImplementation((_userId, factory) => factory()),
		wrapMutualFriendIds: jest.fn().mockImplementation((_userId, factory) => factory()),
	};

	const mockUser = UserBuilder.create().withId("user-integration-123").verified().build();
	const mockTargetUser = UserBuilder.create()
		.withId("user-integration-456")
		.withUserTag("TGT67890")
		.verified()
		.build();
	const mockUserId = mockUser.id;
	const mockTargetUserId = mockTargetUser.id;
	const mockFollowId = "follow-integration-789";
	const mockTargetUserTag = mockTargetUser.userTag;

	beforeAll(async () => {
		suppressLogger();

		module = await Test.createTestingModule({
			providers: [
				FollowReader,
				FriendshipEffects,
				SendFriendRequestUseCase,
				SendFriendRequestByTagUseCase,
				AcceptFriendRequestUseCase,
				RejectFriendRequestUseCase,
				RemoveFriendUseCase,
				ReorderFriendUseCase,
				SearchUsersUseCase,
				{ provide: FOLLOW_REPOSITORY, useClass: PrismaFollowRepository },
				{ provide: FOLLOW_CACHE, useClass: FollowCacheAdapter },
				{ provide: FOLLOW_NOTIFIER, useClass: FollowNotifierAdapter },
				PaginationService,
				{ provide: UNIT_OF_WORK, useValue: createUnitOfWorkMock() },
				{
					provide: TransactionHost,
					useValue: { tx: mockDatabaseService },
				},
				{
					provide: TypedConfigService,
					useValue: {
						pagination: { defaultPageSize: 20, maxPageSize: 100 },
					},
				},
				{
					provide: NotificationQueueService,
					useValue: mockNotificationQueueService,
				},
				{ provide: CacheService, useValue: mockCacheService },
				{
					provide: EntitlementService,
					useValue: {
						getResourceLimit: jest.fn().mockResolvedValue({
							maxCount: null,
							isAdmin: false,
							subscriptionStatus: "ACTIVE",
						}),
						enforceResourceLimit: jest.fn(),
					},
				},
			],
		}).compile();

		followReader = module.get(FollowReader);
		sendUseCase = module.get(SendFriendRequestUseCase);
		sendByTagUseCase = module.get(SendFriendRequestByTagUseCase);
		acceptUseCase = module.get(AcceptFriendRequestUseCase);
		rejectUseCase = module.get(RejectFriendRequestUseCase);
		removeUseCase = module.get(RemoveFriendUseCase);
	});

	afterAll(async () => {
		await module.close();
		jest.restoreAllMocks();
	});

	beforeEach(() => {
		jest.clearAllMocks();
		mockCacheService.getMutualFriend.mockResolvedValue(undefined);
	});

	describe("DI 통합", () => {
		it("FollowReader가 올바르게 조립된다", () => {
			expect(followReader).toBeDefined();
			expect(followReader).toBeInstanceOf(FollowReader);
		});

		it("FollowRepository 포트가 주입된다", () => {
			expect(module.get(FOLLOW_REPOSITORY)).toBeInstanceOf(PrismaFollowRepository);
		});
	});

	describe("친구 요청 (use-case)", () => {
		it("친구 요청이 Repository를 통해 생성된다", async () => {
			mockUserDb.findFirst.mockResolvedValue({ id: mockTargetUserId });
			mockFollowDb.findUnique.mockResolvedValueOnce(null);
			mockFollowDb.findUnique.mockResolvedValueOnce(null);
			mockFollowDb.create.mockResolvedValue(
				FollowBuilder.create(mockUserId, mockTargetUserId).withId(mockFollowId).pending().build(),
			);
			mockUserDb.findUnique.mockResolvedValue({ id: mockTargetUserId });

			const result = await sendUseCase.execute({
				userId: mockUserId,
				targetUserId: mockTargetUserId,
			});

			expect(result.follow.followerId).toBe(mockUserId);
			expect(result.follow.followingId).toBe(mockTargetUserId);
			expect(result.follow.status).toBe("PENDING");
			expect(result.autoAccepted).toBe(false);
		});

		it("자기 자신에게 요청 시 ApplicationException", async () => {
			await expect(
				sendUseCase.execute({ userId: mockUserId, targetUserId: mockUserId }),
			).rejects.toThrow(ApplicationException);
		});

		it("존재하지 않는 사용자에게 요청 시 ApplicationException", async () => {
			mockUserDb.findFirst.mockResolvedValue(null);
			await expect(
				sendUseCase.execute({
					userId: mockUserId,
					targetUserId: mockTargetUserId,
				}),
			).rejects.toThrow(ApplicationException);
		});

		it("이미 친구인 경우 ApplicationException", async () => {
			mockUserDb.findFirst.mockResolvedValue({ id: mockTargetUserId });
			mockFollowDb.findUnique.mockResolvedValue(
				FollowBuilder.create(mockUserId, mockTargetUserId).withId(mockFollowId).accepted().build(),
			);
			await expect(
				sendUseCase.execute({
					userId: mockUserId,
					targetUserId: mockTargetUserId,
				}),
			).rejects.toThrow(ApplicationException);
		});

		it("상대방이 먼저 요청한 경우 자동 수락", async () => {
			mockUserDb.findFirst.mockResolvedValue({ id: mockTargetUserId });
			mockFollowDb.findUnique.mockResolvedValueOnce(null);
			mockFollowDb.findUnique.mockResolvedValueOnce(
				FollowBuilder.create(mockTargetUserId, mockUserId)
					.withId("reverse-follow-id")
					.pending()
					.build(),
			);
			mockFollowDb.update.mockResolvedValue(
				FollowBuilder.create(mockTargetUserId, mockUserId).accepted().build(),
			);
			mockFollowDb.create.mockResolvedValue(
				FollowBuilder.create(mockUserId, mockTargetUserId).withId(mockFollowId).accepted().build(),
			);
			mockUserDb.findUnique.mockResolvedValue({
				userTag: "USR12345",
				profile: { name: "User" },
			});

			const result = await sendUseCase.execute({
				userId: mockUserId,
				targetUserId: mockTargetUserId,
			});

			expect(result.follow.status).toBe("ACCEPTED");
			expect(result.autoAccepted).toBe(true);
		});
	});

	describe("친구 요청 by tag (facade)", () => {
		it("userTag로 요청하면 Follow가 생성된다", async () => {
			mockUserDb.findFirst.mockResolvedValue({ id: mockTargetUserId });
			mockFollowDb.findUnique.mockResolvedValueOnce(null);
			mockFollowDb.findUnique.mockResolvedValueOnce(null);
			mockFollowDb.create.mockResolvedValue(
				FollowBuilder.create(mockUserId, mockTargetUserId).withId(mockFollowId).pending().build(),
			);
			mockUserDb.findUnique.mockResolvedValue({ id: mockTargetUserId });

			const result = await sendByTagUseCase.execute({
				userId: mockUserId,
				targetUserTag: mockTargetUserTag,
			});

			expect(result.follow.status).toBe("PENDING");
			expect(result.autoAccepted).toBe(false);
		});

		it("존재하지 않는 userTag → ApplicationException", async () => {
			mockUserDb.findFirst.mockResolvedValue(null);
			await expect(
				sendByTagUseCase.execute({
					userId: mockUserId,
					targetUserTag: "NOTEXIST",
				}),
			).rejects.toThrow(ApplicationException);
		});
	});

	describe("친구 요청 수락 (facade)", () => {
		it("수락 시 양방향 관계가 성립된다", async () => {
			const pendingRequest = FollowBuilder.create(mockTargetUserId, mockUserId)
				.withId(mockFollowId)
				.pending()
				.build();
			const myFollow = FollowBuilder.create(mockUserId, mockTargetUserId)
				.withId("my-follow-id")
				.accepted()
				.build();

			mockFollowDb.findUnique.mockResolvedValueOnce(pendingRequest);
			mockFollowDb.update.mockResolvedValue({
				...pendingRequest,
				status: "ACCEPTED",
			});
			mockFollowDb.findUnique.mockResolvedValueOnce(null);
			mockFollowDb.create.mockResolvedValue(myFollow);
			mockFollowDb.findUnique.mockResolvedValueOnce(
				FollowBuilder.create(mockUserId, mockTargetUserId)
					.withId("my-follow-id")
					.accepted()
					.withFollowerUser({
						id: mockUserId,
						userTag: "MYTAG123",
						profile: { name: "My User", profileImage: null },
					})
					.withFollowingUser({
						id: mockTargetUserId,
						userTag: mockTargetUserTag,
						profile: { name: "Target User", profileImage: null },
					})
					.buildWithUser(),
			);

			const result = await acceptUseCase.execute({
				userId: mockUserId,
				requesterUserId: mockTargetUserId,
			});

			expect(result.status).toBe("ACCEPTED");
			expect(mockFollowDb.create).toHaveBeenCalled();
		});

		it("존재하지 않는 요청 수락 → ApplicationException", async () => {
			mockFollowDb.findUnique.mockResolvedValue(null);
			await expect(
				acceptUseCase.execute({
					userId: mockUserId,
					requesterUserId: mockTargetUserId,
				}),
			).rejects.toThrow(ApplicationException);
		});
	});

	describe("친구 요청 거절 / 삭제 (facade)", () => {
		it("거절 시 요청이 삭제된다", async () => {
			mockFollowDb.findUnique.mockResolvedValue(
				FollowBuilder.create(mockTargetUserId, mockUserId).withId(mockFollowId).pending().build(),
			);
			mockFollowDb.delete.mockResolvedValue(undefined);

			await rejectUseCase.execute({
				userId: mockUserId,
				requesterUserId: mockTargetUserId,
			});
			expect(mockFollowDb.delete).toHaveBeenCalled();
		});

		it("친구 삭제는 양방향으로 수행된다", async () => {
			mockFollowDb.findUnique.mockResolvedValueOnce(
				FollowBuilder.create(mockUserId, mockTargetUserId).withId(mockFollowId).accepted().build(),
			);
			mockFollowDb.delete.mockResolvedValue(undefined);
			mockFollowDb.findUnique.mockResolvedValueOnce(
				FollowBuilder.create(mockTargetUserId, mockUserId)
					.withId("their-follow-id")
					.accepted()
					.build(),
			);

			await removeUseCase.execute({
				userId: mockUserId,
				targetUserId: mockTargetUserId,
			});
			expect(mockFollowDb.delete).toHaveBeenCalledTimes(2);
		});
	});

	describe("친구 목록 조회 (facade)", () => {
		it("친구 목록이 페이지네이션과 함께 조회된다", async () => {
			mockFollowDb.findMany.mockResolvedValue([
				FollowBuilder.create(mockUserId, "friend-1").withId("follow-1").accepted().buildWithUser(),
				FollowBuilder.create(mockUserId, "friend-2").withId("follow-2").accepted().buildWithUser(),
			]);

			const result = await followReader.getFriends({ userId: mockUserId });
			expect(result.items).toHaveLength(2);
			expect(result.pagination).toBeDefined();
		});

		it("userTag 검색 조건이 쿼리에 포함된다", async () => {
			mockFollowDb.findMany.mockResolvedValue([]);
			await followReader.getFriends({ userId: mockUserId, search: "TGT" });
			expect(mockFollowDb.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						following: expect.objectContaining({
							userTag: { contains: "TGT", mode: "insensitive" },
						}),
					}),
				}),
			);
		});
	});

	describe("맞팔 여부 / 집계 (facade)", () => {
		it("양방향 수락이면 맞팔이다", async () => {
			mockFollowDb.findFirst
				.mockResolvedValueOnce(
					FollowBuilder.create(mockUserId, mockTargetUserId).accepted().build(),
				)
				.mockResolvedValueOnce(
					FollowBuilder.create(mockTargetUserId, mockUserId).accepted().build(),
				);

			const result = await followReader.isMutualFriend(mockUserId, mockTargetUserId);
			expect(result).toBe(true);
		});

		it("일방적 팔로우는 맞팔이 아니다", async () => {
			mockFollowDb.findFirst
				.mockResolvedValueOnce(
					FollowBuilder.create(mockUserId, mockTargetUserId).accepted().build(),
				)
				.mockResolvedValueOnce(null);

			const result = await followReader.isMutualFriend(mockUserId, mockTargetUserId);
			expect(result).toBe(false);
		});

		it("친구 수가 집계된다", async () => {
			mockFollowDb.count.mockResolvedValue(5);
			expect(await followReader.countFriends(mockUserId)).toBe(5);
		});
	});
});
