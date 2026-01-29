/**
 * NudgeService 통합 테스트
 *
 * @description
 * NudgeService가 NudgeRepository, FollowService, PaginationService, EventEmitter와 함께 올바르게 작동하는지 검증합니다.
 * 실제 데이터베이스 대신 모킹된 DatabaseService를 사용하여 서비스 계층 통합을 테스트합니다.
 *
 * 통합 테스트의 목적:
 * - NestJS 의존성 주입이 올바르게 작동하는지 검증
 * - NudgeService와 NudgeRepository의 통합 검증
 * - FollowService와의 통합 검증
 * - PaginationService와의 통합 검증
 * - EventEmitter와의 통합 검증
 * - BusinessException 에러 처리가 올바르게 작동하는지 검증
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test nudge.integration-spec
 * ```
 */

import { Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Test, type TestingModule } from "@nestjs/testing";
import { TypedConfigService } from "@/common/config/services/config.service";
import { BusinessException } from "@/common/exception/services/business-exception.service";
import { PaginationService } from "@/common/pagination/services/pagination.service";
import { DatabaseService } from "@/database/database.service";
import type { Nudge, Todo, User, UserProfile } from "@/generated/prisma/client";

import { FollowService } from "@/modules/follow/follow.service";
import { NudgeRepository } from "@/modules/nudge/nudge.repository";
import { NudgeService } from "@/modules/nudge/nudge.service";

describe("NudgeService Integration Tests", () => {
	let module: TestingModule;
	let service: NudgeService;
	let repository: NudgeRepository;

	// Mock 데이터베이스 서비스
	const mockNudgeDb = {
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

	const mockTodoDb = {
		findUnique: jest.fn(),
	};

	const mockDatabaseService = {
		nudge: mockNudgeDb,
		user: mockUserDb,
		todo: mockTodoDb,
		$transaction: jest.fn(),
	};

	mockDatabaseService.$transaction.mockImplementation(
		(callback: (tx: unknown) => Promise<unknown>) =>
			callback(mockDatabaseService),
	);

	// Mock FollowService
	const mockFollowService = {
		isMutualFriend: jest.fn(),
	};

	// Mock EventEmitter
	const mockEventEmitter = {
		emit: jest.fn(),
	};

	// 테스트 데이터
	const mockSenderId = "user-nudge-sender-123";
	const mockReceiverId = "user-nudge-receiver-456";
	const mockTodoId = 1;
	const mockNudgeId = 1;

	const createMockUser = (
		id: string,
		subscriptionStatus: "FREE" | "ACTIVE" | "EXPIRED" | "CANCELLED" = "FREE",
	): User & { profile: UserProfile } => ({
		id,
		email: `${id}@test.com`,
		userTag: id.substring(0, 8).toUpperCase(),
		status: "ACTIVE",
		emailVerifiedAt: new Date(),
		twoFactorEnabled: false,
		twoFactorSecret: null,
		subscriptionStatus,
		subscriptionExpiresAt: null,
		revenueCatUserId: null,
		aiUsageCount: 0,
		aiUsageResetAt: new Date(),
		createdAt: new Date(),
		updatedAt: new Date(),
		lastLoginAt: new Date(),
		deletedAt: null,
		profile: {
			id: "profile-1",
			userId: id,
			name: "Test User",
			profileImage: null,
		},
	});

	const createMockTodo = (overrides: Partial<Todo> = {}): Todo => ({
		id: mockTodoId,
		userId: mockReceiverId,
		title: "테스트 할일",
		content: "테스트 할일 내용",
		categoryId: 1,
		sortOrder: 0,
		completed: false,
		completedAt: null,
		startDate: new Date(),
		endDate: null,
		scheduledTime: null,
		isAllDay: true,
		visibility: "PUBLIC",
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	});

	const createMockNudge = (
		overrides: Partial<Nudge> = {},
	): Nudge & {
		sender: {
			id: string;
			userTag: string;
			profile: { name: string; profileImage: string | null };
		};
		receiver: {
			id: string;
			userTag: string;
			profile: { name: string; profileImage: string | null };
		};
		todo: Todo | null;
	} => ({
		id: mockNudgeId,
		senderId: mockSenderId,
		receiverId: mockReceiverId,
		todoId: mockTodoId,
		message: null,
		createdAt: new Date(),
		readAt: null,
		sender: {
			id: mockSenderId,
			userTag: "SENDER12",
			profile: { name: "Sender User", profileImage: null },
		},
		receiver: {
			id: mockReceiverId,
			userTag: "RECEIVER",
			profile: { name: "Receiver User", profileImage: null },
		},
		todo: createMockTodo(),
		...overrides,
	});

	beforeAll(async () => {
		// Logger 출력 비활성화
		jest.spyOn(Logger.prototype, "log").mockImplementation();
		jest.spyOn(Logger.prototype, "warn").mockImplementation();
		jest.spyOn(Logger.prototype, "error").mockImplementation();
		jest.spyOn(Logger.prototype, "debug").mockImplementation();

		module = await Test.createTestingModule({
			providers: [
				NudgeService,
				NudgeRepository,
				PaginationService,
				{
					provide: DatabaseService,
					useValue: mockDatabaseService,
				},
				{
					provide: TypedConfigService,
					useValue: {
						get: jest.fn().mockReturnValue(20),
					},
				},
				{
					provide: FollowService,
					useValue: mockFollowService,
				},
				{
					provide: EventEmitter2,
					useValue: mockEventEmitter,
				},
			],
		}).compile();

		service = module.get<NudgeService>(NudgeService);
		repository = module.get<NudgeRepository>(NudgeRepository);
	});

	afterAll(async () => {
		await module.close();
		jest.restoreAllMocks();
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("DI 통합 테스트", () => {
		it("NudgeService가 정상적으로 주입되어야 함", () => {
			expect(service).toBeDefined();
			expect(service).toBeInstanceOf(NudgeService);
		});

		it("NudgeRepository가 정상적으로 주입되어야 함", () => {
			expect(repository).toBeDefined();
			expect(repository).toBeInstanceOf(NudgeRepository);
		});
	});

	describe("콕 찌르기 전송 통합 테스트", () => {
		it("친구에게 콕 찌르기를 전송해야 함", async () => {
			const mockSender = createMockUser(mockSenderId);
			const mockReceiver = createMockUser(mockReceiverId);
			const mockTodo = createMockTodo();
			const mockNudge = createMockNudge();

			mockFollowService.isMutualFriend.mockResolvedValue(true);
			mockUserDb.findUnique
				.mockResolvedValueOnce(mockSender)
				.mockResolvedValueOnce(mockReceiver);
			mockTodoDb.findUnique.mockResolvedValue(mockTodo);
			mockNudgeDb.count.mockResolvedValue(0); // 오늘 보낸 횟수
			mockNudgeDb.findFirst.mockResolvedValue(null); // 쿨다운 체크
			mockNudgeDb.create.mockResolvedValue(mockNudge);

			const result = await service.sendNudge({
				senderId: mockSenderId,
				receiverId: mockReceiverId,
				todoId: mockTodoId,
			});

			expect(result.id).toBe(mockNudgeId);
			expect(mockFollowService.isMutualFriend).toHaveBeenCalledWith(
				mockSenderId,
				mockReceiverId,
			);
			expect(mockEventEmitter.emit).toHaveBeenCalledWith(
				"nudge.sent",
				expect.any(Object),
			);
		});

		it("친구가 아니면 예외를 발생시켜야 함", async () => {
			mockFollowService.isMutualFriend.mockResolvedValue(false);

			await expect(
				service.sendNudge({
					senderId: mockSenderId,
					receiverId: mockReceiverId,
					todoId: mockTodoId,
				}),
			).rejects.toThrow(BusinessException);
		});

		it("자기 자신에게 전송하면 예외를 발생시켜야 함", async () => {
			await expect(
				service.sendNudge({
					senderId: mockSenderId,
					receiverId: mockSenderId,
					todoId: mockTodoId,
				}),
			).rejects.toThrow(BusinessException);
		});

		it("일일 제한 초과시 예외를 발생시켜야 함", async () => {
			const mockSender = createMockUser(mockSenderId, "FREE");
			const mockReceiver = createMockUser(mockReceiverId);
			const mockTodo = createMockTodo();

			mockFollowService.isMutualFriend.mockResolvedValue(true);
			mockUserDb.findUnique
				.mockResolvedValueOnce(mockSender)
				.mockResolvedValueOnce(mockReceiver);
			mockTodoDb.findUnique.mockResolvedValue(mockTodo);
			mockNudgeDb.count.mockResolvedValue(3); // 일일 제한 도달

			await expect(
				service.sendNudge({
					senderId: mockSenderId,
					receiverId: mockReceiverId,
					todoId: mockTodoId,
				}),
			).rejects.toThrow(BusinessException);
		});

		it("쿨다운 중이면 예외를 발생시켜야 함", async () => {
			const mockSender = createMockUser(mockSenderId);
			const mockReceiver = createMockUser(mockReceiverId);
			const mockTodo = createMockTodo();
			const recentNudge = createMockNudge({
				createdAt: new Date(), // 방금 생성됨
			});

			mockFollowService.isMutualFriend.mockResolvedValue(true);
			mockUserDb.findUnique
				.mockResolvedValueOnce(mockSender)
				.mockResolvedValueOnce(mockReceiver);
			mockTodoDb.findUnique.mockResolvedValue(mockTodo);
			mockNudgeDb.count.mockResolvedValue(0);
			mockNudgeDb.findFirst.mockResolvedValue(recentNudge); // 쿨다운 활성화

			await expect(
				service.sendNudge({
					senderId: mockSenderId,
					receiverId: mockReceiverId,
					todoId: mockTodoId,
				}),
			).rejects.toThrow(BusinessException);
		});
	});

	describe("받은 콕 찌르기 목록 조회 통합 테스트", () => {
		it("받은 콕 찌르기 목록을 조회해야 함", async () => {
			const mockNudges = [
				createMockNudge({ id: 1 }),
				createMockNudge({ id: 2 }),
			];
			mockNudgeDb.findMany.mockResolvedValue(mockNudges);
			mockNudgeDb.count.mockResolvedValue(2);

			const result = await service.getReceivedNudges({
				userId: mockReceiverId,
			});

			expect(result.items).toBeDefined();
			expect(result.pagination).toBeDefined();
			expect(mockNudgeDb.findMany).toHaveBeenCalled();
		});

		it("받은 콕 찌르기 목록에 sender.userTag가 포함되어야 함", async () => {
			const mockNudges = [createMockNudge({ id: 1 })];
			mockNudgeDb.findMany.mockResolvedValue(mockNudges);
			mockNudgeDb.count.mockResolvedValue(1);

			const result = await service.getReceivedNudges({
				userId: mockReceiverId,
			});

			expect(result.items[0]?.sender.userTag).toBeDefined();
			expect(result.items[0]?.sender.userTag).toBe("SENDER12");
		});
	});

	describe("보낸 콕 찌르기 목록 조회 통합 테스트", () => {
		it("보낸 콕 찌르기 목록을 조회해야 함", async () => {
			const mockNudges = [
				createMockNudge({ id: 1 }),
				createMockNudge({ id: 2 }),
			];
			mockNudgeDb.findMany.mockResolvedValue(mockNudges);
			mockNudgeDb.count.mockResolvedValue(2);

			const result = await service.getSentNudges({ userId: mockSenderId });

			expect(result.items).toBeDefined();
			expect(result.pagination).toBeDefined();
			expect(mockNudgeDb.findMany).toHaveBeenCalled();
		});

		it("보낸 콕 찌르기 목록에 sender.userTag가 포함되어야 함", async () => {
			const mockNudges = [createMockNudge({ id: 1 })];
			mockNudgeDb.findMany.mockResolvedValue(mockNudges);
			mockNudgeDb.count.mockResolvedValue(1);

			const result = await service.getSentNudges({ userId: mockSenderId });

			expect(result.items[0]?.sender.userTag).toBeDefined();
			expect(result.items[0]?.sender.userTag).toBe("SENDER12");
		});
	});

	describe("일일 제한 정보 조회 통합 테스트", () => {
		it("FREE 사용자의 제한 정보를 반환해야 함", async () => {
			const mockUser = createMockUser(mockSenderId, "FREE");
			mockUserDb.findUnique.mockResolvedValue(mockUser);
			mockNudgeDb.count.mockResolvedValue(2);

			const result = await service.getLimitInfo(mockSenderId);

			expect(result.dailyLimit).toBe(3);
			expect(result.remaining).toBe(1);
			expect(result.used).toBe(2);
		});

		it("ACTIVE 사용자는 무제한이어야 함", async () => {
			// 이전 테스트의 mock 설정 초기화
			mockUserDb.findUnique.mockReset();
			mockNudgeDb.count.mockReset();

			const mockUser = createMockUser(mockSenderId, "ACTIVE");
			mockUserDb.findUnique.mockResolvedValue(mockUser);
			mockNudgeDb.count.mockResolvedValue(10);

			const result = await service.getLimitInfo(mockSenderId);

			expect(result.dailyLimit).toBeNull(); // null means unlimited
			expect(result.remaining).toBeNull();
		});
	});

	describe("쿨다운 정보 조회 통합 테스트", () => {
		it("쿨다운이 없으면 false를 반환해야 함", async () => {
			mockNudgeDb.findFirst.mockResolvedValue(null);

			const result = await service.getCooldownInfoForUser(
				mockSenderId,
				mockReceiverId,
			);

			expect(result.isActive).toBe(false);
		});

		it("쿨다운 중이면 남은 시간을 반환해야 함", async () => {
			const recentNudge = createMockNudge({
				createdAt: new Date(),
			});
			mockNudgeDb.findFirst.mockResolvedValue(recentNudge);

			const result = await service.getCooldownInfoForUser(
				mockSenderId,
				mockReceiverId,
			);

			expect(result.isActive).toBe(true);
			expect(result.remainingSeconds).toBeGreaterThan(0);
		});
	});

	describe("읽음 처리 통합 테스트", () => {
		it("콕 찌르기를 읽음 처리해야 함", async () => {
			const mockNudge = createMockNudge({ readAt: null });
			mockNudgeDb.findUnique.mockResolvedValue(mockNudge);
			mockNudgeDb.update.mockResolvedValue({
				...mockNudge,
				readAt: new Date(),
			});

			await service.markAsRead(mockReceiverId, mockNudgeId);

			expect(mockNudgeDb.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: mockNudgeId },
				}),
			);
		});

		it("존재하지 않는 콕 찌르기면 예외를 발생시켜야 함", async () => {
			mockNudgeDb.findUnique.mockResolvedValue(null);

			await expect(service.markAsRead(mockReceiverId, 999)).rejects.toThrow(
				BusinessException,
			);
		});

		it("다른 사용자의 콕 찌르기면 예외를 발생시켜야 함", async () => {
			const mockNudge = createMockNudge({ receiverId: "other-user" });
			mockNudgeDb.findUnique.mockResolvedValue(mockNudge);

			await expect(
				service.markAsRead(mockReceiverId, mockNudgeId),
			).rejects.toThrow(BusinessException);
		});
	});
});
