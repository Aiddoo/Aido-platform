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

import { Logger } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { TypedConfigService } from "@/common/config/services/config.service";
import { BusinessException } from "@/common/exception/services/business-exception.service";
import { PaginationService } from "@/common/pagination/services/pagination.service";
import { DatabaseService } from "@/database/database.service";
import type { Follow, FollowStatus } from "@/generated/prisma/client";

import { FollowRepository } from "@/modules/follow/follow.repository";
import { FollowService } from "@/modules/follow/follow.service";

describe("FollowService Integration Tests", () => {
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
	};

	const mockUserDb = {
		findUnique: jest.fn(),
	};

	const mockDatabaseService = {
		follow: mockFollowDb,
		user: mockUserDb,
	};

	// 테스트 데이터
	const mockUserId = "user-integration-123";
	const mockTargetUserId = "user-integration-456";
	const mockFollowId = "follow-integration-789";

	const createMockFollow = (overrides: Partial<Follow> = {}) => ({
		id: mockFollowId,
		followerId: mockUserId,
		followingId: mockTargetUserId,
		status: "PENDING" as FollowStatus,
		createdAt: new Date(),
		updatedAt: new Date(),
		follower: {
			id: mockUserId,
			userTag: "USR12345",
			profile: {
				name: "Test User",
				profileImage: null,
			},
		},
		following: {
			id: mockTargetUserId,
			userTag: "TGT67890",
			profile: {
				name: "Target User",
				profileImage: null,
			},
		},
		...overrides,
	});

	beforeAll(async () => {
		// Logger 출력 비활성화
		jest.spyOn(Logger.prototype, "log").mockImplementation();
		jest.spyOn(Logger.prototype, "warn").mockImplementation();
		jest.spyOn(Logger.prototype, "error").mockImplementation();
		jest.spyOn(Logger.prototype, "debug").mockImplementation();
	});

	beforeEach(async () => {
		jest.clearAllMocks();

		// NestJS 테스트 모듈 생성 - 실제 DI 컨테이너 사용
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
			],
		}).compile();

		service = module.get<FollowService>(FollowService);
		repository = module.get<FollowRepository>(FollowRepository);
	});

	afterEach(async () => {
		if (module) {
			await module.close();
		}
	});

	// ============================================
	// DI 통합 테스트
	// ============================================

	describe("DI 통합", () => {
		it("FollowService가 올바르게 인스턴스화된다", () => {
			expect(service).toBeDefined();
			expect(service).toBeInstanceOf(FollowService);
		});

		it("FollowRepository가 올바르게 주입된다", () => {
			expect(repository).toBeDefined();
			expect(repository).toBeInstanceOf(FollowRepository);
		});
	});

	// ============================================
	// sendRequest 통합 테스트
	// ============================================

	describe("sendRequest 통합 테스트", () => {
		it("친구 요청이 Repository를 통해 올바르게 수행된다", async () => {
			// Given
			const mockFollow = createMockFollow();
			mockUserDb.findUnique.mockResolvedValue({ id: mockTargetUserId });
			// 첫 번째 호출: 내가 보낸 요청 확인 (없음)
			mockFollowDb.findUnique.mockResolvedValueOnce(null);
			// 두 번째 호출: 상대방이 보낸 요청 확인 (없음)
			mockFollowDb.findUnique.mockResolvedValueOnce(null);
			mockFollowDb.create.mockResolvedValue(mockFollow);

			// When
			const result = await service.sendRequest(mockUserId, mockTargetUserId);

			// Then
			expect(result).toBeDefined();
			expect(result.follow.followerId).toBe(mockUserId);
			expect(result.follow.followingId).toBe(mockTargetUserId);
			expect(result.follow.status).toBe("PENDING");
			expect(result.autoAccepted).toBe(false);
		});

		it("자기 자신에게 요청 시 BusinessException이 발생한다", async () => {
			// When & Then
			await expect(service.sendRequest(mockUserId, mockUserId)).rejects.toThrow(
				BusinessException,
			);
		});

		it("존재하지 않는 사용자에게 요청 시 BusinessException이 발생한다", async () => {
			// Given
			mockUserDb.findUnique.mockResolvedValue(null);

			// When & Then
			await expect(
				service.sendRequest(mockUserId, mockTargetUserId),
			).rejects.toThrow(BusinessException);
		});

		it("이미 친구인 경우 BusinessException이 발생한다", async () => {
			// Given
			const acceptedFollow = createMockFollow({ status: "ACCEPTED" });
			mockUserDb.findUnique.mockResolvedValue({ id: mockTargetUserId });
			mockFollowDb.findUnique.mockResolvedValue(acceptedFollow);

			// When & Then
			await expect(
				service.sendRequest(mockUserId, mockTargetUserId),
			).rejects.toThrow(BusinessException);
		});

		it("상대방이 먼저 요청을 보낸 경우 자동 수락된다", async () => {
			// Given
			const reverseFollow = createMockFollow({
				id: "reverse-follow-id",
				followerId: mockTargetUserId,
				followingId: mockUserId,
				status: "PENDING",
			});

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
				createMockFollow({ status: "ACCEPTED" }),
			);

			// When
			const result = await service.sendRequest(mockUserId, mockTargetUserId);

			// Then
			expect(result.follow.status).toBe("ACCEPTED");
			expect(result.autoAccepted).toBe(true);
		});
	});

	// ============================================
	// acceptRequest 통합 테스트
	// ============================================

	describe("acceptRequest 통합 테스트", () => {
		it("친구 요청 수락이 올바르게 수행된다", async () => {
			// Given
			const pendingRequest = createMockFollow({
				followerId: mockTargetUserId,
				followingId: mockUserId,
				status: "PENDING",
			});

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
			mockFollowDb.create.mockResolvedValue(
				createMockFollow({ status: "ACCEPTED" }),
			);

			// When - acceptRequest는 void를 반환
			await service.acceptRequest(mockUserId, mockTargetUserId);

			// Then - update가 호출되었는지 확인
			expect(mockFollowDb.update).toHaveBeenCalledWith({
				where: { id: pendingRequest.id },
				data: { status: "ACCEPTED" },
			});
			expect(mockFollowDb.create).toHaveBeenCalled();
		});

		it("존재하지 않는 요청을 수락하면 BusinessException이 발생한다", async () => {
			// Given
			mockFollowDb.findUnique.mockResolvedValue(null);

			// When & Then
			await expect(
				service.acceptRequest(mockUserId, mockTargetUserId),
			).rejects.toThrow(BusinessException);
		});
	});

	// ============================================
	// rejectRequest 통합 테스트
	// ============================================

	describe("rejectRequest 통합 테스트", () => {
		it("친구 요청 거절이 올바르게 수행된다", async () => {
			// Given
			const pendingRequest = createMockFollow({
				followerId: mockTargetUserId,
				followingId: mockUserId,
				status: "PENDING",
			});

			mockFollowDb.findUnique.mockResolvedValue(pendingRequest);
			mockFollowDb.delete.mockResolvedValue(pendingRequest);

			// When
			await service.rejectRequest(mockUserId, mockTargetUserId);

			// Then
			expect(mockFollowDb.delete).toHaveBeenCalled();
		});
	});

	// ============================================
	// remove 통합 테스트
	// ============================================

	describe("remove 통합 테스트", () => {
		it("친구 삭제가 양방향으로 수행된다", async () => {
			// Given
			const myFollow = createMockFollow({ status: "ACCEPTED" });
			const theirFollow = createMockFollow({
				id: "their-follow-id",
				followerId: mockTargetUserId,
				followingId: mockUserId,
				status: "ACCEPTED",
			});

			// 내 팔로우 조회
			mockFollowDb.findUnique.mockResolvedValueOnce(myFollow);
			// 내 팔로우 삭제
			mockFollowDb.delete.mockResolvedValueOnce(myFollow);
			// 상대방 팔로우 조회
			mockFollowDb.findUnique.mockResolvedValueOnce(theirFollow);
			// 상대방 팔로우 삭제
			mockFollowDb.delete.mockResolvedValueOnce(theirFollow);

			// When
			await service.remove(mockUserId, mockTargetUserId);

			// Then
			expect(mockFollowDb.delete).toHaveBeenCalledTimes(2);
		});
	});

	// ============================================
	// getFriends 통합 테스트
	// ============================================

	describe("getFriends 통합 테스트", () => {
		it("친구 목록 조회가 페이지네이션과 함께 수행된다", async () => {
			// Given
			const friends = [
				createMockFollow({ id: "follow-1", status: "ACCEPTED" }),
				createMockFollow({ id: "follow-2", status: "ACCEPTED" }),
			];

			mockFollowDb.findMany.mockResolvedValue(friends);

			// When
			const result = await service.getFriends({ userId: mockUserId });

			// Then
			expect(result).toBeDefined();
			expect(result.items).toHaveLength(2);
			expect(result.pagination).toBeDefined();
		});

		it("커서 기반 페이지네이션이 올바르게 작동한다", async () => {
			// Given
			const friends = [
				createMockFollow({ id: "follow-2", status: "ACCEPTED" }),
			];

			mockFollowDb.findMany.mockResolvedValue(friends);

			// When
			const result = await service.getFriends({
				userId: mockUserId,
				cursor: "follow-1",
				size: 10,
			});

			// Then
			expect(result).toBeDefined();
			expect(result.items).toHaveLength(1);
		});
	});

	// ============================================
	// getReceivedRequests 통합 테스트
	// ============================================

	describe("getReceivedRequests 통합 테스트", () => {
		it("받은 친구 요청 목록이 올바르게 조회된다", async () => {
			// Given
			const requests = [
				createMockFollow({
					id: "request-1",
					followerId: "other-user-1",
					followingId: mockUserId,
					status: "PENDING",
				}),
			];

			mockFollowDb.findMany.mockResolvedValue(requests);

			// When
			const result = await service.getReceivedRequests({ userId: mockUserId });

			// Then
			expect(result).toBeDefined();
			expect(result.items).toHaveLength(1);
		});
	});

	// ============================================
	// getSentRequests 통합 테스트
	// ============================================

	describe("getSentRequests 통합 테스트", () => {
		it("보낸 친구 요청 목록이 올바르게 조회된다", async () => {
			// Given
			const requests = [
				createMockFollow({
					id: "request-1",
					status: "PENDING",
				}),
			];

			mockFollowDb.findMany.mockResolvedValue(requests);

			// When
			const result = await service.getSentRequests({ userId: mockUserId });

			// Then
			expect(result).toBeDefined();
			expect(result.items).toHaveLength(1);
		});
	});

	// ============================================
	// isMutualFriend 통합 테스트
	// ============================================

	describe("isMutualFriend 통합 테스트", () => {
		it("맞팔 관계가 올바르게 확인된다", async () => {
			// Given - 맞팔 관계
			const myFollow = createMockFollow({ status: "ACCEPTED" });
			const theirFollow = createMockFollow({
				followerId: mockTargetUserId,
				followingId: mockUserId,
				status: "ACCEPTED",
			});

			// isMutualFriend는 findFirst를 사용
			mockFollowDb.findFirst
				.mockResolvedValueOnce(myFollow)
				.mockResolvedValueOnce(theirFollow);

			// When
			const result = await service.isMutualFriend(mockUserId, mockTargetUserId);

			// Then
			expect(result).toBe(true);
		});

		it("일방적인 팔로우는 맞팔이 아니다", async () => {
			// Given - 내가만 팔로우
			const myFollow = createMockFollow({ status: "ACCEPTED" });

			// isMutualFriend는 findFirst를 사용
			mockFollowDb.findFirst
				.mockResolvedValueOnce(myFollow)
				.mockResolvedValueOnce(null);

			// When
			const result = await service.isMutualFriend(mockUserId, mockTargetUserId);

			// Then
			expect(result).toBe(false);
		});
	});

	// ============================================
	// count 메서드 통합 테스트
	// ============================================

	describe("count 메서드 통합 테스트", () => {
		it("친구 수가 올바르게 집계된다", async () => {
			// Given
			mockFollowDb.count.mockResolvedValue(5);

			// When
			const result = await service.countFriends(mockUserId);

			// Then
			expect(result).toBe(5);
		});

		it("받은 요청 수가 올바르게 집계된다", async () => {
			// Given
			mockFollowDb.count.mockResolvedValue(3);

			// When
			const result = await service.countReceivedRequests(mockUserId);

			// Then
			expect(result).toBe(3);
		});

		it("보낸 요청 수가 올바르게 집계된다", async () => {
			// Given
			mockFollowDb.count.mockResolvedValue(2);

			// When
			const result = await service.countSentRequests(mockUserId);

			// Then
			expect(result).toBe(2);
		});
	});
});
