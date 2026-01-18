import { EventEmitter2 } from "@nestjs/event-emitter";
import { Test, type TestingModule } from "@nestjs/testing";
import { BusinessException } from "@/common/exception/services/business-exception.service";
import { PaginationService } from "@/common/pagination/services/pagination.service";
import { DatabaseService } from "@/database/database.service";
import type { Follow } from "@/generated/prisma/client";

import { FollowRepository } from "./follow.repository";
import { FollowService } from "./follow.service";
import type { FollowWithUser } from "./types/follow.types";

describe("FollowService", () => {
	let service: FollowService;

	// Mock 객체들
	const mockFollowRepository = {
		create: jest.fn(),
		findByFollowerAndFollowing: jest.fn(),
		findById: jest.fn(),
		findByIdWithUser: jest.fn(),
		update: jest.fn(),
		updateByFollowerAndFollowing: jest.fn(),
		delete: jest.fn(),
		deleteByFollowerAndFollowing: jest.fn(),
		findMutualFriends: jest.fn(),
		findReceivedRequests: jest.fn(),
		findSentRequests: jest.fn(),
		isMutualFriend: jest.fn(),
		countMutualFriends: jest.fn(),
		countReceivedRequests: jest.fn(),
		countSentRequests: jest.fn(),
		userExists: jest.fn(),
		getUserName: jest.fn(),
	};

	const mockPaginationService = {
		normalizeCursorPagination: jest.fn(),
		createCursorPaginatedResponse: jest.fn(),
	};

	const mockDatabaseService: { $transaction: jest.Mock } = {
		$transaction: jest.fn(),
	};
	// 순환 참조를 피하기 위해 초기화 후 구현 설정
	mockDatabaseService.$transaction.mockImplementation(
		(callback: (tx: unknown) => Promise<unknown>) =>
			callback(mockDatabaseService),
	);

	const mockEventEmitter = {
		emit: jest.fn(),
	};

	// 테스트 데이터
	const mockUserId = "user-123";
	const mockTargetUserId = "user-456";
	const mockFollowId = "follow-789";

	const mockFollow: Follow = {
		id: mockFollowId,
		followerId: mockUserId,
		followingId: mockTargetUserId,
		status: "PENDING",
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockAcceptedFollow: Follow = {
		...mockFollow,
		status: "ACCEPTED",
	};

	const mockFollowWithUser: FollowWithUser = {
		...mockFollow,
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

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				FollowService,
				{ provide: FollowRepository, useValue: mockFollowRepository },
				{ provide: PaginationService, useValue: mockPaginationService },
				{ provide: DatabaseService, useValue: mockDatabaseService },
				{ provide: EventEmitter2, useValue: mockEventEmitter },
			],
		}).compile();

		service = module.get<FollowService>(FollowService);
	});

	// ============================================
	// sendRequest
	// ============================================

	describe("sendRequest", () => {
		beforeEach(() => {
			mockFollowRepository.userExists.mockResolvedValue(true);
			mockFollowRepository.findByFollowerAndFollowing.mockResolvedValue(null);
			mockFollowRepository.create.mockResolvedValue(mockFollow);
		});

		it("새로운 친구 요청을 보내면 PENDING 상태로 생성된다", async () => {
			// Given
			// - beforeEach에서 기본 mock 설정됨

			// When
			const result = await service.sendRequest(mockUserId, mockTargetUserId);

			// Then
			expect(result.follow).toEqual(mockFollow);
			expect(result.autoAccepted).toBe(false);
			expect(mockFollowRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({
					follower: { connect: { id: mockUserId } },
					following: { connect: { id: mockTargetUserId } },
					status: "PENDING",
				}),
			);
		});

		it("자기 자신에게 요청하면 FOLLOW_0904 에러를 던진다", async () => {
			// Given
			// - 자기 자신에게 요청

			// When & Then
			await expect(service.sendRequest(mockUserId, mockUserId)).rejects.toThrow(
				BusinessException,
			);
		});

		it("존재하지 않는 사용자에게 요청하면 FOLLOW_0905 에러를 던진다", async () => {
			// Given
			mockFollowRepository.userExists.mockResolvedValue(false);

			// When & Then
			await expect(
				service.sendRequest(mockUserId, "non-existent-user"),
			).rejects.toThrow(BusinessException);
		});

		it("이미 친구인 경우 FOLLOW_0902 에러를 던진다", async () => {
			// Given
			mockFollowRepository.findByFollowerAndFollowing.mockResolvedValue(
				mockAcceptedFollow,
			);

			// When & Then
			await expect(
				service.sendRequest(mockUserId, mockTargetUserId),
			).rejects.toThrow(BusinessException);
		});

		it("이미 요청을 보낸 경우 FOLLOW_0901 에러를 던진다", async () => {
			// Given
			mockFollowRepository.findByFollowerAndFollowing.mockResolvedValue(
				mockFollow,
			); // PENDING 상태

			// When & Then
			await expect(
				service.sendRequest(mockUserId, mockTargetUserId),
			).rejects.toThrow(BusinessException);
		});

		it("상대방이 이미 요청을 보낸 경우 자동 수락된다", async () => {
			// Given
			const reverseFollow: Follow = {
				id: "reverse-follow-id",
				followerId: mockTargetUserId,
				followingId: mockUserId,
				status: "PENDING",
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			// 내가 보낸 요청은 없음
			mockFollowRepository.findByFollowerAndFollowing
				.mockResolvedValueOnce(null) // userId -> targetUserId 조회
				.mockResolvedValueOnce(reverseFollow); // targetUserId -> userId 조회

			mockFollowRepository.updateByFollowerAndFollowing.mockResolvedValue({
				...reverseFollow,
				status: "ACCEPTED",
			});

			const autoAcceptedFollow: Follow = {
				...mockFollow,
				status: "ACCEPTED",
			};
			mockFollowRepository.create.mockResolvedValue(autoAcceptedFollow);

			// When
			const result = await service.sendRequest(mockUserId, mockTargetUserId);

			// Then
			expect(result.autoAccepted).toBe(true);
			expect(result.follow.status).toBe("ACCEPTED");
			expect(
				mockFollowRepository.updateByFollowerAndFollowing,
			).toHaveBeenCalledWith(
				mockTargetUserId,
				mockUserId,
				{ status: "ACCEPTED" },
				expect.anything(), // 트랜잭션 컨텍스트
			);
			expect(mockFollowRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({
					status: "ACCEPTED",
				}),
				expect.anything(), // 트랜잭션 컨텍스트
			);
		});

		it("상대방이 이미 ACCEPTED 상태면 FOLLOW_0902 에러를 던진다", async () => {
			// Given
			const acceptedReverseFollow: Follow = {
				id: "reverse-follow-id",
				followerId: mockTargetUserId,
				followingId: mockUserId,
				status: "ACCEPTED",
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockFollowRepository.findByFollowerAndFollowing
				.mockResolvedValueOnce(null)
				.mockResolvedValueOnce(acceptedReverseFollow);

			// When & Then
			await expect(
				service.sendRequest(mockUserId, mockTargetUserId),
			).rejects.toThrow(BusinessException);
		});
	});

	// ============================================
	// acceptRequest
	// ============================================

	describe("acceptRequest", () => {
		const pendingRequest: Follow = {
			id: "pending-request-id",
			followerId: mockTargetUserId,
			followingId: mockUserId,
			status: "PENDING",
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		beforeEach(() => {
			mockFollowRepository.findByFollowerAndFollowing.mockResolvedValue(
				pendingRequest,
			);
			mockFollowRepository.update.mockResolvedValue({
				...pendingRequest,
				status: "ACCEPTED",
			});
			// acceptRequest에서 이벤트 발행을 위해 사용자 이름 조회
			mockFollowRepository.getUserName.mockImplementation((userId: string) => {
				if (userId === mockUserId) return Promise.resolve("테스트 유저");
				if (userId === mockTargetUserId) return Promise.resolve("타겟 유저");
				return Promise.resolve(null);
			});
		});

		it("친구 요청을 수락하면 양방향 ACCEPTED 관계가 생성된다", async () => {
			// Given
			mockFollowRepository.findByFollowerAndFollowing
				.mockResolvedValueOnce(pendingRequest) // 받은 요청 확인
				.mockResolvedValueOnce(null); // 역방향 없음

			const createdFollow = {
				id: "new-follow-id",
				followerId: mockUserId,
				followingId: mockTargetUserId,
				status: "ACCEPTED",
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			mockFollowRepository.create.mockResolvedValue(createdFollow);
			mockFollowRepository.findByIdWithUser.mockResolvedValue({
				...createdFollow,
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
			});

			// When
			await service.acceptRequest(mockUserId, mockTargetUserId);

			// Then
			expect(mockFollowRepository.update).toHaveBeenCalledWith(
				pendingRequest.id,
				{ status: "ACCEPTED" },
				expect.anything(), // 트랜잭션 컨텍스트
			);
			expect(mockFollowRepository.create).toHaveBeenCalledWith(
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
			const existingReverseFollow: Follow = {
				id: "existing-reverse-id",
				followerId: mockUserId,
				followingId: mockTargetUserId,
				status: "PENDING",
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockFollowRepository.findByFollowerAndFollowing
				.mockResolvedValueOnce(pendingRequest) // 받은 요청 확인
				.mockResolvedValueOnce(existingReverseFollow); // 역방향 존재

			mockFollowRepository.findByIdWithUser.mockResolvedValue({
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
			});

			// When
			await service.acceptRequest(mockUserId, mockTargetUserId);

			// Then
			expect(mockFollowRepository.update).toHaveBeenCalledTimes(2);
			expect(mockFollowRepository.update).toHaveBeenNthCalledWith(
				2,
				existingReverseFollow.id,
				{ status: "ACCEPTED" },
				expect.anything(), // 트랜잭션 컨텍스트
			);
			expect(mockFollowRepository.create).not.toHaveBeenCalled();
		});

		it("요청이 존재하지 않으면 FOLLOW_0903 에러를 던진다", async () => {
			// Given
			mockFollowRepository.findByFollowerAndFollowing.mockResolvedValue(null);

			// When & Then
			await expect(
				service.acceptRequest(mockUserId, mockTargetUserId),
			).rejects.toThrow(BusinessException);
		});

		it("요청이 PENDING 상태가 아니면 FOLLOW_0903 에러를 던진다", async () => {
			// Given
			const acceptedRequest: Follow = {
				...pendingRequest,
				status: "ACCEPTED",
			};
			mockFollowRepository.findByFollowerAndFollowing.mockResolvedValue(
				acceptedRequest,
			);

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
		const pendingRequest: Follow = {
			id: "pending-request-id",
			followerId: mockTargetUserId,
			followingId: mockUserId,
			status: "PENDING",
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		beforeEach(() => {
			mockFollowRepository.findByFollowerAndFollowing.mockResolvedValue(
				pendingRequest,
			);
			mockFollowRepository.delete.mockResolvedValue(pendingRequest);
		});

		it("친구 요청을 거절하면 삭제된다", async () => {
			// Given
			// - beforeEach에서 설정됨

			// When
			await service.rejectRequest(mockUserId, mockTargetUserId);

			// Then
			expect(mockFollowRepository.delete).toHaveBeenCalledWith(
				pendingRequest.id,
			);
		});

		it("요청이 존재하지 않으면 FOLLOW_0903 에러를 던진다", async () => {
			// Given
			mockFollowRepository.findByFollowerAndFollowing.mockResolvedValue(null);

			// When & Then
			await expect(
				service.rejectRequest(mockUserId, mockTargetUserId),
			).rejects.toThrow(BusinessException);
		});

		it("요청이 PENDING 상태가 아니면 FOLLOW_0903 에러를 던진다", async () => {
			// Given
			const acceptedRequest: Follow = {
				...pendingRequest,
				status: "ACCEPTED",
			};
			mockFollowRepository.findByFollowerAndFollowing.mockResolvedValue(
				acceptedRequest,
			);

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
		const myFollow: Follow = {
			id: "my-follow-id",
			followerId: mockUserId,
			followingId: mockTargetUserId,
			status: "ACCEPTED",
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const theirFollow: Follow = {
			id: "their-follow-id",
			followerId: mockTargetUserId,
			followingId: mockUserId,
			status: "ACCEPTED",
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		beforeEach(() => {
			mockFollowRepository.findByFollowerAndFollowing
				.mockResolvedValueOnce(myFollow) // 내 관계 확인
				.mockResolvedValueOnce(theirFollow); // 상대방 관계 확인
			mockFollowRepository.delete.mockResolvedValue(myFollow);
		});

		it("친구 관계를 삭제하면 양방향 모두 삭제된다", async () => {
			// Given
			// - beforeEach에서 설정됨

			// When
			await service.remove(mockUserId, mockTargetUserId);

			// Then
			expect(mockFollowRepository.delete).toHaveBeenCalledTimes(2);
			expect(mockFollowRepository.delete).toHaveBeenNthCalledWith(
				1,
				myFollow.id,
				expect.anything(), // 트랜잭션 컨텍스트
			);
			expect(mockFollowRepository.delete).toHaveBeenNthCalledWith(
				2,
				theirFollow.id,
				expect.anything(), // 트랜잭션 컨텍스트
			);
		});

		it("상대방의 관계가 없어도 내 관계만 삭제된다", async () => {
			// Given
			mockFollowRepository.findByFollowerAndFollowing
				.mockReset()
				.mockResolvedValueOnce(myFollow)
				.mockResolvedValueOnce(null); // 상대방 관계 없음

			// When
			await service.remove(mockUserId, mockTargetUserId);

			// Then
			expect(mockFollowRepository.delete).toHaveBeenCalledTimes(1);
			expect(mockFollowRepository.delete).toHaveBeenCalledWith(
				myFollow.id,
				expect.anything(), // 트랜잭션 컨텍스트
			);
		});

		it("내 관계가 없으면 FOLLOW_0907 에러를 던진다", async () => {
			// Given
			mockFollowRepository.findByFollowerAndFollowing
				.mockReset()
				.mockResolvedValue(null);

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
		const mockFriends: FollowWithUser[] = [
			mockFollowWithUser,
			{
				...mockFollowWithUser,
				id: "friend-2",
				followingId: "user-789",
				following: {
					id: "user-789",
					userTag: "friend789",
					profile: { name: "친구 2", profileImage: null },
				},
			},
		];

		const mockPaginatedResponse = {
			items: mockFriends,
			pagination: {
				nextCursor: "friend-2",
				prevCursor: null,
				hasNext: false,
				hasPrevious: false,
			},
		};

		beforeEach(() => {
			mockPaginationService.normalizeCursorPagination.mockReturnValue({
				cursor: undefined,
				size: 20,
			});
			mockFollowRepository.findMutualFriends.mockResolvedValue(mockFriends);
			mockPaginationService.createCursorPaginatedResponse.mockReturnValue(
				mockPaginatedResponse,
			);
		});

		it("친구 목록을 페이지네이션하여 반환한다", async () => {
			// Given
			const params = { userId: mockUserId };

			// When
			const result = await service.getFriends(params);

			// Then
			expect(result).toEqual(mockPaginatedResponse);
			expect(mockFollowRepository.findMutualFriends).toHaveBeenCalledWith(
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

			mockPaginationService.normalizeCursorPagination.mockReturnValue({
				cursor: "some-cursor",
				size: 10,
			});

			// When
			await service.getFriends(params);

			// Then
			expect(mockFollowRepository.findMutualFriends).toHaveBeenCalledWith(
				expect.objectContaining({
					cursor: "some-cursor",
					size: 10,
				}),
			);
		});
	});

	// ============================================
	// getReceivedRequests
	// ============================================

	describe("getReceivedRequests", () => {
		const mockRequests: FollowWithUser[] = [mockFollowWithUser];

		const mockPaginatedResponse = {
			items: mockRequests,
			pagination: {
				nextCursor: null,
				prevCursor: null,
				hasNext: false,
				hasPrevious: false,
			},
		};

		beforeEach(() => {
			mockPaginationService.normalizeCursorPagination.mockReturnValue({
				cursor: undefined,
				size: 20,
			});
			mockFollowRepository.findReceivedRequests.mockResolvedValue(mockRequests);
			mockPaginationService.createCursorPaginatedResponse.mockReturnValue(
				mockPaginatedResponse,
			);
		});

		it("받은 친구 요청 목록을 페이지네이션하여 반환한다", async () => {
			// Given
			const params = { userId: mockUserId };

			// When
			const result = await service.getReceivedRequests(params);

			// Then
			expect(result).toEqual(mockPaginatedResponse);
			expect(mockFollowRepository.findReceivedRequests).toHaveBeenCalledWith(
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
		const mockRequests: FollowWithUser[] = [mockFollowWithUser];

		const mockPaginatedResponse = {
			items: mockRequests,
			pagination: {
				nextCursor: null,
				prevCursor: null,
				hasNext: false,
				hasPrevious: false,
			},
		};

		beforeEach(() => {
			mockPaginationService.normalizeCursorPagination.mockReturnValue({
				cursor: undefined,
				size: 20,
			});
			mockFollowRepository.findSentRequests.mockResolvedValue(mockRequests);
			mockPaginationService.createCursorPaginatedResponse.mockReturnValue(
				mockPaginatedResponse,
			);
		});

		it("보낸 친구 요청 목록을 페이지네이션하여 반환한다", async () => {
			// Given
			const params = { userId: mockUserId };

			// When
			const result = await service.getSentRequests(params);

			// Then
			expect(result).toEqual(mockPaginatedResponse);
			expect(mockFollowRepository.findSentRequests).toHaveBeenCalledWith(
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
			mockFollowRepository.isMutualFriend.mockResolvedValue(true);

			// When
			const result = await service.isMutualFriend(mockUserId, mockTargetUserId);

			// Then
			expect(result).toBe(true);
			expect(mockFollowRepository.isMutualFriend).toHaveBeenCalledWith(
				mockUserId,
				mockTargetUserId,
			);
		});

		it("맞팔 관계가 아니면 false를 반환한다", async () => {
			// Given
			mockFollowRepository.isMutualFriend.mockResolvedValue(false);

			// When
			const result = await service.isMutualFriend(mockUserId, mockTargetUserId);

			// Then
			expect(result).toBe(false);
		});
	});

	// ============================================
	// countFriends
	// ============================================

	describe("countFriends", () => {
		it("친구 수를 반환한다", async () => {
			// Given
			mockFollowRepository.countMutualFriends.mockResolvedValue(5);

			// When
			const result = await service.countFriends(mockUserId);

			// Then
			expect(result).toBe(5);
			expect(mockFollowRepository.countMutualFriends).toHaveBeenCalledWith(
				mockUserId,
			);
		});
	});

	// ============================================
	// countReceivedRequests
	// ============================================

	describe("countReceivedRequests", () => {
		it("받은 친구 요청 수를 반환한다", async () => {
			// Given
			mockFollowRepository.countReceivedRequests.mockResolvedValue(3);

			// When
			const result = await service.countReceivedRequests(mockUserId);

			// Then
			expect(result).toBe(3);
			expect(mockFollowRepository.countReceivedRequests).toHaveBeenCalledWith(
				mockUserId,
			);
		});
	});

	// ============================================
	// countSentRequests
	// ============================================

	describe("countSentRequests", () => {
		it("보낸 친구 요청 수를 반환한다", async () => {
			// Given
			mockFollowRepository.countSentRequests.mockResolvedValue(2);

			// When
			const result = await service.countSentRequests(mockUserId);

			// Then
			expect(result).toBe(2);
			expect(mockFollowRepository.countSentRequests).toHaveBeenCalledWith(
				mockUserId,
			);
		});
	});
});
