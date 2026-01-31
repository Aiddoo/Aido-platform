import { NUDGE_LIMITS } from "@aido/validators";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Test } from "@nestjs/testing";
import { PaginationService } from "@/common/pagination/services/pagination.service";
import { DatabaseService } from "@/database/database.service";
import type { Nudge } from "@/generated/prisma/client";
import { FollowService } from "@/modules/follow/follow.service";
import { NotificationEvents } from "@/modules/notification/events";

import { NudgeRepository } from "./nudge.repository";
import { NudgeService } from "./nudge.service";
import type { NudgeWithRelations } from "./types";

// =============================================================================
// Mock Factory Functions
// =============================================================================

function createMockNudge(overrides: Partial<Nudge> = {}): Nudge {
	return {
		id: 1,
		senderId: "sender-id",
		receiverId: "receiver-id",
		todoId: 100,
		message: "할일 화이팅!",
		readAt: null,
		createdAt: new Date("2024-01-15T10:00:00Z"),
		...overrides,
	};
}

function createMockNudgeWithRelations(
	overrides: Partial<NudgeWithRelations> = {},
): NudgeWithRelations {
	const nudge = createMockNudge();
	return {
		...nudge,
		sender: {
			id: nudge.senderId,
			userTag: "sender_tag",
			profile: {
				name: "보내는 사람",
				profileImage: "https://example.com/sender.jpg",
			},
		},
		receiver: {
			id: nudge.receiverId,
			userTag: "receiver_tag",
			profile: {
				name: "받는 사람",
				profileImage: "https://example.com/receiver.jpg",
			},
		},
		todo: {
			id: nudge.todoId,
			title: "테스트 할일",
			completed: false,
		},
		...overrides,
	};
}

// =============================================================================
// Tests
// =============================================================================

describe("NudgeService", () => {
	let service: NudgeService;
	let nudgeRepository: jest.Mocked<NudgeRepository>;
	let followService: jest.Mocked<FollowService>;
	let paginationService: jest.Mocked<PaginationService>;
	let eventEmitter: jest.Mocked<EventEmitter2>;
	let mockDatabase: {
		$transaction: jest.Mock;
		user: {
			findUnique: jest.Mock;
		};
		todo: {
			findUnique: jest.Mock;
		};
		nudge: {
			count: jest.Mock;
			findFirst: jest.Mock;
			create: jest.Mock;
		};
	};

	beforeEach(async () => {
		const mockNudgeRepository = {
			create: jest.fn(),
			createWithRelations: jest.fn(),
			findById: jest.fn(),
			findByIdWithRelations: jest.fn(),
			markAsRead: jest.fn(),
			findReceivedNudges: jest.fn(),
			findSentNudges: jest.fn(),
			countTodayNudges: jest.fn(),
			findLastNudgeForTodo: jest.fn(),
			findLastNudgeToUser: jest.fn(),
			userExists: jest.fn(),
			getUserName: jest.fn(),
			getUserSubscriptionStatus: jest.fn(),
			findTodoWithOwner: jest.fn(),
			isTodoPublic: jest.fn(),
		};

		const mockFollowService = {
			isMutualFriend: jest.fn(),
		};

		const mockPaginationService = {
			normalizeCursorPagination: jest
				.fn()
				.mockReturnValue({ cursor: undefined, size: 20 }),
			createCursorPaginatedResponse: jest
				.fn()
				.mockImplementation(({ items, size }) => ({
					items: items.slice(0, size),
					nextCursor: items.length > size ? items[size - 1].id : null,
					hasMore: items.length > size,
				})),
		};

		const mockEventEmitter = {
			emit: jest.fn(),
		};

		mockDatabase = {
			$transaction: jest.fn((callback) => callback(mockDatabase)),
			user: {
				findUnique: jest.fn(),
			},
			todo: {
				findUnique: jest.fn(),
			},
			nudge: {
				count: jest.fn(),
				findFirst: jest.fn(),
				create: jest.fn(),
			},
		};

		const module = await Test.createTestingModule({
			providers: [
				NudgeService,
				{ provide: NudgeRepository, useValue: mockNudgeRepository },
				{ provide: FollowService, useValue: mockFollowService },
				{ provide: PaginationService, useValue: mockPaginationService },
				{ provide: EventEmitter2, useValue: mockEventEmitter },
				{ provide: DatabaseService, useValue: mockDatabase },
			],
		}).compile();

		service = module.get(NudgeService);
		nudgeRepository = module.get(NudgeRepository);
		followService = module.get(FollowService);
		paginationService = module.get(PaginationService);
		eventEmitter = module.get(EventEmitter2);
	});

	// =========================================================================
	// sendNudge
	// =========================================================================

	describe("sendNudge", () => {
		const defaultParams = {
			senderId: "sender-id",
			receiverId: "receiver-id",
			todoId: 100,
			message: "할일 화이팅!",
		};

		beforeEach(() => {
			// 기본 성공 조건 설정
			followService.isMutualFriend.mockResolvedValue(true);
			nudgeRepository.getUserName.mockResolvedValue("보내는 사람");
			mockDatabase.user.findUnique.mockResolvedValue({
				subscriptionStatus: "FREE",
			});
			mockDatabase.todo.findUnique.mockResolvedValue({
				id: 100,
				userId: "receiver-id",
				title: "테스트 할일",
			});
			mockDatabase.nudge.count.mockResolvedValue(0);
			mockDatabase.nudge.findFirst.mockResolvedValue(null);
			mockDatabase.nudge.create.mockResolvedValue(
				createMockNudgeWithRelations(),
			);
		});

		it("Nudge를 성공적으로 발송한다", async () => {
			// When
			const result = await service.sendNudge(defaultParams);

			// Then
			expect(followService.isMutualFriend).toHaveBeenCalledWith(
				"sender-id",
				"receiver-id",
			);
			expect(mockDatabase.nudge.create).toHaveBeenCalledWith({
				data: {
					sender: { connect: { id: "sender-id" } },
					receiver: { connect: { id: "receiver-id" } },
					todo: { connect: { id: 100 } },
					message: "할일 화이팅!",
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
					todo: { select: { id: true, title: true, completed: true } },
				},
			});
			expect(result).toBeDefined();
			expect(result.id).toBe(1);
		});

		it("Nudge 발송 후 이벤트를 발행한다", async () => {
			// When
			await service.sendNudge(defaultParams);

			// Then
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				NotificationEvents.NUDGE_SENT,
				expect.objectContaining({
					nudgeId: 1,
					senderId: "sender-id",
					receiverId: "receiver-id",
					senderName: "보내는 사람",
					todoId: 100,
					todoTitle: "테스트 할일",
				}),
			);
		});

		it("자기 자신에게 Nudge를 보내면 에러를 발생시킨다", async () => {
			// Given
			const params = { ...defaultParams, receiverId: "sender-id" };

			// When & Then
			await expect(service.sendNudge(params)).rejects.toThrow();
		});

		it("친구가 아닌 사용자에게 Nudge를 보내면 에러를 발생시킨다", async () => {
			// Given
			followService.isMutualFriend.mockResolvedValue(false);

			// When & Then
			await expect(service.sendNudge(defaultParams)).rejects.toThrow();
		});

		it("존재하지 않는 Todo에 Nudge를 보내면 에러를 발생시킨다", async () => {
			// Given
			mockDatabase.todo.findUnique.mockResolvedValue(null);

			// When & Then
			await expect(service.sendNudge(defaultParams)).rejects.toThrow();
		});

		it("다른 사용자의 Todo에 Nudge를 보내면 에러를 발생시킨다", async () => {
			// Given
			mockDatabase.todo.findUnique.mockResolvedValue({
				id: 100,
				userId: "other-user-id",
				title: "다른 사람 할일",
			});

			// When & Then
			await expect(service.sendNudge(defaultParams)).rejects.toThrow();
		});

		it("일일 제한을 초과하면 에러를 발생시킨다", async () => {
			// Given
			mockDatabase.user.findUnique.mockResolvedValue({
				subscriptionStatus: "FREE",
			});
			mockDatabase.nudge.count.mockResolvedValue(NUDGE_LIMITS.FREE_DAILY_LIMIT);

			// When & Then
			await expect(service.sendNudge(defaultParams)).rejects.toThrow();
		});

		it("ACTIVE 구독자는 무제한 Nudge를 보낼 수 있다", async () => {
			// Given
			mockDatabase.user.findUnique.mockResolvedValue({
				subscriptionStatus: "ACTIVE",
			});
			mockDatabase.nudge.count.mockResolvedValue(100);

			// When
			const result = await service.sendNudge(defaultParams);

			// Then
			expect(result).toBeDefined();
		});

		it("쿨다운 기간에는 같은 Todo에 Nudge를 보낼 수 없다", async () => {
			// Given
			const recentNudge = createMockNudge({
				createdAt: new Date(), // 방금 보낸 Nudge
			});
			mockDatabase.nudge.findFirst.mockResolvedValue(recentNudge);

			// When & Then
			await expect(service.sendNudge(defaultParams)).rejects.toThrow();
		});

		it("쿨다운이 지나면 같은 Todo에 다시 Nudge를 보낼 수 있다", async () => {
			// Given
			const oldNudge = createMockNudge({
				createdAt: new Date(
					Date.now() - (NUDGE_LIMITS.COOLDOWN_HOURS + 1) * 60 * 60 * 1000,
				),
			});
			mockDatabase.nudge.findFirst.mockResolvedValue(oldNudge);

			// When
			const result = await service.sendNudge(defaultParams);

			// Then
			expect(result).toBeDefined();
		});
	});

	// =========================================================================
	// getReceivedNudges
	// =========================================================================

	describe("getReceivedNudges", () => {
		it("받은 Nudge 목록을 조회한다", async () => {
			// Given
			const mockNudges = [
				createMockNudgeWithRelations({ id: 1 }),
				createMockNudgeWithRelations({ id: 2 }),
			];
			nudgeRepository.findReceivedNudges.mockResolvedValue(mockNudges);

			// When
			const result = await service.getReceivedNudges({
				userId: "receiver-id",
			});

			// Then
			expect(paginationService.normalizeCursorPagination).toHaveBeenCalled();
			expect(nudgeRepository.findReceivedNudges).toHaveBeenCalledWith({
				userId: "receiver-id",
				cursor: undefined,
				size: 20,
			});
			expect(
				paginationService.createCursorPaginatedResponse,
			).toHaveBeenCalled();
			expect(result.items).toBeDefined();
		});

		it("커서와 사이즈를 지정하여 조회한다", async () => {
			// Given
			const mockNudges = [createMockNudgeWithRelations({ id: 3 })];
			nudgeRepository.findReceivedNudges.mockResolvedValue(mockNudges);
			paginationService.normalizeCursorPagination.mockReturnValue({
				cursor: 5,
				size: 10,
				take: 11,
			});

			// When
			await service.getReceivedNudges({
				userId: "receiver-id",
				cursor: 5,
				size: 10,
			});

			// Then
			expect(nudgeRepository.findReceivedNudges).toHaveBeenCalledWith({
				userId: "receiver-id",
				cursor: 5,
				size: 10,
			});
		});
	});

	// =========================================================================
	// getSentNudges
	// =========================================================================

	describe("getSentNudges", () => {
		it("보낸 Nudge 목록을 조회한다", async () => {
			// Given
			const mockNudges = [
				createMockNudgeWithRelations({ id: 1 }),
				createMockNudgeWithRelations({ id: 2 }),
			];
			nudgeRepository.findSentNudges.mockResolvedValue(mockNudges);

			// When
			const result = await service.getSentNudges({
				userId: "sender-id",
			});

			// Then
			expect(nudgeRepository.findSentNudges).toHaveBeenCalledWith({
				userId: "sender-id",
				cursor: undefined,
				size: 20,
			});
			expect(result.items).toBeDefined();
		});
	});

	// =========================================================================
	// getLimitInfo
	// =========================================================================

	describe("getLimitInfo", () => {
		it("FREE 사용자의 제한 정보를 조회한다", async () => {
			// Given
			nudgeRepository.getUserSubscriptionStatus.mockResolvedValue("FREE");
			nudgeRepository.countTodayNudges.mockResolvedValue(1);

			// When
			const result = await service.getLimitInfo("user-id");

			// Then
			expect(result.dailyLimit).toBe(NUDGE_LIMITS.FREE_DAILY_LIMIT);
			expect(result.used).toBe(1);
			expect(result.remaining).toBe(NUDGE_LIMITS.FREE_DAILY_LIMIT - 1);
		});

		it("ACTIVE 사용자는 무제한이다", async () => {
			// Given
			nudgeRepository.getUserSubscriptionStatus.mockResolvedValue("ACTIVE");
			nudgeRepository.countTodayNudges.mockResolvedValue(100);

			// When
			const result = await service.getLimitInfo("user-id");

			// Then
			expect(result.dailyLimit).toBeNull();
			expect(result.used).toBe(100);
			expect(result.remaining).toBeNull();
		});

		it("EXPIRED 사용자는 FREE 제한이 적용된다", async () => {
			// Given
			nudgeRepository.getUserSubscriptionStatus.mockResolvedValue("EXPIRED");
			nudgeRepository.countTodayNudges.mockResolvedValue(2);

			// When
			const result = await service.getLimitInfo("user-id");

			// Then
			expect(result.dailyLimit).toBe(NUDGE_LIMITS.FREE_DAILY_LIMIT);
			expect(result.remaining).toBe(NUDGE_LIMITS.FREE_DAILY_LIMIT - 2);
		});

		it("사용자가 없으면 FREE 제한이 적용된다", async () => {
			// Given
			nudgeRepository.getUserSubscriptionStatus.mockResolvedValue(null);
			nudgeRepository.countTodayNudges.mockResolvedValue(0);

			// When
			const result = await service.getLimitInfo("unknown-id");

			// Then
			expect(result.dailyLimit).toBe(NUDGE_LIMITS.FREE_DAILY_LIMIT);
		});
	});

	// =========================================================================
	// getCooldownInfoForTodo
	// =========================================================================

	describe("getCooldownInfoForTodo", () => {
		it("Nudge 기록이 없으면 쿨다운 비활성 상태를 반환한다", async () => {
			// Given
			nudgeRepository.findLastNudgeForTodo.mockResolvedValue(null);

			// When
			const result = await service.getCooldownInfoForTodo("sender-id", 100);

			// Then
			expect(result.isActive).toBe(false);
			expect(result.remainingSeconds).toBe(0);
			expect(result.cooldownEndsAt).toBeNull();
		});

		it("쿨다운 기간 내이면 활성 상태를 반환한다", async () => {
			// Given
			const recentNudge = createMockNudge({
				createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30분 전
			});
			nudgeRepository.findLastNudgeForTodo.mockResolvedValue(recentNudge);

			// When
			const result = await service.getCooldownInfoForTodo("sender-id", 100);

			// Then
			expect(result.isActive).toBe(true);
			expect(result.remainingSeconds).toBeGreaterThan(0);
			expect(result.cooldownEndsAt).not.toBeNull();
		});

		it("쿨다운 기간이 지나면 비활성 상태를 반환한다", async () => {
			// Given
			const oldNudge = createMockNudge({
				createdAt: new Date(
					Date.now() - (NUDGE_LIMITS.COOLDOWN_HOURS + 1) * 60 * 60 * 1000,
				),
			});
			nudgeRepository.findLastNudgeForTodo.mockResolvedValue(oldNudge);

			// When
			const result = await service.getCooldownInfoForTodo("sender-id", 100);

			// Then
			expect(result.isActive).toBe(false);
			expect(result.remainingSeconds).toBe(0);
		});
	});

	// =========================================================================
	// getCooldownInfoForUser
	// =========================================================================

	describe("getCooldownInfoForUser", () => {
		it("특정 사용자에 대한 쿨다운 정보를 조회한다", async () => {
			// Given
			nudgeRepository.findLastNudgeToUser.mockResolvedValue(null);

			// When
			const result = await service.getCooldownInfoForUser(
				"sender-id",
				"receiver-id",
			);

			// Then
			expect(nudgeRepository.findLastNudgeToUser).toHaveBeenCalledWith(
				"sender-id",
				"receiver-id",
			);
			expect(result.isActive).toBe(false);
		});
	});

	// =========================================================================
	// markAsRead
	// =========================================================================

	describe("markAsRead", () => {
		it("Nudge를 읽음 처리한다", async () => {
			// Given
			const mockNudge = createMockNudge({ receiverId: "user-id" });
			nudgeRepository.findById.mockResolvedValue(mockNudge);
			nudgeRepository.markAsRead.mockResolvedValue(
				createMockNudge({ readAt: new Date() }),
			);

			// When
			await service.markAsRead("user-id", 1);

			// Then
			expect(nudgeRepository.findById).toHaveBeenCalledWith(1);
			expect(nudgeRepository.markAsRead).toHaveBeenCalledWith(1);
		});

		it("존재하지 않는 Nudge는 에러를 발생시킨다", async () => {
			// Given
			nudgeRepository.findById.mockResolvedValue(null);

			// When & Then
			await expect(service.markAsRead("user-id", 999)).rejects.toThrow();
		});

		it("본인이 받지 않은 Nudge는 에러를 발생시킨다", async () => {
			// Given
			const mockNudge = createMockNudge({ receiverId: "other-user-id" });
			nudgeRepository.findById.mockResolvedValue(mockNudge);

			// When & Then
			await expect(service.markAsRead("user-id", 1)).rejects.toThrow();
		});

		it("이미 읽은 Nudge는 무시한다", async () => {
			// Given
			const mockNudge = createMockNudge({
				receiverId: "user-id",
				readAt: new Date(),
			});
			nudgeRepository.findById.mockResolvedValue(mockNudge);

			// When
			await service.markAsRead("user-id", 1);

			// Then
			expect(nudgeRepository.markAsRead).not.toHaveBeenCalled();
		});
	});
});
