/**
 * FollowService 테스트 (Suites 패턴)
 *
 * NestJS 공식 권장 Suites 라이브러리 사용
 * - 자동 Mock 생성으로 보일러플레이트 제거
 * - Builder 패턴으로 테스트 데이터 생성
 * - Given/When/Then 구조로 명확한 테스트 흐름
 *
 * @see https://docs.nestjs.com/recipes/suites
 */
import { FOLLOW_LIMITS } from "@aido/validators";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { FollowBuilder } from "@test/builders";
import { type TransactionCallback } from "@test/mocks";
import { CacheService } from "@/common/cache/cache.service";
import { EntitlementService } from "@/common/entitlement/entitlement.service";
import {
	BusinessException,
	BusinessExceptions,
} from "@/common/exception/services/business-exception.service";
import { PaginationService } from "@/common/pagination/services/pagination.service";
import { DatabaseService } from "@/database/database.service";
import { type Follow, Prisma } from "@/generated/prisma/client";
import { NotificationQueueService } from "@/modules/notification/queue";

import { FollowRepository } from "./follow.repository";
import { FollowService } from "./follow.service";
import type { FollowWithUser } from "./types/follow.types";

describe("FollowService", () => {
	let service: FollowService;
	let followRepo: Mocked<FollowRepository>;
	let paginationService: Mocked<PaginationService>;
	let entitlementService: Mocked<EntitlementService>;
	let database: Mocked<DatabaseService>;
	let _notificationQueueService: Mocked<NotificationQueueService>;
	let cacheService: Mocked<CacheService>;

	// 재사용 가능한 테스트 데이터
	const mockUserId = "user-123";
	const mockTargetUserId = "user-456";
	const mockTargetUserTag = "JOHN2026";

	// Transaction mock context (테스트에서 참조 가능)
	const mockTxContext = {};

	beforeEach(async () => {
		// Suites가 모든 의존성을 자동으로 mock
		const { unit, unitRef } = await TestBed.solitary(FollowService).compile();

		service = unit;
		followRepo = unitRef.get(FollowRepository);
		paginationService = unitRef.get(PaginationService);
		entitlementService = unitRef.get(EntitlementService);
		database = unitRef.get(DatabaseService);
		_notificationQueueService = unitRef.get(NotificationQueueService);
		cacheService = unitRef.get(CacheService);

		// DatabaseService.$transaction passthrough 구현 (tx context 전달)
		database.$transaction.mockImplementation((callback: TransactionCallback) =>
			callback(mockTxContext),
		);

		// 리소스 제한 기본 mock (Premium 유저 = 무제한)
		entitlementService.getResourceLimit.mockResolvedValue({
			maxCount: null,
			isAdmin: false,
			subscriptionStatus: "ACTIVE",
		});

		// wrapFriendCount passthrough (countFriends 내부에서 사용)
		cacheService.wrapFriendCount.mockImplementation((_userId, factory) =>
			factory(),
		);
	});

	// ============================================
	// sendRequestByTag
	// ============================================

	describe("sendRequestByTag", () => {
		/**
		 * sendRequestByTag 성공 시나리오 mock 설정 헬퍼
		 */
		const setupSendRequestByTagSuccess = (follow: Follow) => {
			followRepo.findUserByTag.mockResolvedValue({ id: mockTargetUserId });
			followRepo.userExists.mockResolvedValue(true);
			followRepo.findByFollowerAndFollowing.mockResolvedValue(null);
			followRepo.create.mockResolvedValue(follow);
		};

		it("userTag로 친구 요청을 보낼 수 있다", async () => {
			// Given
			const mockFollow = FollowBuilder.create(mockUserId, mockTargetUserId)
				.pending()
				.build();
			setupSendRequestByTagSuccess(mockFollow);

			// When
			const result = await service.sendRequestByTag(
				mockUserId,
				mockTargetUserTag,
			);

			// Then
			expect(result.follow).toEqual(mockFollow);
			expect(result.autoAccepted).toBe(false);
			expect(followRepo.findUserByTag).toHaveBeenCalledWith(mockTargetUserTag);
			expect(followRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({
					follower: { connect: { id: mockUserId } },
					following: { connect: { id: mockTargetUserId } },
					status: "PENDING",
				}),
			);
		});

		it("존재하지 않는 userTag로 요청 시 FOLLOW_0905 에러를 던진다", async () => {
			// Given
			followRepo.findUserByTag.mockResolvedValue(null);

			// When & Then
			await expect(
				service.sendRequestByTag(mockUserId, "INVALID1"),
			).rejects.toThrow(BusinessException);
			expect(followRepo.findUserByTag).toHaveBeenCalledWith("INVALID1");
		});

		it("기존 sendRequest 로직을 재사용한다 (자동 수락 케이스)", async () => {
			// Given
			const reverseFollow = FollowBuilder.create(mockTargetUserId, mockUserId)
				.withId("reverse-follow-id")
				.pending()
				.build();

			const autoAcceptedFollow = FollowBuilder.create(
				mockUserId,
				mockTargetUserId,
			)
				.accepted()
				.build();

			followRepo.findUserByTag.mockResolvedValue({ id: mockTargetUserId });
			followRepo.userExists.mockResolvedValue(true);
			followRepo.findByFollowerAndFollowing
				.mockResolvedValueOnce(null) // userId -> targetUserId 조회
				.mockResolvedValueOnce(reverseFollow); // targetUserId -> userId 조회
			followRepo.updateByFollowerAndFollowing.mockResolvedValue({
				...reverseFollow,
				status: "ACCEPTED",
			});
			followRepo.create.mockResolvedValue(autoAcceptedFollow);
			followRepo.getUserName.mockResolvedValue("테스트 유저");
			cacheService.invalidateMutualFriend.mockResolvedValue(undefined);

			// When
			const result = await service.sendRequestByTag(
				mockUserId,
				mockTargetUserTag,
			);

			// Then
			expect(result.autoAccepted).toBe(true);
			expect(result.follow.status).toBe("ACCEPTED");
		});
	});

	// ============================================
	// sendRequest
	// ============================================

	describe("sendRequest", () => {
		/**
		 * sendRequest 성공 시나리오 mock 설정 헬퍼
		 */
		const setupSendRequestSuccess = (follow: Follow) => {
			followRepo.userExists.mockResolvedValue(true);
			followRepo.findByFollowerAndFollowing.mockResolvedValue(null);
			followRepo.create.mockResolvedValue(follow);
			followRepo.getUserName.mockResolvedValue("테스트 유저");
		};

		it("새로운 친구 요청을 보내면 PENDING 상태로 생성된다", async () => {
			// Given
			const mockFollow = FollowBuilder.create(mockUserId, mockTargetUserId)
				.pending()
				.build();
			setupSendRequestSuccess(mockFollow);

			// When
			const result = await service.sendRequest(mockUserId, mockTargetUserId);

			// Then
			expect(result.follow).toEqual(mockFollow);
			expect(result.autoAccepted).toBe(false);
			expect(followRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({
					follower: { connect: { id: mockUserId } },
					following: { connect: { id: mockTargetUserId } },
					status: "PENDING",
				}),
			);
		});

		it("자기 자신에게 요청하면 FOLLOW_0904 에러를 던진다", async () => {
			// Given - 자기 자신에게 요청

			// When & Then
			await expect(service.sendRequest(mockUserId, mockUserId)).rejects.toThrow(
				BusinessException,
			);
		});

		it("존재하지 않는 사용자에게 요청하면 FOLLOW_0905 에러를 던진다", async () => {
			// Given
			followRepo.userExists.mockResolvedValue(false);

			// When & Then
			await expect(
				service.sendRequest(mockUserId, "non-existent-user"),
			).rejects.toThrow(BusinessException);
		});

		it("이미 친구인 경우 FOLLOW_0902 에러를 던진다", async () => {
			// Given
			const acceptedFollow = FollowBuilder.create(mockUserId, mockTargetUserId)
				.accepted()
				.build();
			followRepo.userExists.mockResolvedValue(true);
			followRepo.findByFollowerAndFollowing.mockResolvedValue(acceptedFollow);

			// When & Then
			await expect(
				service.sendRequest(mockUserId, mockTargetUserId),
			).rejects.toThrow(BusinessException);
		});

		it("이미 요청을 보낸 경우 FOLLOW_0901 에러를 던진다", async () => {
			// Given
			const pendingFollow = FollowBuilder.create(mockUserId, mockTargetUserId)
				.pending()
				.build();
			followRepo.userExists.mockResolvedValue(true);
			followRepo.findByFollowerAndFollowing.mockResolvedValue(pendingFollow);

			// When & Then
			await expect(
				service.sendRequest(mockUserId, mockTargetUserId),
			).rejects.toThrow(BusinessException);
		});

		it("상대방이 이미 요청을 보낸 경우 자동 수락된다", async () => {
			// Given
			const reverseFollow = FollowBuilder.create(mockTargetUserId, mockUserId)
				.withId("reverse-follow-id")
				.pending()
				.build();

			const autoAcceptedFollow = FollowBuilder.create(
				mockUserId,
				mockTargetUserId,
			)
				.accepted()
				.build();

			followRepo.userExists.mockResolvedValue(true);
			followRepo.findByFollowerAndFollowing
				.mockResolvedValueOnce(null) // userId -> targetUserId 조회
				.mockResolvedValueOnce(reverseFollow); // targetUserId -> userId 조회
			followRepo.updateByFollowerAndFollowing.mockResolvedValue({
				...reverseFollow,
				status: "ACCEPTED",
			});
			followRepo.create.mockResolvedValue(autoAcceptedFollow);
			followRepo.getUserName.mockResolvedValue("테스트 유저");
			cacheService.invalidateMutualFriend.mockResolvedValue(undefined);

			// When
			const result = await service.sendRequest(mockUserId, mockTargetUserId);

			// Then
			expect(result.autoAccepted).toBe(true);
			expect(result.follow.status).toBe("ACCEPTED");
			expect(followRepo.updateByFollowerAndFollowing).toHaveBeenCalledWith(
				mockTargetUserId,
				mockUserId,
				{ status: "ACCEPTED" },
				expect.anything(), // 트랜잭션 컨텍스트
			);
			expect(followRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({
					status: "ACCEPTED",
				}),
				expect.anything(), // 트랜잭션 컨텍스트
			);
		});

		it("P2002 unique constraint(중복 요청) 시 followRequestAlreadySent를 던져야 한다", async () => {
			// Given - create에서 P2002 발생 (동시 요청 race condition)
			followRepo.userExists.mockResolvedValue(true);
			followRepo.findByFollowerAndFollowing.mockResolvedValue(null);
			followRepo.create.mockRejectedValue(
				new Prisma.PrismaClientKnownRequestError("Unique constraint", {
					code: "P2002",
					meta: { target: ["followerId", "followingId"] },
					clientVersion: "7.0.0",
				}),
			);

			// When & Then
			await expect(
				service.sendRequest(mockUserId, mockTargetUserId),
			).rejects.toThrow(
				BusinessExceptions.followRequestAlreadySent(mockTargetUserId),
			);
		});

		it("상대방이 이미 ACCEPTED 상태면 FOLLOW_0902 에러를 던진다", async () => {
			// Given
			const acceptedReverseFollow = FollowBuilder.create(
				mockTargetUserId,
				mockUserId,
			)
				.withId("reverse-follow-id")
				.accepted()
				.build();

			followRepo.userExists.mockResolvedValue(true);
			followRepo.findByFollowerAndFollowing
				.mockResolvedValueOnce(null)
				.mockResolvedValueOnce(acceptedReverseFollow);

			// When & Then
			await expect(
				service.sendRequest(mockUserId, mockTargetUserId),
			).rejects.toThrow(BusinessException);
		});

		describe("리소스 제한", () => {
			it("Free 유저가 친구 한도에 도달하면 요청이 거부된다", async () => {
				// Given
				entitlementService.getResourceLimit.mockResolvedValue({
					maxCount: FOLLOW_LIMITS.FREE_MAX_FRIENDS,
					isAdmin: false,
					subscriptionStatus: "FREE",
				});
				followRepo.countMutualFriends.mockResolvedValue(
					FOLLOW_LIMITS.FREE_MAX_FRIENDS,
				);
				entitlementService.enforceResourceLimit.mockImplementation(
					(current, max, factory) => {
						if (max !== null && current >= max) {
							throw factory(current, max);
						}
					},
				);

				// When & Then
				await expect(
					service.sendRequest(mockUserId, mockTargetUserId),
				).rejects.toThrow(BusinessException);
				expect(followRepo.userExists).not.toHaveBeenCalled();
			});

			it("Premium 유저는 제한 없이 친구 요청을 보낼 수 있다", async () => {
				// Given
				entitlementService.getResourceLimit.mockResolvedValue({
					maxCount: null,
					isAdmin: false,
					subscriptionStatus: "ACTIVE",
				});
				followRepo.countMutualFriends.mockResolvedValue(20);

				const mockFollow = FollowBuilder.create(mockUserId, mockTargetUserId)
					.pending()
					.build();
				followRepo.userExists.mockResolvedValue(true);
				followRepo.findByFollowerAndFollowing.mockResolvedValue(null);
				followRepo.create.mockResolvedValue(mockFollow);
				followRepo.getUserName.mockResolvedValue("테스트 유저");

				// When
				const result = await service.sendRequest(mockUserId, mockTargetUserId);

				// Then
				expect(result.follow).toEqual(mockFollow);
				expect(result.autoAccepted).toBe(false);
			});

			it("getResourceLimit와 countFriends가 병렬로 호출된다", async () => {
				// Given — 두 호출 모두 실행 순서에 무관하게 결과 반환
				entitlementService.getResourceLimit.mockResolvedValue({
					maxCount: null,
					isAdmin: false,
					subscriptionStatus: "ACTIVE",
				});
				followRepo.countMutualFriends.mockResolvedValue(2);

				const mockFollow = FollowBuilder.create(mockUserId, mockTargetUserId)
					.pending()
					.build();
				followRepo.userExists.mockResolvedValue(true);
				followRepo.findByFollowerAndFollowing.mockResolvedValue(null);
				followRepo.create.mockResolvedValue(mockFollow);
				followRepo.getUserName.mockResolvedValue("테스트 유저");

				// When
				await service.sendRequest(mockUserId, mockTargetUserId);

				// Then — 두 호출 모두 enforceResourceLimit 전에 수행됨
				expect(entitlementService.getResourceLimit).toHaveBeenCalledWith(
					mockUserId,
					"FRIEND",
				);
				expect(followRepo.countMutualFriends).toHaveBeenCalledWith(mockUserId);
				expect(entitlementService.enforceResourceLimit).toHaveBeenCalledWith(
					2,
					null,
					expect.any(Function),
				);
			});
		});
	});

	// ============================================
	// acceptRequest
	// ============================================

	describe("acceptRequest", () => {
		/**
		 * acceptRequest 성공 시나리오 mock 설정 헬퍼
		 */
		const setupAcceptRequestSuccess = (
			pendingRequest: Follow,
			createdFollow: FollowWithUser,
		) => {
			followRepo.findByFollowerAndFollowing
				.mockResolvedValueOnce(pendingRequest) // 받은 요청 확인
				.mockResolvedValueOnce(null); // 역방향 없음
			followRepo.update.mockResolvedValue({
				...pendingRequest,
				status: "ACCEPTED",
			});
			followRepo.create.mockResolvedValue(createdFollow);
			followRepo.findByIdWithUser.mockResolvedValue(createdFollow);
			followRepo.getUserName.mockImplementation((userId: string) => {
				if (userId === mockUserId) return Promise.resolve("테스트 유저");
				if (userId === mockTargetUserId) return Promise.resolve("타겟 유저");
				return Promise.resolve(null);
			});
			cacheService.invalidateMutualFriend.mockResolvedValue(undefined);
		};

		it("친구 요청을 수락하면 양방향 ACCEPTED 관계가 생성된다", async () => {
			// Given
			const pendingRequest = FollowBuilder.create(mockTargetUserId, mockUserId)
				.withId("pending-request-id")
				.pending()
				.build();

			const createdFollow: FollowWithUser = {
				id: "new-follow-id",
				followerId: mockUserId,
				followingId: mockTargetUserId,
				status: "ACCEPTED",
				createdAt: new Date(),
				updatedAt: new Date(),
				follower: {
					id: mockUserId,
					userTag: "user123",
					profile: { name: "테스트 유저", profileImage: null },
				},
				following: {
					id: mockTargetUserId,
					userTag: "target456",
					profile: { name: "타겟 유저", profileImage: null },
				},
			};

			setupAcceptRequestSuccess(pendingRequest, createdFollow);

			// When
			await service.acceptRequest(mockUserId, mockTargetUserId);

			// Then
			expect(followRepo.update).toHaveBeenCalledWith(
				pendingRequest.id,
				{ status: "ACCEPTED" },
				expect.anything(), // 트랜잭션 컨텍스트
			);
			expect(followRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({
					follower: { connect: { id: mockUserId } },
					following: { connect: { id: mockTargetUserId } },
					status: "ACCEPTED",
				}),
				expect.anything(), // 트랜잭션 컨텍스트
			);
		});

		it("역방향 관계가 이미 존재하면 ACCEPTED로 업데이트한다", async () => {
			// Given
			const pendingRequest = FollowBuilder.create(mockTargetUserId, mockUserId)
				.withId("pending-request-id")
				.pending()
				.build();

			const existingReverseFollow = FollowBuilder.create(
				mockUserId,
				mockTargetUserId,
			)
				.withId("existing-reverse-id")
				.pending()
				.build();

			const updatedFollow: FollowWithUser = {
				...existingReverseFollow,
				status: "ACCEPTED",
				follower: {
					id: mockUserId,
					userTag: "user123",
					profile: { name: "테스트 유저", profileImage: null },
				},
				following: {
					id: mockTargetUserId,
					userTag: "target456",
					profile: { name: "타겟 유저", profileImage: null },
				},
			};

			followRepo.findByFollowerAndFollowing
				.mockResolvedValueOnce(pendingRequest) // 받은 요청 확인
				.mockResolvedValueOnce(existingReverseFollow); // 역방향 존재
			followRepo.update.mockResolvedValue({
				...pendingRequest,
				status: "ACCEPTED",
			});
			followRepo.findByIdWithUser.mockResolvedValue(updatedFollow);
			followRepo.getUserName.mockResolvedValue("테스트 유저");
			cacheService.invalidateMutualFriend.mockResolvedValue(undefined);

			// When
			await service.acceptRequest(mockUserId, mockTargetUserId);

			// Then
			expect(followRepo.update).toHaveBeenCalledTimes(2);
			expect(followRepo.update).toHaveBeenNthCalledWith(
				2,
				existingReverseFollow.id,
				{ status: "ACCEPTED" },
				expect.anything(), // 트랜잭션 컨텍스트
			);
			expect(followRepo.create).not.toHaveBeenCalled();
		});

		it("요청이 존재하지 않으면 FOLLOW_0903 에러를 던진다", async () => {
			// Given
			followRepo.findByFollowerAndFollowing.mockResolvedValue(null);

			// When & Then
			await expect(
				service.acceptRequest(mockUserId, mockTargetUserId),
			).rejects.toThrow(BusinessException);
		});

		it("요청이 PENDING 상태가 아니면 FOLLOW_0903 에러를 던진다", async () => {
			// Given
			const acceptedRequest = FollowBuilder.create(mockTargetUserId, mockUserId)
				.withId("pending-request-id")
				.accepted()
				.build();
			followRepo.findByFollowerAndFollowing.mockResolvedValue(acceptedRequest);

			// When & Then
			await expect(
				service.acceptRequest(mockUserId, mockTargetUserId),
			).rejects.toThrow(BusinessException);
		});
	});

	// ============================================
	// rejectRequest
	// ============================================

	describe("rejectRequest", () => {
		it("친구 요청을 거절하면 삭제된다", async () => {
			// Given
			const pendingRequest = FollowBuilder.create(mockTargetUserId, mockUserId)
				.withId("pending-request-id")
				.pending()
				.build();
			followRepo.findByFollowerAndFollowing.mockResolvedValue(pendingRequest);
			followRepo.delete.mockResolvedValue(pendingRequest);

			// When
			await service.rejectRequest(mockUserId, mockTargetUserId);

			// Then
			expect(followRepo.delete).toHaveBeenCalledWith(pendingRequest.id);
		});

		it("요청이 존재하지 않으면 FOLLOW_0903 에러를 던진다", async () => {
			// Given
			followRepo.findByFollowerAndFollowing.mockResolvedValue(null);

			// When & Then
			await expect(
				service.rejectRequest(mockUserId, mockTargetUserId),
			).rejects.toThrow(BusinessException);
		});

		it("요청이 PENDING 상태가 아니면 FOLLOW_0903 에러를 던진다", async () => {
			// Given
			const acceptedRequest = FollowBuilder.create(mockTargetUserId, mockUserId)
				.withId("pending-request-id")
				.accepted()
				.build();
			followRepo.findByFollowerAndFollowing.mockResolvedValue(acceptedRequest);

			// When & Then
			await expect(
				service.rejectRequest(mockUserId, mockTargetUserId),
			).rejects.toThrow(BusinessException);
		});
	});

	// ============================================
	// remove
	// ============================================

	describe("remove", () => {
		it("친구 관계를 삭제하면 양방향 모두 삭제된다", async () => {
			// Given
			const myFollow = FollowBuilder.create(mockUserId, mockTargetUserId)
				.withId("my-follow-id")
				.accepted()
				.build();

			const theirFollow = FollowBuilder.create(mockTargetUserId, mockUserId)
				.withId("their-follow-id")
				.accepted()
				.build();

			followRepo.findByFollowerAndFollowing
				.mockResolvedValueOnce(myFollow) // 내 관계 확인
				.mockResolvedValueOnce(theirFollow); // 상대방 관계 확인
			followRepo.delete.mockResolvedValue(myFollow);
			cacheService.invalidateMutualFriend.mockResolvedValue(undefined);

			// When
			await service.remove(mockUserId, mockTargetUserId);

			// Then
			expect(followRepo.delete).toHaveBeenCalledTimes(2);
			expect(followRepo.delete).toHaveBeenNthCalledWith(
				1,
				myFollow.id,
				expect.anything(), // 트랜잭션 컨텍스트
			);
			expect(followRepo.delete).toHaveBeenNthCalledWith(
				2,
				theirFollow.id,
				expect.anything(), // 트랜잭션 컨텍스트
			);
		});

		it("상대방의 관계가 없어도 내 관계만 삭제된다", async () => {
			// Given
			const myFollow = FollowBuilder.create(mockUserId, mockTargetUserId)
				.withId("my-follow-id")
				.accepted()
				.build();

			followRepo.findByFollowerAndFollowing
				.mockResolvedValueOnce(myFollow)
				.mockResolvedValueOnce(null); // 상대방 관계 없음
			followRepo.delete.mockResolvedValue(myFollow);
			cacheService.invalidateMutualFriend.mockResolvedValue(undefined);

			// When
			await service.remove(mockUserId, mockTargetUserId);

			// Then
			expect(followRepo.delete).toHaveBeenCalledTimes(1);
			expect(followRepo.delete).toHaveBeenCalledWith(
				myFollow.id,
				expect.anything(), // 트랜잭션 컨텍스트
			);
		});

		it("내 관계가 없으면 FOLLOW_0907 에러를 던진다", async () => {
			// Given
			followRepo.findByFollowerAndFollowing.mockResolvedValue(null);

			// When & Then
			await expect(
				service.remove(mockUserId, mockTargetUserId),
			).rejects.toThrow(BusinessException);
		});
	});

	// ============================================
	// getFriends
	// ============================================

	describe("getFriends", () => {
		/**
		 * FollowWithUser 테스트 데이터 생성 헬퍼
		 */
		const createFollowWithUser = (
			followerId: string,
			followingId: string,
			id?: string,
		): FollowWithUser => {
			const follow = FollowBuilder.create(followerId, followingId)
				.withId(id ?? `follow-${followingId}`)
				.accepted()
				.build();

			return {
				...follow,
				follower: {
					id: followerId,
					userTag: "user123",
					profile: { name: "테스트 유저", profileImage: null },
				},
				following: {
					id: followingId,
					userTag: "target456",
					profile: { name: "타겟 유저", profileImage: null },
				},
			};
		};

		it("친구 목록을 페이지네이션하여 반환한다", async () => {
			// Given
			const mockFriends: FollowWithUser[] = [
				createFollowWithUser(mockUserId, mockTargetUserId),
				createFollowWithUser(mockUserId, "user-789", "friend-2"),
			];

			const mockPaginatedResponse = {
				items: mockFriends,
				pagination: {
					nextCursor: "friend-2",
					hasNext: false,
					size: 20,
				},
			};

			paginationService.normalizeCursorPagination.mockReturnValue({
				cursor: undefined,
				size: 20,
				take: 21,
			});
			followRepo.findMutualFriends.mockResolvedValue(mockFriends);
			paginationService.createCursorPaginatedResponse.mockReturnValue(
				mockPaginatedResponse,
			);

			const params = { userId: mockUserId };

			// When
			const result = await service.getFriends(params);

			// Then
			expect(result).toEqual(mockPaginatedResponse);
			expect(followRepo.findMutualFriends).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: mockUserId,
					size: 20,
				}),
			);
		});

		it("커서와 크기를 지정하여 조회할 수 있다", async () => {
			// Given
			const params = {
				userId: mockUserId,
				cursor: "some-cursor",
				size: 10,
			};

			paginationService.normalizeCursorPagination.mockReturnValue({
				cursor: "some-cursor",
				size: 10,
				take: 11,
			});
			followRepo.findMutualFriends.mockResolvedValue([]);
			paginationService.createCursorPaginatedResponse.mockReturnValue({
				items: [],
				pagination: {
					nextCursor: null,
					hasNext: false,
					size: 10,
				},
			});

			// When
			await service.getFriends(params);

			// Then
			expect(followRepo.findMutualFriends).toHaveBeenCalledWith(
				expect.objectContaining({
					cursor: "some-cursor",
					size: 10,
				}),
			);
		});

		it("search 파라미터가 Repository에 전달된다", async () => {
			// Given
			const params = { userId: mockUserId, search: "TEST" };

			paginationService.normalizeCursorPagination.mockReturnValue({
				cursor: undefined,
				size: 20,
				take: 21,
			});
			followRepo.findMutualFriends.mockResolvedValue([]);
			paginationService.createCursorPaginatedResponse.mockReturnValue({
				items: [],
				pagination: {
					nextCursor: null,
					hasNext: false,
					size: 20,
				},
			});

			// When
			await service.getFriends(params);

			// Then
			expect(followRepo.findMutualFriends).toHaveBeenCalledWith(
				expect.objectContaining({ search: "TEST" }),
			);
		});

		it("search가 없으면 undefined로 전달된다", async () => {
			// Given
			const params = { userId: mockUserId };

			paginationService.normalizeCursorPagination.mockReturnValue({
				cursor: undefined,
				size: 20,
				take: 21,
			});
			followRepo.findMutualFriends.mockResolvedValue([]);
			paginationService.createCursorPaginatedResponse.mockReturnValue({
				items: [],
				pagination: {
					nextCursor: null,
					hasNext: false,
					size: 20,
				},
			});

			// When
			await service.getFriends(params);

			// Then
			expect(followRepo.findMutualFriends).toHaveBeenCalledWith(
				expect.objectContaining({ search: undefined }),
			);
		});
	});

	// ============================================
	// getReceivedRequests
	// ============================================

	describe("getReceivedRequests", () => {
		it("받은 친구 요청 목록을 페이지네이션하여 반환한다", async () => {
			// Given
			const mockRequests: FollowWithUser[] = [];
			const mockPaginatedResponse = {
				items: mockRequests,
				pagination: {
					nextCursor: null,
					hasNext: false,
					size: 20,
				},
			};

			paginationService.normalizeCursorPagination.mockReturnValue({
				cursor: undefined,
				size: 20,
				take: 21,
			});
			followRepo.findReceivedRequests.mockResolvedValue(mockRequests);
			paginationService.createCursorPaginatedResponse.mockReturnValue(
				mockPaginatedResponse,
			);

			const params = { userId: mockUserId };

			// When
			const result = await service.getReceivedRequests(params);

			// Then
			expect(result).toEqual(mockPaginatedResponse);
			expect(followRepo.findReceivedRequests).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: mockUserId,
				}),
			);
		});
	});

	// ============================================
	// getSentRequests
	// ============================================

	describe("getSentRequests", () => {
		it("보낸 친구 요청 목록을 페이지네이션하여 반환한다", async () => {
			// Given
			const mockRequests: FollowWithUser[] = [];
			const mockPaginatedResponse = {
				items: mockRequests,
				pagination: {
					nextCursor: null,
					hasNext: false,
					size: 20,
				},
			};

			paginationService.normalizeCursorPagination.mockReturnValue({
				cursor: undefined,
				size: 20,
				take: 21,
			});
			followRepo.findSentRequests.mockResolvedValue(mockRequests);
			paginationService.createCursorPaginatedResponse.mockReturnValue(
				mockPaginatedResponse,
			);

			const params = { userId: mockUserId };

			// When
			const result = await service.getSentRequests(params);

			// Then
			expect(result).toEqual(mockPaginatedResponse);
			expect(followRepo.findSentRequests).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: mockUserId,
				}),
			);
		});
	});

	// ============================================
	// isMutualFriend
	// ============================================

	describe("isMutualFriend", () => {
		it("맞팔 관계이면 true를 반환한다", async () => {
			// Given
			cacheService.getMutualFriend.mockResolvedValue(undefined);
			followRepo.isMutualFriend.mockResolvedValue(true);
			cacheService.setMutualFriend.mockResolvedValue(undefined);

			// When
			const result = await service.isMutualFriend(mockUserId, mockTargetUserId);

			// Then
			expect(result).toBe(true);
			expect(followRepo.isMutualFriend).toHaveBeenCalledWith(
				mockUserId,
				mockTargetUserId,
			);
		});

		it("맞팔 관계가 아니면 false를 반환한다", async () => {
			// Given
			cacheService.getMutualFriend.mockResolvedValue(undefined);
			followRepo.isMutualFriend.mockResolvedValue(false);
			cacheService.setMutualFriend.mockResolvedValue(undefined);

			// When
			const result = await service.isMutualFriend(mockUserId, mockTargetUserId);

			// Then
			expect(result).toBe(false);
		});

		it("캐시된 결과가 있으면 캐시에서 반환한다", async () => {
			// Given
			cacheService.getMutualFriend.mockResolvedValue(true);

			// When
			const result = await service.isMutualFriend(mockUserId, mockTargetUserId);

			// Then
			expect(result).toBe(true);
			expect(followRepo.isMutualFriend).not.toHaveBeenCalled();
		});
	});

	// ============================================
	// countFriends
	// ============================================

	describe("countFriends", () => {
		it("친구 수를 반환한다 (캐시 wrap)", async () => {
			// Given
			followRepo.countMutualFriends.mockResolvedValue(5);

			// When
			const result = await service.countFriends(mockUserId);

			// Then
			expect(result).toBe(5);
			expect(cacheService.wrapFriendCount).toHaveBeenCalledWith(
				mockUserId,
				expect.any(Function),
			);
		});
	});

	// ============================================
	// countReceivedRequests
	// ============================================

	describe("countReceivedRequests", () => {
		it("받은 친구 요청 수를 반환한다", async () => {
			// Given
			followRepo.countReceivedRequests.mockResolvedValue(3);

			// When
			const result = await service.countReceivedRequests(mockUserId);

			// Then
			expect(result).toBe(3);
			expect(followRepo.countReceivedRequests).toHaveBeenCalledWith(mockUserId);
		});
	});

	// ============================================
	// countSentRequests
	// ============================================

	describe("countSentRequests", () => {
		it("보낸 친구 요청 수를 반환한다", async () => {
			// Given
			followRepo.countSentRequests.mockResolvedValue(2);

			// When
			const result = await service.countSentRequests(mockUserId);

			// Then
			expect(result).toBe(2);
			expect(followRepo.countSentRequests).toHaveBeenCalledWith(mockUserId);
		});
	});
});
