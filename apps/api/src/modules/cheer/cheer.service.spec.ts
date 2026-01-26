import { CHEER_LIMITS } from "@aido/validators";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Test, TestingModule } from "@nestjs/testing";
import { CacheService } from "@/common/cache/cache.service";
import { PaginationService } from "@/common/pagination/services/pagination.service";
import { DatabaseService } from "@/database/database.service";
import { FollowService } from "@/modules/follow/follow.service";
import { NotificationEvents } from "@/modules/notification/events";

import { CheerRepository } from "./cheer.repository";
import { CheerService } from "./cheer.service";
import type { CheerWithRelations } from "./types";

// =============================================================================
// Mock Factory Functions
// =============================================================================

function createMockCheer(
	overrides: {
		id?: number;
		senderId?: string;
		receiverId?: string;
		message?: string | null;
		createdAt?: Date;
		readAt?: Date | null;
	} = {},
) {
	return {
		id: overrides.id ?? 1,
		senderId: overrides.senderId ?? "sender-1",
		receiverId: overrides.receiverId ?? "receiver-1",
		message: "message" in overrides ? overrides.message : "축하해요!",
		createdAt: overrides.createdAt ?? new Date("2024-01-15T10:00:00Z"),
		readAt: overrides.readAt ?? null,
	};
}

function createMockProfile(
	overrides: { name?: string | null; profileImage?: string | null } = {},
) {
	return {
		name: overrides.name ?? "테스트유저",
		profileImage: overrides.profileImage ?? null,
	};
}

function createMockUser(
	overrides: {
		id?: string;
		userTag?: string;
		nickname?: string;
		profile?: { name: string | null; profileImage: string | null } | null;
	} = {},
) {
	return {
		id: overrides.id ?? "user-1",
		userTag: overrides.userTag ?? "user1",
		nickname: overrides.nickname ?? null,
		profile:
			overrides.profile !== undefined ? overrides.profile : createMockProfile(),
	};
}

function createMockCheerWithRelations(
	overrides: {
		id?: number;
		senderId?: string;
		receiverId?: string;
		message?: string | null;
		createdAt?: Date;
		readAt?: Date | null;
		sender?: ReturnType<typeof createMockUser>;
		receiver?: ReturnType<typeof createMockUser>;
	} = {},
): CheerWithRelations {
	const cheer = createMockCheer(overrides);
	return {
		...cheer,
		message: cheer.message ?? null,
		sender:
			overrides.sender ??
			createMockUser({ id: cheer.senderId, userTag: "sender" }),
		receiver:
			overrides.receiver ??
			createMockUser({ id: cheer.receiverId, userTag: "receiver" }),
	};
}

// =============================================================================
// Test Suite
// =============================================================================

describe("CheerService", () => {
	let service: CheerService;
	let mockCheerRepository: {
		create: jest.Mock;
		createWithRelations: jest.Mock;
		findById: jest.Mock;
		findByIdWithRelations: jest.Mock;
		markAsRead: jest.Mock;
		markManyAsRead: jest.Mock;
		findReceivedCheers: jest.Mock;
		findSentCheers: jest.Mock;
		countTodayCheers: jest.Mock;
		findLastCheerToUser: jest.Mock;
		userExists: jest.Mock;
		getUserName: jest.Mock;
		getUserSubscriptionStatus: jest.Mock;
	};
	let mockFollowService: {
		isMutualFriend: jest.Mock;
	};
	let mockPaginationService: {
		normalizeCursorPagination: jest.Mock;
		createCursorPaginatedResponse: jest.Mock;
	};
	let mockEventEmitter: {
		emit: jest.Mock;
	};
	let mockDatabase: {
		$transaction: jest.Mock;
		user: {
			findUnique: jest.Mock;
		};
		cheer: {
			count: jest.Mock;
			findFirst: jest.Mock;
			create: jest.Mock;
		};
	};
	let mockCacheService: {
		getSubscription: jest.Mock;
		setSubscription: jest.Mock;
	};

	beforeEach(async () => {
		mockCheerRepository = {
			create: jest.fn(),
			createWithRelations: jest.fn(),
			findById: jest.fn(),
			findByIdWithRelations: jest.fn(),
			markAsRead: jest.fn(),
			markManyAsRead: jest.fn(),
			findReceivedCheers: jest.fn(),
			findSentCheers: jest.fn(),
			countTodayCheers: jest.fn(),
			findLastCheerToUser: jest.fn(),
			userExists: jest.fn(),
			getUserName: jest.fn(),
			getUserSubscriptionStatus: jest.fn(),
		};

		mockFollowService = {
			isMutualFriend: jest.fn(),
		};

		mockPaginationService = {
			normalizeCursorPagination: jest
				.fn()
				.mockReturnValue({ cursor: undefined, size: 20 }),
			createCursorPaginatedResponse: jest
				.fn()
				.mockImplementation(({ items, size }) => ({
					data: items.slice(0, size),
					meta: {
						hasNextPage: items.length > size,
						nextCursor: items.length > size ? items[size - 1].id : null,
					},
				})),
		};

		mockEventEmitter = {
			emit: jest.fn(),
		};

		// DatabaseService mock: $transaction을 passthrough로 구현
		mockDatabase = {
			$transaction: jest.fn((callback) => callback(mockDatabase)),
			user: {
				findUnique: jest.fn(),
			},
			cheer: {
				count: jest.fn(),
				findFirst: jest.fn(),
				create: jest.fn(),
			},
		};

		// CacheService mock
		mockCacheService = {
			getSubscription: jest.fn().mockResolvedValue(undefined), // 기본: 캐시 미스
			setSubscription: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CheerService,
				{ provide: CheerRepository, useValue: mockCheerRepository },
				{ provide: FollowService, useValue: mockFollowService },
				{ provide: PaginationService, useValue: mockPaginationService },
				{ provide: EventEmitter2, useValue: mockEventEmitter },
				{ provide: DatabaseService, useValue: mockDatabase },
				{ provide: CacheService, useValue: mockCacheService },
			],
		}).compile();

		service = module.get<CheerService>(CheerService);
	});

	// ===========================================================================
	// sendCheer 테스트
	// ===========================================================================

	describe("sendCheer", () => {
		const validParams = {
			senderId: "sender-1",
			receiverId: "receiver-1",
			message: "축하해요!",
		};

		beforeEach(() => {
			// 기본 성공 시나리오 설정
			mockFollowService.isMutualFriend.mockResolvedValue(true);
			mockDatabase.user.findUnique.mockResolvedValue({
				subscriptionStatus: "FREE",
			});
			mockDatabase.cheer.count.mockResolvedValue(0);
			mockDatabase.cheer.findFirst.mockResolvedValue(null);
			mockDatabase.cheer.create.mockResolvedValue(
				createMockCheerWithRelations(validParams),
			);
		});

		describe("자기 자신 체크", () => {
			it("자기 자신에게 응원하면 에러를 던진다", async () => {
				// Given
				const params = {
					senderId: "user-1",
					receiverId: "user-1",
				};

				// When & Then
				await expect(service.sendCheer(params)).rejects.toThrow();
			});
		});

		describe("친구 관계 확인", () => {
			it("친구가 아니면 에러를 던진다", async () => {
				// Given
				mockFollowService.isMutualFriend.mockResolvedValue(false);

				// When & Then
				await expect(service.sendCheer(validParams)).rejects.toThrow();
			});

			it("친구 관계를 올바르게 확인한다", async () => {
				// Given
				const expectedCheer = createMockCheerWithRelations(validParams);
				mockDatabase.cheer.create.mockResolvedValue(expectedCheer);

				// When
				await service.sendCheer(validParams);

				// Then
				expect(mockFollowService.isMutualFriend).toHaveBeenCalledWith(
					validParams.senderId,
					validParams.receiverId,
				);
			});
		});

		describe("일일 제한 체크", () => {
			it("FREE 구독자가 일일 제한에 도달하면 에러를 던진다", async () => {
				// Given
				mockDatabase.user.findUnique.mockResolvedValue({
					subscriptionStatus: "FREE",
				});
				mockDatabase.cheer.count.mockResolvedValue(
					CHEER_LIMITS.FREE_DAILY_LIMIT,
				);

				// When & Then
				await expect(service.sendCheer(validParams)).rejects.toThrow();
			});

			it("ACTIVE 구독자는 일일 제한이 없다", async () => {
				// Given
				mockDatabase.user.findUnique.mockResolvedValue({
					subscriptionStatus: "ACTIVE",
				});
				mockDatabase.cheer.count.mockResolvedValue(100);
				const expectedCheer = createMockCheerWithRelations(validParams);
				mockDatabase.cheer.create.mockResolvedValue(expectedCheer);

				// When
				const result = await service.sendCheer(validParams);

				// Then
				expect(result).toEqual(expectedCheer);
			});

			it("EXPIRED 구독자는 FREE와 동일한 제한을 받는다", async () => {
				// Given
				mockDatabase.user.findUnique.mockResolvedValue({
					subscriptionStatus: "EXPIRED",
				});
				mockDatabase.cheer.count.mockResolvedValue(
					CHEER_LIMITS.FREE_DAILY_LIMIT,
				);

				// When & Then
				await expect(service.sendCheer(validParams)).rejects.toThrow();
			});
		});

		describe("쿨다운 체크", () => {
			it("쿨다운이 활성화되어 있으면 에러를 던진다", async () => {
				// Given
				const recentCheer = createMockCheer({
					createdAt: new Date(), // 방금 생성된 Cheer
				});
				mockDatabase.cheer.findFirst.mockResolvedValue(recentCheer);

				// When & Then
				await expect(service.sendCheer(validParams)).rejects.toThrow();
			});

			it("쿨다운 시간이 지나면 응원을 보낼 수 있다", async () => {
				// Given
				const oldCheer = createMockCheer({
					createdAt: new Date(
						Date.now() - (CHEER_LIMITS.COOLDOWN_HOURS + 1) * 60 * 60 * 1000,
					),
				});
				mockDatabase.cheer.findFirst.mockResolvedValue(oldCheer);
				const expectedCheer = createMockCheerWithRelations(validParams);
				mockDatabase.cheer.create.mockResolvedValue(expectedCheer);

				// When
				const result = await service.sendCheer(validParams);

				// Then
				expect(result).toEqual(expectedCheer);
			});
		});

		describe("Cheer 생성", () => {
			it("모든 검증을 통과하면 Cheer를 생성한다", async () => {
				// Given
				const expectedCheer = createMockCheerWithRelations(validParams);
				mockDatabase.cheer.create.mockResolvedValue(expectedCheer);

				// When
				const result = await service.sendCheer(validParams);

				// Then
				expect(result).toEqual(expectedCheer);
				expect(mockDatabase.cheer.create).toHaveBeenCalledWith({
					data: {
						sender: { connect: { id: validParams.senderId } },
						receiver: { connect: { id: validParams.receiverId } },
						message: validParams.message,
					},
					include: {
						sender: {
							select: {
								id: true,
								userTag: true,
								profile: {
									select: {
										name: true,
										profileImage: true,
									},
								},
							},
						},
						receiver: {
							select: {
								id: true,
								userTag: true,
								profile: {
									select: {
										name: true,
										profileImage: true,
									},
								},
							},
						},
					},
				});
			});

			it("메시지 없이도 Cheer를 생성할 수 있다", async () => {
				// Given
				const paramsWithoutMessage = {
					senderId: "sender-1",
					receiverId: "receiver-1",
				};
				const expectedCheer = createMockCheerWithRelations({ message: null });
				mockDatabase.cheer.create.mockResolvedValue(expectedCheer);

				// When
				const result = await service.sendCheer(paramsWithoutMessage);

				// Then
				expect(result.message).toBeNull();
			});
		});

		describe("이벤트 발행", () => {
			it("Cheer 생성 후 이벤트를 발행한다", async () => {
				// Given
				const sender = createMockUser({
					id: validParams.senderId,
					nickname: "발신자",
					profile: { name: "발신자", profileImage: null },
				});
				const expectedCheer = createMockCheerWithRelations({
					...validParams,
					sender,
				});
				mockDatabase.cheer.create.mockResolvedValue(expectedCheer);

				// When
				await service.sendCheer(validParams);

				// Then
				expect(mockEventEmitter.emit).toHaveBeenCalledWith(
					NotificationEvents.CHEER_SENT,
					expect.objectContaining({
						cheerId: expectedCheer.id,
						senderId: validParams.senderId,
						receiverId: validParams.receiverId,
						senderName: "발신자",
						message: validParams.message,
					}),
				);
			});

			it("발신자 이름을 조회할 수 없으면 기본값을 사용한다", async () => {
				// Given
				const sender = createMockUser({
					id: validParams.senderId,
					profile: { name: null, profileImage: null },
				});
				const expectedCheer = createMockCheerWithRelations({
					...validParams,
					sender,
				});
				mockDatabase.cheer.create.mockResolvedValue(expectedCheer);

				// When
				await service.sendCheer(validParams);

				// Then
				expect(mockEventEmitter.emit).toHaveBeenCalledWith(
					NotificationEvents.CHEER_SENT,
					expect.objectContaining({
						senderName: "알 수 없음",
					}),
				);
			});
		});
	});

	// ===========================================================================
	// 목록 조회 테스트
	// ===========================================================================

	describe("getReceivedCheers", () => {
		it("받은 응원 목록을 페이지네이션하여 반환한다", async () => {
			// Given
			const userId = "receiver-1";
			const cheers = [
				createMockCheerWithRelations({ id: 1, receiverId: userId }),
				createMockCheerWithRelations({ id: 2, receiverId: userId }),
			];
			mockCheerRepository.findReceivedCheers.mockResolvedValue(cheers);
			mockPaginationService.normalizeCursorPagination.mockReturnValue({
				cursor: undefined,
				size: 20,
			});

			// When
			const result = await service.getReceivedCheers({ userId });

			// Then
			expect(mockCheerRepository.findReceivedCheers).toHaveBeenCalledWith({
				userId,
				cursor: undefined,
				size: 20,
			});
			expect(
				mockPaginationService.createCursorPaginatedResponse,
			).toHaveBeenCalled();
			expect(result).toBeDefined();
		});

		it("커서와 사이즈가 주어지면 해당 값으로 조회한다", async () => {
			// Given
			const userId = "receiver-1";
			const cursor = 5;
			const size = 10;
			mockPaginationService.normalizeCursorPagination.mockReturnValue({
				cursor,
				size,
			});
			mockCheerRepository.findReceivedCheers.mockResolvedValue([]);

			// When
			await service.getReceivedCheers({ userId, cursor, size });

			// Then
			expect(
				mockPaginationService.normalizeCursorPagination,
			).toHaveBeenCalledWith({
				cursor,
				size,
			});
			expect(mockCheerRepository.findReceivedCheers).toHaveBeenCalledWith({
				userId,
				cursor,
				size,
			});
		});
	});

	describe("getSentCheers", () => {
		it("보낸 응원 목록을 페이지네이션하여 반환한다", async () => {
			// Given
			const userId = "sender-1";
			const cheers = [
				createMockCheerWithRelations({ id: 1, senderId: userId }),
				createMockCheerWithRelations({ id: 2, senderId: userId }),
			];
			mockCheerRepository.findSentCheers.mockResolvedValue(cheers);
			mockPaginationService.normalizeCursorPagination.mockReturnValue({
				cursor: undefined,
				size: 20,
			});

			// When
			const result = await service.getSentCheers({ userId });

			// Then
			expect(mockCheerRepository.findSentCheers).toHaveBeenCalledWith({
				userId,
				cursor: undefined,
				size: 20,
			});
			expect(result).toBeDefined();
		});
	});

	// ===========================================================================
	// 제한 및 쿨다운 정보 테스트
	// ===========================================================================

	describe("getLimitInfo", () => {
		it("FREE 구독자의 일일 제한 정보를 반환한다", async () => {
			// Given
			const userId = "user-1";
			mockCheerRepository.getUserSubscriptionStatus.mockResolvedValue("FREE");
			mockCheerRepository.countTodayCheers.mockResolvedValue(1);

			// When
			const result = await service.getLimitInfo(userId);

			// Then
			expect(result).toEqual({
				dailyLimit: CHEER_LIMITS.FREE_DAILY_LIMIT,
				used: 1,
				remaining: CHEER_LIMITS.FREE_DAILY_LIMIT - 1,
			});
		});

		it("ACTIVE 구독자는 무제한 제한 정보를 반환한다", async () => {
			// Given
			const userId = "user-1";
			mockCheerRepository.getUserSubscriptionStatus.mockResolvedValue("ACTIVE");
			mockCheerRepository.countTodayCheers.mockResolvedValue(50);

			// When
			const result = await service.getLimitInfo(userId);

			// Then
			expect(result).toEqual({
				dailyLimit: null,
				used: 50,
				remaining: null,
			});
		});

		it("구독 상태가 없으면 FREE로 처리한다", async () => {
			// Given
			const userId = "user-1";
			mockCheerRepository.getUserSubscriptionStatus.mockResolvedValue(null);
			mockCheerRepository.countTodayCheers.mockResolvedValue(0);

			// When
			const result = await service.getLimitInfo(userId);

			// Then
			expect(result.dailyLimit).toBe(CHEER_LIMITS.FREE_DAILY_LIMIT);
		});

		it("남은 횟수가 음수가 되지 않는다", async () => {
			// Given
			const userId = "user-1";
			mockCheerRepository.getUserSubscriptionStatus.mockResolvedValue("FREE");
			mockCheerRepository.countTodayCheers.mockResolvedValue(100); // 제한보다 많음

			// When
			const result = await service.getLimitInfo(userId);

			// Then
			expect(result.remaining).toBe(0);
		});
	});

	describe("getCooldownInfoForUser", () => {
		it("이전 응원이 없으면 쿨다운이 비활성화 상태이다", async () => {
			// Given
			const senderId = "sender-1";
			const receiverId = "receiver-1";
			mockCheerRepository.findLastCheerToUser.mockResolvedValue(null);

			// When
			const result = await service.getCooldownInfoForUser(senderId, receiverId);

			// Then
			expect(result).toEqual({
				isActive: false,
				remainingSeconds: 0,
				canCheerAt: null,
			});
		});

		it("쿨다운 시간이 지나면 비활성화 상태이다", async () => {
			// Given
			const senderId = "sender-1";
			const receiverId = "receiver-1";
			const oldCheer = createMockCheer({
				createdAt: new Date(
					Date.now() - (CHEER_LIMITS.COOLDOWN_HOURS + 1) * 60 * 60 * 1000,
				),
			});
			mockCheerRepository.findLastCheerToUser.mockResolvedValue(oldCheer);

			// When
			const result = await service.getCooldownInfoForUser(senderId, receiverId);

			// Then
			expect(result.isActive).toBe(false);
			expect(result.remainingSeconds).toBe(0);
			expect(result.canCheerAt).toBeNull();
		});

		it("쿨다운 시간 내이면 활성화 상태이다", async () => {
			// Given
			const senderId = "sender-1";
			const receiverId = "receiver-1";
			const recentCheer = createMockCheer({
				createdAt: new Date(Date.now() - 1000), // 1초 전
			});
			mockCheerRepository.findLastCheerToUser.mockResolvedValue(recentCheer);

			// When
			const result = await service.getCooldownInfoForUser(senderId, receiverId);

			// Then
			expect(result.isActive).toBe(true);
			expect(result.remainingSeconds).toBeGreaterThan(0);
			expect(result.canCheerAt).toBeInstanceOf(Date);
		});

		it("남은 쿨다운 시간이 정확하게 계산된다", async () => {
			// Given
			const senderId = "sender-1";
			const receiverId = "receiver-1";
			const halfCooldownMs = (CHEER_LIMITS.COOLDOWN_HOURS * 60 * 60 * 1000) / 2;
			const halfwayCheer = createMockCheer({
				createdAt: new Date(Date.now() - halfCooldownMs),
			});
			mockCheerRepository.findLastCheerToUser.mockResolvedValue(halfwayCheer);

			// When
			const result = await service.getCooldownInfoForUser(senderId, receiverId);

			// Then
			const expectedRemainingSeconds = Math.ceil(halfCooldownMs / 1000);
			// 허용 오차 10초 (테스트 실행 시간 고려)
			expect(result.remainingSeconds).toBeGreaterThan(
				expectedRemainingSeconds - 10,
			);
			expect(result.remainingSeconds).toBeLessThan(
				expectedRemainingSeconds + 10,
			);
		});
	});

	// ===========================================================================
	// 읽음 처리 테스트
	// ===========================================================================

	describe("markAsRead", () => {
		it("응원을 읽음 처리한다", async () => {
			// Given
			const userId = "receiver-1";
			const cheerId = 1;
			const cheer = createMockCheer({
				id: cheerId,
				receiverId: userId,
			});
			mockCheerRepository.findById.mockResolvedValue(cheer);
			mockCheerRepository.markAsRead.mockResolvedValue({
				...cheer,
				readAt: new Date(),
			});

			// When
			await service.markAsRead(userId, cheerId);

			// Then
			expect(mockCheerRepository.markAsRead).toHaveBeenCalledWith(cheerId);
		});

		it("응원이 존재하지 않으면 에러를 던진다", async () => {
			// Given
			mockCheerRepository.findById.mockResolvedValue(null);

			// When & Then
			await expect(service.markAsRead("user-1", 999)).rejects.toThrow();
		});

		it("수신자가 아니면 에러를 던진다", async () => {
			// Given
			const cheer = createMockCheer({
				id: 1,
				receiverId: "other-user",
			});
			mockCheerRepository.findById.mockResolvedValue(cheer);

			// When & Then
			await expect(service.markAsRead("user-1", 1)).rejects.toThrow();
		});

		it("이미 읽은 응원은 다시 처리하지 않는다", async () => {
			// Given
			const userId = "receiver-1";
			const cheerId = 1;
			const cheer = createMockCheer({
				id: cheerId,
				receiverId: userId,
				readAt: new Date(),
			});
			mockCheerRepository.findById.mockResolvedValue(cheer);

			// When
			await service.markAsRead(userId, cheerId);

			// Then
			expect(mockCheerRepository.markAsRead).not.toHaveBeenCalled();
		});
	});

	describe("markManyAsRead", () => {
		it("여러 응원을 읽음 처리하고 처리된 수를 반환한다", async () => {
			// Given
			const userId = "receiver-1";
			const cheerIds = [1, 2, 3];
			mockCheerRepository.markManyAsRead.mockResolvedValue(3);

			// When
			const result = await service.markManyAsRead(userId, cheerIds);

			// Then
			expect(result).toBe(3);
			expect(mockCheerRepository.markManyAsRead).toHaveBeenCalledWith(
				cheerIds,
				userId,
			);
		});

		it("빈 배열이 주어지면 0을 반환한다", async () => {
			// Given
			const userId = "receiver-1";
			mockCheerRepository.markManyAsRead.mockResolvedValue(0);

			// When
			const result = await service.markManyAsRead(userId, []);

			// Then
			expect(result).toBe(0);
		});
	});
});
