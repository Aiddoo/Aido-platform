/**
 * FollowService 통합 테스트
 *
 * @description
 * FollowService가 FollowRepository, PaginationService와 함께 올바르게 작동하는지 검증합니다.
 * 실제 데이터베이스 대신 모킹된 DatabaseService를 사용하여 서비스 계층 통합을 테스트합니다.
 *
 * 통합 테스트의 목적:
 * - NestJS 의존성 주입이 올바르게 작동하는지 검증
 * - FollowService와 FollowRepository의 통합 검증
 * - PaginationService와의 통합 검증
 * - BusinessException 에러 처리가 올바르게 작동하는지 검증
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test follow.integration-spec
 * ```
 */

import { Test, type TestingModule } from "@nestjs/testing";
import { FollowBuilder, UserBuilder } from "@test/builders";
import { createMockDatabaseService } from "@test/mocks/mock-database.factory";
import { suppressLogger } from "@test/setup/suppress-logger";
import { CacheService } from "@/common/cache/cache.service";
import { TypedConfigService } from "@/common/config/services/config.service";
import { EntitlementService } from "@/common/entitlement/entitlement.service";
import { BusinessException } from "@/common/exception/services/business-exception.service";
import { PaginationService } from "@/common/pagination/services/pagination.service";
import { DatabaseService } from "@/database/database.service";
import { FollowRepository } from "@/modules/follow/follow.repository";
import { FollowService } from "@/modules/follow/follow.service";
import { NotificationQueueService } from "@/modules/notification/queue";

describe("FollowService 통합 테스트 (Mock DB)", () => {
	let module: TestingModule;
	let service: FollowService;
	let repository: FollowRepository;

	// Mock 데이터베이스 서비스
	const mockFollowDb = {
		create: jest.fn(),
		findUnique: jest.fn(),
		findFirst: jest.fn(),
		findMany: jest.fn(),
		update: jest.fn(),
		delete: jest.fn(),
		count: jest.fn(),
		aggregate: jest.fn().mockResolvedValue({ _max: { sortOrder: 0 } }),
	};

	const mockUserDb = {
		findUnique: jest.fn(),
	};

	const mockDatabaseService = createMockDatabaseService({
		follow: mockFollowDb,
		user: mockUserDb,
	});

	// Mock NotificationQueueService
	const mockNotificationQueueService = {
		enqueueFollowNew: jest.fn(),
		enqueueFollowMutual: jest.fn(),
	};

	// Mock CacheService
	const mockCacheService = {
		getMutualFriend: jest.fn(),
		setMutualFriend: jest.fn(),
		invalidateMutualFriend: jest.fn(),
		invalidateFriendRelations: jest.fn(),
		wrapFriendCount: jest
			.fn()
			.mockImplementation((_userId, factory) => factory()),
		invalidateMutualFriendIds: jest.fn().mockResolvedValue(undefined),
		invalidateFriendCount: jest.fn().mockResolvedValue(undefined),
		wrapMutualFriendIds: jest
			.fn()
			.mockImplementation((_userId, factory) => factory()),
	};

	// 테스트 데이터
	const mockUser = UserBuilder.create()
		.withId("user-integration-123")
		.verified()
		.build();
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
				FollowService,
				FollowRepository,
				PaginationService,
				{
					provide: DatabaseService,
					useValue: mockDatabaseService,
				},
				{
					provide: TypedConfigService,
					useValue: {
						pagination: {
							defaultPageSize: 20,
							maxPageSize: 100,
						},
					},
				},
				{
					provide: NotificationQueueService,
					useValue: mockNotificationQueueService,
				},
				{
					provide: CacheService,
					useValue: mockCacheService,
				},
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

		service = module.get<FollowService>(FollowService);
		repository = module.get<FollowRepository>(FollowRepository);
	});

	afterAll(async () => {
		await module.close();
		jest.restoreAllMocks();
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("DI 통합", () => {
		it("FollowService가 올바르게 인스턴스화된다", () => {
			// Given - DI 컨테이너가 구성됨

			// When - 서비스 인스턴스 확인

			// Then - 서비스가 정의되어 있어야 함
			expect(service).toBeDefined();
			expect(service).toBeInstanceOf(FollowService);
		});

		it("FollowRepository가 올바르게 주입된다", () => {
			// Given - DI 컨테이너가 구성됨

			// When - 레포지토리 인스턴스 확인

			// Then - 레포지토리가 정의되어 있어야 함
			expect(repository).toBeDefined();
			expect(repository).toBeInstanceOf(FollowRepository);
		});
	});

	describe("sendRequest 통합 테스트", () => {
		it("친구 요청이 Repository를 통해 올바르게 수행된다", async () => {
			// Given - 친구 요청 대상 사용자 준비
			const mockFollow = FollowBuilder.create(mockUserId, mockTargetUserId)
				.withId(mockFollowId)
				.pending()
				.withFollowerUser({
					id: mockUserId,
					userTag: "USR12345",
					profile: { name: "Test User", profileImage: null },
				})
				.withFollowingUser({
					id: mockTargetUserId,
					userTag: mockTargetUserTag,
					profile: { name: "Target User", profileImage: null },
				})
				.buildWithFollowing();
			mockUserDb.findUnique.mockResolvedValue({ id: mockTargetUserId });
			// 첫 번째 호출: 내가 보낸 요청 확인 (없음)
			mockFollowDb.findUnique.mockResolvedValueOnce(null);
			// 두 번째 호출: 상대방이 보낸 요청 확인 (없음)
			mockFollowDb.findUnique.mockResolvedValueOnce(null);
			mockFollowDb.create.mockResolvedValue(mockFollow);

			// When - 친구 요청 전송
			const result = await service.sendRequest(mockUserId, mockTargetUserId);

			// Then - 친구 요청 생성 검증
			expect(result).toBeDefined();
			expect(result.follow.followerId).toBe(mockUserId);
			expect(result.follow.followingId).toBe(mockTargetUserId);
			expect(result.follow.status).toBe("PENDING");
			expect(result.autoAccepted).toBe(false);
		});

		it("자기 자신에게 요청 시 BusinessException이 발생한다", async () => {
			// Given - 자기 자신에게 요청 시도

			// When & Then - 예외 발생 검증
			await expect(service.sendRequest(mockUserId, mockUserId)).rejects.toThrow(
				BusinessException,
			);
		});

		it("존재하지 않는 사용자에게 요청 시 BusinessException이 발생한다", async () => {
			// Given - 존재하지 않는 사용자
			mockUserDb.findUnique.mockResolvedValue(null);

			// When & Then - 예외 발생 검증
			await expect(
				service.sendRequest(mockUserId, mockTargetUserId),
			).rejects.toThrow(BusinessException);
		});

		it("이미 친구인 경우 BusinessException이 발생한다", async () => {
			// Given - 이미 수락된 친구 관계
			const acceptedFollow = FollowBuilder.create(mockUserId, mockTargetUserId)
				.withId(mockFollowId)
				.accepted()
				.build();
			mockUserDb.findUnique.mockResolvedValue({ id: mockTargetUserId });
			mockFollowDb.findUnique.mockResolvedValue(acceptedFollow);

			// When & Then - 예외 발생 검증
			await expect(
				service.sendRequest(mockUserId, mockTargetUserId),
			).rejects.toThrow(BusinessException);
		});

		it("상대방이 먼저 요청을 보낸 경우 자동 수락된다", async () => {
			// Given - 상대방이 먼저 보낸 요청 존재
			const reverseFollow = FollowBuilder.create(mockTargetUserId, mockUserId)
				.withId("reverse-follow-id")
				.pending()
				.build();

			mockUserDb.findUnique.mockResolvedValue({ id: mockTargetUserId });
			// 첫 번째 호출: 내가 보낸 요청 확인 (없음)
			mockFollowDb.findUnique.mockResolvedValueOnce(null);
			// 두 번째 호출: 상대방이 보낸 요청 확인 (있음)
			mockFollowDb.findUnique.mockResolvedValueOnce(reverseFollow);

			mockFollowDb.update.mockResolvedValue({
				...reverseFollow,
				status: "ACCEPTED",
			});
			mockFollowDb.create.mockResolvedValue(
				FollowBuilder.create(mockUserId, mockTargetUserId)
					.withId(mockFollowId)
					.accepted()
					.build(),
			);

			// When - 친구 요청 전송
			const result = await service.sendRequest(mockUserId, mockTargetUserId);

			// Then - 자동 수락 검증
			expect(result.follow.status).toBe("ACCEPTED");
			expect(result.autoAccepted).toBe(true);
		});
	});

	describe("sendRequestByTag 통합 테스트", () => {
		it("userTag로 친구 요청을 보내고 Follow 레코드가 생성된다", async () => {
			// Given - userTag로 사용자 검색 준비
			const mockFollow = FollowBuilder.create(mockUserId, mockTargetUserId)
				.withId(mockFollowId)
				.pending()
				.withFollowingUser({
					id: mockTargetUserId,
					userTag: mockTargetUserTag,
					profile: { name: "Target User", profileImage: null },
				})
				.buildWithFollowing();
			// userTag로 사용자 조회
			mockUserDb.findUnique.mockResolvedValueOnce({ id: mockTargetUserId });
			// userId로 사용자 존재 확인 (sendRequest 내부)
			mockUserDb.findUnique.mockResolvedValueOnce({ id: mockTargetUserId });
			// 첫 번째 호출: 내가 보낸 요청 확인 (없음)
			mockFollowDb.findUnique.mockResolvedValueOnce(null);
			// 두 번째 호출: 상대방이 보낸 요청 확인 (없음)
			mockFollowDb.findUnique.mockResolvedValueOnce(null);
			mockFollowDb.create.mockResolvedValue(mockFollow);

			// When - userTag로 친구 요청 전송
			const result = await service.sendRequestByTag(
				mockUserId,
				mockTargetUserTag,
			);

			// Then - 친구 요청 생성 검증
			expect(result).toBeDefined();
			expect(result.follow.followerId).toBe(mockUserId);
			expect(result.follow.followingId).toBe(mockTargetUserId);
			expect(result.follow.status).toBe("PENDING");
			expect(result.autoAccepted).toBe(false);
		});

		it("존재하지 않는 userTag로 요청 시 FOLLOW_0905 에러가 발생한다", async () => {
			// Given - 존재하지 않는 userTag
			mockUserDb.findUnique.mockResolvedValue(null);

			// When & Then - 예외 발생 검증
			await expect(
				service.sendRequestByTag(mockUserId, "NOTEXIST"),
			).rejects.toThrow(BusinessException);
		});

		it("userTag로 요청 시 기존 sendRequest 로직을 재사용한다 (자동 수락 케이스)", async () => {
			// Given - 상대방이 먼저 요청을 보낸 상태
			const reverseFollow = FollowBuilder.create(mockTargetUserId, mockUserId)
				.withId("reverse-follow-id")
				.pending()
				.build();

			// userTag로 사용자 조회
			mockUserDb.findUnique.mockResolvedValueOnce({ id: mockTargetUserId });
			// userId로 사용자 존재 확인 (sendRequest 내부)
			mockUserDb.findUnique.mockResolvedValueOnce({ id: mockTargetUserId });
			// 첫 번째 호출: 내가 보낸 요청 확인 (없음)
			mockFollowDb.findUnique.mockResolvedValueOnce(null);
			// 두 번째 호출: 상대방이 보낸 요청 확인 (있음 - 자동 수락)
			mockFollowDb.findUnique.mockResolvedValueOnce(reverseFollow);

			mockFollowDb.update.mockResolvedValue({
				...reverseFollow,
				status: "ACCEPTED",
			});
			mockFollowDb.create.mockResolvedValue(
				FollowBuilder.create(mockUserId, mockTargetUserId)
					.withId(mockFollowId)
					.accepted()
					.build(),
			);

			// When - userTag로 친구 요청 전송
			const result = await service.sendRequestByTag(
				mockUserId,
				mockTargetUserTag,
			);

			// Then - 자동 수락 검증
			expect(result.follow.status).toBe("ACCEPTED");
			expect(result.autoAccepted).toBe(true);
		});
	});

	describe("acceptRequest 통합 테스트", () => {
		it("친구 요청 수락이 올바르게 수행된다", async () => {
			// Given - 수락할 친구 요청 준비
			const pendingRequest = FollowBuilder.create(mockTargetUserId, mockUserId)
				.withId(mockFollowId)
				.pending()
				.build();

			const myFollow = FollowBuilder.create(mockUserId, mockTargetUserId)
				.withId("my-follow-id")
				.accepted()
				.withFollowingUser({
					id: mockTargetUserId,
					userTag: mockTargetUserTag,
					profile: { name: "Target User", profileImage: null },
				})
				.buildWithFollowing();

			// 첫 번째 호출: 받은 요청 확인
			mockFollowDb.findUnique.mockResolvedValueOnce(pendingRequest);
			// 요청 수락
			mockFollowDb.update.mockResolvedValue({
				...pendingRequest,
				status: "ACCEPTED",
			});
			// 두 번째 호출: 역방향 관계 확인 (없음)
			mockFollowDb.findUnique.mockResolvedValueOnce(null);
			// 역방향 관계 생성
			mockFollowDb.create.mockResolvedValue(myFollow);
			// 마지막 호출: findByIdWithUser (생성된 Follow 조회 — follower+following 관계 포함)
			mockFollowDb.findUnique.mockResolvedValueOnce({
				...myFollow,
				follower: {
					id: mockUserId,
					userTag: "my-tag",
					profile: { name: "My User", profileImage: null },
				},
				following: {
					id: mockTargetUserId,
					userTag: mockTargetUserTag,
					profile: { name: "Target User", profileImage: null },
				},
			});

			// When - 친구 요청 수락
			const result = await service.acceptRequest(mockUserId, mockTargetUserId);

			// Then - 수락 결과 검증
			expect(result).toBeDefined();
			expect(result.id).toBe(myFollow.id);
			expect(result.status).toBe("ACCEPTED");
			expect(mockFollowDb.update).toHaveBeenCalledWith({
				where: { id: pendingRequest.id },
				data: expect.objectContaining({ status: "ACCEPTED" }),
			});
			expect(mockFollowDb.create).toHaveBeenCalled();
		});

		it("존재하지 않는 요청을 수락하면 BusinessException이 발생한다", async () => {
			// Given - 존재하지 않는 요청
			mockFollowDb.findUnique.mockResolvedValue(null);

			// When & Then - 예외 발생 검증
			await expect(
				service.acceptRequest(mockUserId, mockTargetUserId),
			).rejects.toThrow(BusinessException);
		});
	});

	describe("rejectRequest 통합 테스트", () => {
		it("친구 요청 거절이 올바르게 수행된다", async () => {
			// Given - 거절할 친구 요청 준비
			const pendingRequest = FollowBuilder.create(mockTargetUserId, mockUserId)
				.withId(mockFollowId)
				.pending()
				.build();

			mockFollowDb.findUnique.mockResolvedValue(pendingRequest);
			mockFollowDb.delete.mockResolvedValue(pendingRequest);

			// When - 친구 요청 거절
			await service.rejectRequest(mockUserId, mockTargetUserId);

			// Then - 삭제 메서드 호출 검증
			expect(mockFollowDb.delete).toHaveBeenCalled();
		});
	});

	describe("remove 통합 테스트", () => {
		it("친구 삭제가 양방향으로 수행된다", async () => {
			// Given - 양방향 친구 관계 준비
			const myFollow = FollowBuilder.create(mockUserId, mockTargetUserId)
				.withId(mockFollowId)
				.accepted()
				.build();
			const theirFollow = FollowBuilder.create(mockTargetUserId, mockUserId)
				.withId("their-follow-id")
				.accepted()
				.build();

			// 내 팔로우 조회
			mockFollowDb.findUnique.mockResolvedValueOnce(myFollow);
			// 내 팔로우 삭제
			mockFollowDb.delete.mockResolvedValueOnce(myFollow);
			// 상대방 팔로우 조회
			mockFollowDb.findUnique.mockResolvedValueOnce(theirFollow);
			// 상대방 팔로우 삭제
			mockFollowDb.delete.mockResolvedValueOnce(theirFollow);

			// When - 친구 삭제
			await service.remove(mockUserId, mockTargetUserId);

			// Then - 양방향 삭제 검증
			expect(mockFollowDb.delete).toHaveBeenCalledTimes(2);
		});
	});

	describe("getFriends 통합 테스트", () => {
		it("친구 목록 조회가 페이지네이션과 함께 수행된다", async () => {
			// Given - 친구 목록 준비
			const friends = [
				FollowBuilder.create(mockUserId, "friend-1")
					.withId("follow-1")
					.accepted()
					.withFollowingUser({
						id: "friend-1",
						userTag: "FRD00001",
						profile: { name: "Friend 1", profileImage: null },
					})
					.buildWithFollowing(),
				FollowBuilder.create(mockUserId, "friend-2")
					.withId("follow-2")
					.accepted()
					.withFollowingUser({
						id: "friend-2",
						userTag: "FRD00002",
						profile: { name: "Friend 2", profileImage: null },
					})
					.buildWithFollowing(),
			];

			mockFollowDb.findMany.mockResolvedValue(friends);

			// When - 친구 목록 조회
			const result = await service.getFriends({ userId: mockUserId });

			// Then - 목록 및 페이지네이션 검증
			expect(result).toBeDefined();
			expect(result.items).toHaveLength(2);
			expect(result.pagination).toBeDefined();
		});

		it("커서 기반 페이지네이션이 올바르게 작동한다", async () => {
			// Given - 페이지네이션 설정
			const friends = [
				FollowBuilder.create(mockUserId, mockTargetUserId)
					.withId("follow-2")
					.accepted()
					.withFollowingUser({
						id: mockTargetUserId,
						userTag: mockTargetUserTag,
						profile: { name: "Target User", profileImage: null },
					})
					.buildWithFollowing(),
			];

			mockFollowDb.findMany.mockResolvedValue(friends);

			// When - 커서와 사이즈 지정
			const result = await service.getFriends({
				userId: mockUserId,
				cursor: "follow-1",
				size: 10,
			});

			// Then - 결과 검증
			expect(result).toBeDefined();
			expect(result.items).toHaveLength(1);
		});

		it("userTag로 검색 시 해당 조건이 쿼리에 포함된다", async () => {
			// Given - userTag 검색 조건 설정
			const friends = [
				FollowBuilder.create(mockUserId, mockTargetUserId)
					.withId(mockFollowId)
					.accepted()
					.withFollowingUser({
						id: mockTargetUserId,
						userTag: mockTargetUserTag,
						profile: { name: "Target User", profileImage: null },
					})
					.buildWithFollowing(),
			];
			mockFollowDb.findMany.mockResolvedValue(friends);

			// When - userTag로 검색
			const result = await service.getFriends({
				userId: mockUserId,
				search: "TGT",
			});

			// Then - 검색 조건 포함 검증
			expect(result).toBeDefined();
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

		it("검색 결과가 없으면 빈 배열을 반환한다", async () => {
			// Given - 검색 결과 없음
			mockFollowDb.findMany.mockResolvedValue([]);

			// When - 존재하지 않는 userTag로 검색
			const result = await service.getFriends({
				userId: mockUserId,
				search: "NOTEXIST",
			});

			// Then - 빈 배열 반환 검증
			expect(result.items).toHaveLength(0);
		});
	});

	describe("getReceivedRequests 통합 테스트", () => {
		it("받은 친구 요청 목록이 올바르게 조회된다", async () => {
			// Given - 받은 요청 목록 준비
			const requests = [
				FollowBuilder.create("other-user-1", mockUserId)
					.withId("request-1")
					.pending()
					.withFollowerUser({
						id: "other-user-1",
						userTag: "OTH00001",
						profile: { name: "Other User 1", profileImage: null },
					})
					.buildWithFollower(),
			];

			mockFollowDb.findMany.mockResolvedValue(requests);

			// When - 받은 요청 조회
			const result = await service.getReceivedRequests({ userId: mockUserId });

			// Then - 받은 요청 목록 검증
			expect(result).toBeDefined();
			expect(result.items).toHaveLength(1);
		});
	});

	describe("getSentRequests 통합 테스트", () => {
		it("보낸 친구 요청 목록이 올바르게 조회된다", async () => {
			// Given - 보낸 요청 목록 준비
			const requests = [
				FollowBuilder.create(mockUserId, mockTargetUserId)
					.withId("request-1")
					.pending()
					.withFollowingUser({
						id: mockTargetUserId,
						userTag: mockTargetUserTag,
						profile: { name: "Target User", profileImage: null },
					})
					.buildWithFollowing(),
			];

			mockFollowDb.findMany.mockResolvedValue(requests);

			// When - 보낸 요청 조회
			const result = await service.getSentRequests({ userId: mockUserId });

			// Then - 보낸 요청 목록 검증
			expect(result).toBeDefined();
			expect(result.items).toHaveLength(1);
		});
	});

	describe("isMutualFriend 통합 테스트", () => {
		it("맞팔 관계가 올바르게 확인된다", async () => {
			// Given - 양방향 수락된 관계 준비
			const myFollow = FollowBuilder.create(mockUserId, mockTargetUserId)
				.accepted()
				.build();
			const theirFollow = FollowBuilder.create(mockTargetUserId, mockUserId)
				.accepted()
				.build();

			// isMutualFriend는 findFirst를 사용
			mockFollowDb.findFirst
				.mockResolvedValueOnce(myFollow)
				.mockResolvedValueOnce(theirFollow);

			// When - 맞팔 확인
			const result = await service.isMutualFriend(mockUserId, mockTargetUserId);

			// Then - 맞팔 관계 검증
			expect(result).toBe(true);
		});

		it("일방적인 팔로우는 맞팔이 아니다", async () => {
			// Given - 일방적인 팔로우 관계
			const myFollow = FollowBuilder.create(mockUserId, mockTargetUserId)
				.accepted()
				.build();

			// isMutualFriend는 findFirst를 사용
			mockFollowDb.findFirst
				.mockResolvedValueOnce(myFollow)
				.mockResolvedValueOnce(null);

			// When - 맞팔 확인
			const result = await service.isMutualFriend(mockUserId, mockTargetUserId);

			// Then - 맞팔 아님 검증
			expect(result).toBe(false);
		});
	});

	describe("count 메서드 통합 테스트", () => {
		it("친구 수가 올바르게 집계된다", async () => {
			// Given - 친구 수 설정
			mockFollowDb.count.mockResolvedValue(5);

			// When - 친구 수 조회
			const result = await service.countFriends(mockUserId);

			// Then - 친구 수 검증
			expect(result).toBe(5);
		});

		it("받은 요청 수가 올바르게 집계된다", async () => {
			// Given - 받은 요청 수 설정
			mockFollowDb.count.mockResolvedValue(3);

			// When - 받은 요청 수 조회
			const result = await service.countReceivedRequests(mockUserId);

			// Then - 받은 요청 수 검증
			expect(result).toBe(3);
		});

		it("보낸 요청 수가 올바르게 집계된다", async () => {
			// Given - 보낸 요청 수 설정
			mockFollowDb.count.mockResolvedValue(2);

			// When - 보낸 요청 수 조회
			const result = await service.countSentRequests(mockUserId);

			// Then - 보낸 요청 수 검증
			expect(result).toBe(2);
		});
	});
});
