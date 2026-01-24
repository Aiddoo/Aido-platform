/**
 * CheerService 통합 테스트
 *
 * @description
 * CheerService가 CheerRepository, FollowService, PaginationService, EventEmitter와 함께 올바르게 작동하는지 검증합니다.
 * 실제 데이터베이스 대신 모킹된 DatabaseService를 사용하여 서비스 계층 통합을 테스트합니다.
 *
 * 통합 테스트의 목적:
 * - NestJS 의존성 주입이 올바르게 작동하는지 검증
 * - CheerService와 CheerRepository의 통합 검증
 * - FollowService와의 통합 검증
 * - PaginationService와의 통합 검증
 * - EventEmitter와의 통합 검증
 * - BusinessException 에러 처리가 올바르게 작동하는지 검증
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test cheer.integration-spec
 * ```
 */

import { Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Test, type TestingModule } from "@nestjs/testing";
import { TypedConfigService } from "@/common/config/services/config.service";
import { BusinessException } from "@/common/exception/services/business-exception.service";
import { PaginationService } from "@/common/pagination/services/pagination.service";
import { DatabaseService } from "@/database/database.service";
import type { Cheer, User, UserProfile } from "@/generated/prisma/client";
import { CheerRepository } from "@/modules/cheer/cheer.repository";
import { CheerService } from "@/modules/cheer/cheer.service";
import { FollowService } from "@/modules/follow/follow.service";

describe("CheerService Integration Tests", () => {
	let module: TestingModule;
	let service: CheerService;
	let repository: CheerRepository;

	// Mock 데이터베이스 서비스
	const mockCheerDb = {
		create: jest.fn(),
		findUnique: jest.fn(),
		findFirst: jest.fn(),
		findMany: jest.fn(),
		update: jest.fn(),
		updateMany: jest.fn(),
		delete: jest.fn(),
		count: jest.fn(),
	};

	const mockUserDb = {
		findUnique: jest.fn(),
	};

	const mockDatabaseService = {
		cheer: mockCheerDb,
		user: mockUserDb,
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
	const mockSenderId = "user-cheer-sender-123";
	const mockReceiverId = "user-cheer-receiver-456";
	const mockCheerId = 1;

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

	const createMockCheer = (
		overrides: Partial<Cheer> = {},
	): Cheer & {
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
	} => ({
		id: mockCheerId,
		senderId: mockSenderId,
		receiverId: mockReceiverId,
		message: "축하해요! 🎉",
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
				CheerService,
				CheerRepository,
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

		service = module.get<CheerService>(CheerService);
		repository = module.get<CheerRepository>(CheerRepository);
	});

	afterAll(async () => {
		await module.close();
		jest.restoreAllMocks();
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("DI 통합 테스트", () => {
		it("CheerService가 정상적으로 주입되어야 함", () => {
			expect(service).toBeDefined();
			expect(service).toBeInstanceOf(CheerService);
		});

		it("CheerRepository가 정상적으로 주입되어야 함", () => {
			expect(repository).toBeDefined();
			expect(repository).toBeInstanceOf(CheerRepository);
		});
	});

	describe("응원 전송 통합 테스트", () => {
		it("친구에게 응원을 전송해야 함", async () => {
			const mockSender = createMockUser(mockSenderId);
			const mockReceiver = createMockUser(mockReceiverId);
			const mockCheer = createMockCheer();

			mockFollowService.isMutualFriend.mockResolvedValue(true);
			mockUserDb.findUnique
				.mockResolvedValueOnce(mockSender)
				.mockResolvedValueOnce(mockReceiver);
			mockCheerDb.count.mockResolvedValue(0); // 오늘 보낸 횟수
			mockCheerDb.findFirst.mockResolvedValue(null); // 쿨다운 체크
			mockCheerDb.create.mockResolvedValue(mockCheer);

			const result = await service.sendCheer({
				senderId: mockSenderId,
				receiverId: mockReceiverId,
				message: "축하해요! 🎉",
			});

			expect(result.id).toBe(mockCheerId);
			expect(mockFollowService.isMutualFriend).toHaveBeenCalledWith(
				mockSenderId,
				mockReceiverId,
			);
			expect(mockEventEmitter.emit).toHaveBeenCalledWith(
				"cheer.sent",
				expect.any(Object),
			);
		});

		it("메시지 없이도 응원을 전송해야 함", async () => {
			const mockSender = createMockUser(mockSenderId);
			const mockReceiver = createMockUser(mockReceiverId);
			const mockCheer = createMockCheer({ message: null });

			mockFollowService.isMutualFriend.mockResolvedValue(true);
			mockUserDb.findUnique
				.mockResolvedValueOnce(mockSender)
				.mockResolvedValueOnce(mockReceiver);
			mockCheerDb.count.mockResolvedValue(0);
			mockCheerDb.findFirst.mockResolvedValue(null);
			mockCheerDb.create.mockResolvedValue(mockCheer);

			const result = await service.sendCheer({
				senderId: mockSenderId,
				receiverId: mockReceiverId,
			});

			expect(result.id).toBe(mockCheerId);
		});

		it("친구가 아니면 예외를 발생시켜야 함", async () => {
			mockFollowService.isMutualFriend.mockResolvedValue(false);

			await expect(
				service.sendCheer({
					senderId: mockSenderId,
					receiverId: mockReceiverId,
				}),
			).rejects.toThrow(BusinessException);
		});

		it("자기 자신에게 전송하면 예외를 발생시켜야 함", async () => {
			await expect(
				service.sendCheer({
					senderId: mockSenderId,
					receiverId: mockSenderId,
				}),
			).rejects.toThrow(BusinessException);
		});

		it("일일 제한 초과시 예외를 발생시켜야 함", async () => {
			const mockSender = createMockUser(mockSenderId, "FREE");
			const mockReceiver = createMockUser(mockReceiverId);

			mockFollowService.isMutualFriend.mockResolvedValue(true);
			mockUserDb.findUnique
				.mockResolvedValueOnce(mockSender)
				.mockResolvedValueOnce(mockReceiver);
			mockCheerDb.count.mockResolvedValue(3); // 일일 제한 도달

			await expect(
				service.sendCheer({
					senderId: mockSenderId,
					receiverId: mockReceiverId,
				}),
			).rejects.toThrow(BusinessException);
		});

		it("쿨다운 중이면 예외를 발생시켜야 함", async () => {
			const mockSender = createMockUser(mockSenderId);
			const mockReceiver = createMockUser(mockReceiverId);
			const recentCheer = createMockCheer({
				createdAt: new Date(), // 방금 생성됨
			});

			mockFollowService.isMutualFriend.mockResolvedValue(true);
			mockUserDb.findUnique
				.mockResolvedValueOnce(mockSender)
				.mockResolvedValueOnce(mockReceiver);
			mockCheerDb.count.mockResolvedValue(0);
			mockCheerDb.findFirst.mockResolvedValue(recentCheer); // 쿨다운 활성화

			await expect(
				service.sendCheer({
					senderId: mockSenderId,
					receiverId: mockReceiverId,
				}),
			).rejects.toThrow(BusinessException);
		});
	});

	describe("받은 응원 목록 조회 통합 테스트", () => {
		it("받은 응원 목록을 조회해야 함", async () => {
			const mockCheers = [
				createMockCheer({ id: 1 }),
				createMockCheer({ id: 2 }),
			];
			mockCheerDb.findMany.mockResolvedValue(mockCheers);
			mockCheerDb.count.mockResolvedValue(2);

			const result = await service.getReceivedCheers({
				userId: mockReceiverId,
			});

			expect(result.items).toBeDefined();
			expect(result.pagination).toBeDefined();
			expect(mockCheerDb.findMany).toHaveBeenCalled();
		});

		it("받은 응원 목록에 sender.userTag가 포함되어야 함", async () => {
			const mockCheers = [createMockCheer({ id: 1 })];
			mockCheerDb.findMany.mockResolvedValue(mockCheers);
			mockCheerDb.count.mockResolvedValue(1);

			const result = await service.getReceivedCheers({
				userId: mockReceiverId,
			});

			expect(result.items[0]?.sender.userTag).toBeDefined();
			expect(result.items[0]?.sender.userTag).toBe("SENDER12");
		});
	});

	describe("보낸 응원 목록 조회 통합 테스트", () => {
		it("보낸 응원 목록을 조회해야 함", async () => {
			const mockCheers = [
				createMockCheer({ id: 1 }),
				createMockCheer({ id: 2 }),
			];
			mockCheerDb.findMany.mockResolvedValue(mockCheers);
			mockCheerDb.count.mockResolvedValue(2);

			const result = await service.getSentCheers({ userId: mockSenderId });

			expect(result.items).toBeDefined();
			expect(result.pagination).toBeDefined();
			expect(mockCheerDb.findMany).toHaveBeenCalled();
		});

		it("보낸 응원 목록에 sender.userTag가 포함되어야 함", async () => {
			const mockCheers = [createMockCheer({ id: 1 })];
			mockCheerDb.findMany.mockResolvedValue(mockCheers);
			mockCheerDb.count.mockResolvedValue(1);

			const result = await service.getSentCheers({
				userId: mockSenderId,
			});

			expect(result.items[0]?.sender.userTag).toBeDefined();
			expect(result.items[0]?.sender.userTag).toBe("SENDER12");
		});
	});

	describe("일일 제한 정보 조회 통합 테스트", () => {
		it("FREE 사용자의 제한 정보를 반환해야 함", async () => {
			const mockUser = createMockUser(mockSenderId, "FREE");
			mockUserDb.findUnique.mockResolvedValue(mockUser);
			mockCheerDb.count.mockResolvedValue(2);

			const result = await service.getLimitInfo(mockSenderId);

			expect(result.dailyLimit).toBe(3);
			expect(result.remaining).toBe(1);
			expect(result.used).toBe(2);
		});

		it("ACTIVE 사용자는 무제한이어야 함", async () => {
			// 이전 테스트의 mock 설정 초기화
			mockUserDb.findUnique.mockReset();
			mockCheerDb.count.mockReset();

			const mockUser = createMockUser(mockSenderId, "ACTIVE");
			mockUserDb.findUnique.mockResolvedValue(mockUser);
			mockCheerDb.count.mockResolvedValue(10);

			const result = await service.getLimitInfo(mockSenderId);

			expect(result.dailyLimit).toBeNull(); // null means unlimited
			expect(result.remaining).toBeNull();
		});
	});

	describe("쿨다운 정보 조회 통합 테스트", () => {
		it("쿨다운이 없으면 false를 반환해야 함", async () => {
			mockCheerDb.findFirst.mockResolvedValue(null);

			const result = await service.getCooldownInfoForUser(
				mockSenderId,
				mockReceiverId,
			);

			expect(result.isActive).toBe(false);
		});

		it("쿨다운 중이면 남은 시간을 반환해야 함", async () => {
			const recentCheer = createMockCheer({
				createdAt: new Date(),
			});
			mockCheerDb.findFirst.mockResolvedValue(recentCheer);

			const result = await service.getCooldownInfoForUser(
				mockSenderId,
				mockReceiverId,
			);

			expect(result.isActive).toBe(true);
			expect(result.remainingSeconds).toBeGreaterThan(0);
		});
	});

	describe("읽음 처리 통합 테스트", () => {
		it("응원을 읽음 처리해야 함", async () => {
			const mockCheer = createMockCheer({ readAt: null });
			mockCheerDb.findUnique.mockResolvedValue(mockCheer);
			mockCheerDb.update.mockResolvedValue({
				...mockCheer,
				readAt: new Date(),
			});

			await service.markAsRead(mockReceiverId, mockCheerId);

			expect(mockCheerDb.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: mockCheerId },
				}),
			);
		});

		it("존재하지 않는 응원이면 예외를 발생시켜야 함", async () => {
			mockCheerDb.findUnique.mockResolvedValue(null);

			await expect(service.markAsRead(mockReceiverId, 999)).rejects.toThrow(
				BusinessException,
			);
		});

		it("다른 사용자의 응원이면 예외를 발생시켜야 함", async () => {
			const mockCheer = createMockCheer({ receiverId: "other-user" });
			mockCheerDb.findUnique.mockResolvedValue(mockCheer);

			await expect(
				service.markAsRead(mockReceiverId, mockCheerId),
			).rejects.toThrow(BusinessException);
		});

		it("여러 응원을 읽음 처리해야 함", async () => {
			mockCheerDb.updateMany.mockResolvedValue({ count: 5 });

			const result = await service.markManyAsRead(
				mockReceiverId,
				[1, 2, 3, 4, 5],
			);

			expect(result).toBe(5);
			expect(mockCheerDb.updateMany).toHaveBeenCalledWith({
				where: {
					id: { in: [1, 2, 3, 4, 5] },
					receiverId: mockReceiverId,
					readAt: null,
				},
				data: {
					readAt: expect.any(Date),
				},
			});
		});
	});
});
