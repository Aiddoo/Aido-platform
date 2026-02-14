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

import { EventEmitter2 } from "@nestjs/event-emitter";
import { Test, type TestingModule } from "@nestjs/testing";
import { CheerBuilder, UserBuilder } from "@test/builders";
import { createMockDatabaseService } from "@test/mocks/mock-database.factory";
import { suppressLogger } from "@test/setup/suppress-logger";
import { CacheService } from "@/common/cache/cache.service";
import { TypedConfigService } from "@/common/config/services/config.service";
import { BusinessException } from "@/common/exception/services/business-exception.service";
import { PaginationService } from "@/common/pagination/services/pagination.service";
import { DatabaseService } from "@/database/database.service";
import { CheerRepository } from "@/modules/cheer/cheer.repository";
import { CheerService } from "@/modules/cheer/cheer.service";
import { FollowService } from "@/modules/follow/follow.service";

describe("CheerService 통합 테스트 (Mock DB)", () => {
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

	const mockDatabaseService = createMockDatabaseService({
		cheer: mockCheerDb,
		user: mockUserDb,
	});

	// Mock FollowService
	const mockFollowService = {
		isMutualFriend: jest.fn(),
	};

	// Mock EventEmitter
	const mockEventEmitter = {
		emit: jest.fn(),
	};

	// Mock CacheService
	const mockCacheService = {
		getSubscription: jest.fn(),
		setSubscription: jest.fn(),
		invalidateSubscription: jest.fn(),
	};

	// 테스트 데이터
	const mockSenderId = "user-cheer-sender-123";
	const mockReceiverId = "user-cheer-receiver-456";
	const mockCheerId = 1;

	beforeAll(async () => {
		suppressLogger();

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
				{
					provide: CacheService,
					useValue: mockCacheService,
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
		CheerBuilder.resetIdCounter();
	});

	describe("DI 통합 테스트", () => {
		it("CheerService가 정상적으로 주입되어야 함", () => {
			// Given - NestJS 테스트 모듈 설정 완료

			// When - 서비스 인스턴스 확인

			// Then - 서비스가 정의되어 있어야 함
			expect(service).toBeDefined();
			expect(service).toBeInstanceOf(CheerService);
		});

		it("CheerRepository가 정상적으로 주입되어야 함", () => {
			// Given - NestJS 테스트 모듈 설정 완료

			// When - 레포지토리 인스턴스 확인

			// Then - 레포지토리가 정의되어 있어야 함
			expect(repository).toBeDefined();
			expect(repository).toBeInstanceOf(CheerRepository);
		});
	});

	describe("응원 전송 통합 테스트", () => {
		it("친구에게 응원을 전송해야 함", async () => {
			// Given - 친구 관계의 두 사용자 준비
			const mockSender = UserBuilder.create()
				.withId(mockSenderId)
				.verified()
				.build();
			const mockReceiver = UserBuilder.create()
				.withId(mockReceiverId)
				.verified()
				.build();
			const mockCheer = CheerBuilder.create(mockSenderId, mockReceiverId)
				.withId(mockCheerId)
				.withMessage("축하해요!")
				.withSenderInfo({
					id: mockSenderId,
					userTag: "SENDER12",
					profile: { name: "Sender User", profileImage: null },
				})
				.withReceiverInfo({
					id: mockReceiverId,
					userTag: "RECEIVER",
					profile: { name: "Receiver User", profileImage: null },
				})
				.buildWithRelations();

			mockFollowService.isMutualFriend.mockResolvedValue(true);
			mockUserDb.findUnique
				.mockResolvedValueOnce({
					...mockSender,
					profile: {
						id: "profile-1",
						userId: mockSenderId,
						name: "Sender User",
						profileImage: null,
					},
				})
				.mockResolvedValueOnce({
					...mockReceiver,
					profile: {
						id: "profile-2",
						userId: mockReceiverId,
						name: "Receiver User",
						profileImage: null,
					},
				});
			mockCheerDb.count.mockResolvedValue(0);
			mockCheerDb.findFirst.mockResolvedValue(null);
			mockCheerDb.create.mockResolvedValue(mockCheer);

			// When - 응원 전송
			const result = await service.sendCheer({
				senderId: mockSenderId,
				receiverId: mockReceiverId,
				message: "축하해요!",
			});

			// Then - 응원이 성공적으로 전송되어야 함
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
			// Given - 메시지 없는 응원 데이터 준비
			const mockSender = UserBuilder.create()
				.withId(mockSenderId)
				.verified()
				.build();
			const mockReceiver = UserBuilder.create()
				.withId(mockReceiverId)
				.verified()
				.build();
			const mockCheer = CheerBuilder.create(mockSenderId, mockReceiverId)
				.withId(mockCheerId)
				.withSenderInfo({
					id: mockSenderId,
					userTag: "SENDER12",
					profile: { name: "Sender User", profileImage: null },
				})
				.withReceiverInfo({
					id: mockReceiverId,
					userTag: "RECEIVER",
					profile: { name: "Receiver User", profileImage: null },
				})
				.buildWithRelations();

			mockFollowService.isMutualFriend.mockResolvedValue(true);
			mockUserDb.findUnique
				.mockResolvedValueOnce({
					...mockSender,
					profile: {
						id: "profile-1",
						userId: mockSenderId,
						name: "Sender User",
						profileImage: null,
					},
				})
				.mockResolvedValueOnce({
					...mockReceiver,
					profile: {
						id: "profile-2",
						userId: mockReceiverId,
						name: "Receiver User",
						profileImage: null,
					},
				});
			mockCheerDb.count.mockResolvedValue(0);
			mockCheerDb.findFirst.mockResolvedValue(null);
			mockCheerDb.create.mockResolvedValue(mockCheer);

			// When - 메시지 없이 응원 전송
			const result = await service.sendCheer({
				senderId: mockSenderId,
				receiverId: mockReceiverId,
			});

			// Then - 응원이 성공적으로 전송되어야 함
			expect(result.id).toBe(mockCheerId);
		});

		it("친구가 아니면 예외를 발생시켜야 함", async () => {
			// Given - 친구가 아닌 상태로 설정
			mockFollowService.isMutualFriend.mockResolvedValue(false);

			// When & Then - 친구가 아니면 예외 발생
			await expect(
				service.sendCheer({
					senderId: mockSenderId,
					receiverId: mockReceiverId,
				}),
			).rejects.toThrow(BusinessException);
		});

		it("자기 자신에게 전송하면 예외를 발생시켜야 함", async () => {
			// Given - 자기 자신에게 응원 전송 시도

			// When & Then - 자기 자신에게 전송 시 예외 발생
			await expect(
				service.sendCheer({
					senderId: mockSenderId,
					receiverId: mockSenderId,
				}),
			).rejects.toThrow(BusinessException);
		});

		it("일일 제한 초과시 예외를 발생시켜야 함", async () => {
			// Given - FREE 사용자가 일일 제한에 도달한 상태
			const mockSender = UserBuilder.create()
				.withId(mockSenderId)
				.verified()
				.withSubscription("FREE")
				.build();
			const mockReceiver = UserBuilder.create()
				.withId(mockReceiverId)
				.verified()
				.build();

			mockFollowService.isMutualFriend.mockResolvedValue(true);
			mockUserDb.findUnique
				.mockResolvedValueOnce({
					...mockSender,
					profile: {
						id: "profile-1",
						userId: mockSenderId,
						name: "Sender User",
						profileImage: null,
					},
				})
				.mockResolvedValueOnce({
					...mockReceiver,
					profile: {
						id: "profile-2",
						userId: mockReceiverId,
						name: "Receiver User",
						profileImage: null,
					},
				});
			mockCheerDb.count.mockResolvedValue(3);

			// When & Then - 일일 제한 초과 시 예외 발생
			await expect(
				service.sendCheer({
					senderId: mockSenderId,
					receiverId: mockReceiverId,
				}),
			).rejects.toThrow(BusinessException);
		});

		it("쿨다운 중이면 예외를 발생시켜야 함", async () => {
			// Given - 최근에 응원을 보낸 상태 (쿨다운 활성화)
			const mockSender = UserBuilder.create()
				.withId(mockSenderId)
				.verified()
				.build();
			const mockReceiver = UserBuilder.create()
				.withId(mockReceiverId)
				.verified()
				.build();
			const recentCheer = CheerBuilder.create(mockSenderId, mockReceiverId)
				.withCreatedAt(new Date())
				.buildWithRelations();

			mockFollowService.isMutualFriend.mockResolvedValue(true);
			mockUserDb.findUnique
				.mockResolvedValueOnce({
					...mockSender,
					profile: {
						id: "profile-1",
						userId: mockSenderId,
						name: "Sender User",
						profileImage: null,
					},
				})
				.mockResolvedValueOnce({
					...mockReceiver,
					profile: {
						id: "profile-2",
						userId: mockReceiverId,
						name: "Receiver User",
						profileImage: null,
					},
				});
			mockCheerDb.count.mockResolvedValue(0);
			mockCheerDb.findFirst.mockResolvedValue(recentCheer);

			// When & Then - 쿨다운 중이면 예외 발생
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
			// Given - 받은 응원 데이터 준비
			const mockCheers = [
				CheerBuilder.create(mockSenderId, mockReceiverId)
					.withId(1)
					.withSenderInfo({
						id: mockSenderId,
						userTag: "SENDER12",
						profile: { name: "Sender User", profileImage: null },
					})
					.withReceiverInfo({
						id: mockReceiverId,
						userTag: "RECEIVER",
						profile: { name: "Receiver User", profileImage: null },
					})
					.buildWithRelations(),
				CheerBuilder.create(mockSenderId, mockReceiverId)
					.withId(2)
					.withSenderInfo({
						id: mockSenderId,
						userTag: "SENDER12",
						profile: { name: "Sender User", profileImage: null },
					})
					.withReceiverInfo({
						id: mockReceiverId,
						userTag: "RECEIVER",
						profile: { name: "Receiver User", profileImage: null },
					})
					.buildWithRelations(),
			];
			mockCheerDb.findMany.mockResolvedValue(mockCheers);
			mockCheerDb.count.mockResolvedValue(2);

			// When - 받은 응원 목록 조회
			const result = await service.getReceivedCheers({
				userId: mockReceiverId,
			});

			// Then - 응원 목록과 페이지네이션 정보가 반환되어야 함
			expect(result.items).toBeDefined();
			expect(result.pagination).toBeDefined();
			expect(mockCheerDb.findMany).toHaveBeenCalled();
		});

		it("받은 응원 목록에 sender.userTag가 포함되어야 함", async () => {
			// Given - sender 정보가 포함된 응원 데이터 준비
			const mockCheers = [
				CheerBuilder.create(mockSenderId, mockReceiverId)
					.withId(1)
					.withSenderInfo({
						id: mockSenderId,
						userTag: "SENDER12",
						profile: { name: "Sender User", profileImage: null },
					})
					.withReceiverInfo({
						id: mockReceiverId,
						userTag: "RECEIVER",
						profile: { name: "Receiver User", profileImage: null },
					})
					.buildWithRelations(),
			];
			mockCheerDb.findMany.mockResolvedValue(mockCheers);
			mockCheerDb.count.mockResolvedValue(1);

			// When - 받은 응원 목록 조회
			const result = await service.getReceivedCheers({
				userId: mockReceiverId,
			});

			// Then - sender.userTag가 포함되어야 함
			expect(result.items[0]?.sender.userTag).toBeDefined();
			expect(result.items[0]?.sender.userTag).toBe("SENDER12");
		});
	});

	describe("보낸 응원 목록 조회 통합 테스트", () => {
		it("보낸 응원 목록을 조회해야 함", async () => {
			// Given - 보낸 응원 데이터 준비
			const mockCheers = [
				CheerBuilder.create(mockSenderId, mockReceiverId)
					.withId(1)
					.withSenderInfo({
						id: mockSenderId,
						userTag: "SENDER12",
						profile: { name: "Sender User", profileImage: null },
					})
					.withReceiverInfo({
						id: mockReceiverId,
						userTag: "RECEIVER",
						profile: { name: "Receiver User", profileImage: null },
					})
					.buildWithRelations(),
				CheerBuilder.create(mockSenderId, mockReceiverId)
					.withId(2)
					.withSenderInfo({
						id: mockSenderId,
						userTag: "SENDER12",
						profile: { name: "Sender User", profileImage: null },
					})
					.withReceiverInfo({
						id: mockReceiverId,
						userTag: "RECEIVER",
						profile: { name: "Receiver User", profileImage: null },
					})
					.buildWithRelations(),
			];
			mockCheerDb.findMany.mockResolvedValue(mockCheers);
			mockCheerDb.count.mockResolvedValue(2);

			// When - 보낸 응원 목록 조회
			const result = await service.getSentCheers({ userId: mockSenderId });

			// Then - 응원 목록과 페이지네이션 정보가 반환되어야 함
			expect(result.items).toBeDefined();
			expect(result.pagination).toBeDefined();
			expect(mockCheerDb.findMany).toHaveBeenCalled();
		});

		it("보낸 응원 목록에 sender.userTag가 포함되어야 함", async () => {
			// Given - sender 정보가 포함된 응원 데이터 준비
			const mockCheers = [
				CheerBuilder.create(mockSenderId, mockReceiverId)
					.withId(1)
					.withSenderInfo({
						id: mockSenderId,
						userTag: "SENDER12",
						profile: { name: "Sender User", profileImage: null },
					})
					.withReceiverInfo({
						id: mockReceiverId,
						userTag: "RECEIVER",
						profile: { name: "Receiver User", profileImage: null },
					})
					.buildWithRelations(),
			];
			mockCheerDb.findMany.mockResolvedValue(mockCheers);
			mockCheerDb.count.mockResolvedValue(1);

			// When - 보낸 응원 목록 조회
			const result = await service.getSentCheers({
				userId: mockSenderId,
			});

			// Then - sender.userTag가 포함되어야 함
			expect(result.items[0]?.sender.userTag).toBeDefined();
			expect(result.items[0]?.sender.userTag).toBe("SENDER12");
		});
	});

	describe("일일 제한 정보 조회 통합 테스트", () => {
		it("FREE 사용자의 제한 정보를 반환해야 함", async () => {
			// Given - FREE 구독 사용자 준비
			const mockUser = UserBuilder.create()
				.withId(mockSenderId)
				.verified()
				.withSubscription("FREE")
				.build();
			mockUserDb.findUnique.mockResolvedValue({
				...mockUser,
				profile: {
					id: "profile-1",
					userId: mockSenderId,
					name: "Test User",
					profileImage: null,
				},
			});
			mockCheerDb.count.mockResolvedValue(2);

			// When - 제한 정보 조회
			const result = await service.getLimitInfo(mockSenderId);

			// Then - FREE 사용자의 제한 정보가 반환되어야 함
			expect(result.dailyLimit).toBe(3);
			expect(result.remaining).toBe(1);
			expect(result.used).toBe(2);
		});

		it("ACTIVE 사용자는 무제한이어야 함", async () => {
			// Given - ACTIVE 구독 사용자 준비
			mockUserDb.findUnique.mockReset();
			mockCheerDb.count.mockReset();

			const mockUser = UserBuilder.create()
				.withId(mockSenderId)
				.verified()
				.asPremium()
				.build();
			mockUserDb.findUnique.mockResolvedValue({
				...mockUser,
				profile: {
					id: "profile-1",
					userId: mockSenderId,
					name: "Test User",
					profileImage: null,
				},
			});
			mockCheerDb.count.mockResolvedValue(10);

			// When - 제한 정보 조회
			const result = await service.getLimitInfo(mockSenderId);

			// Then - 무제한이어야 함 (null)
			expect(result.dailyLimit).toBeNull();
			expect(result.remaining).toBeNull();
		});
	});

	describe("쿨다운 정보 조회 통합 테스트", () => {
		it("쿨다운이 없으면 false를 반환해야 함", async () => {
			// Given - 쿨다운이 없는 상태
			mockCheerDb.findFirst.mockResolvedValue(null);

			// When - 쿨다운 정보 조회
			const result = await service.getCooldownInfoForUser(
				mockSenderId,
				mockReceiverId,
			);

			// Then - 쿨다운이 비활성화 상태여야 함
			expect(result.isActive).toBe(false);
		});

		it("쿨다운 중이면 남은 시간을 반환해야 함", async () => {
			// Given - 최근에 응원을 보낸 상태 (쿨다운 활성화)
			const recentCheer = CheerBuilder.create(mockSenderId, mockReceiverId)
				.withCreatedAt(new Date())
				.build();
			mockCheerDb.findFirst.mockResolvedValue(recentCheer);

			// When - 쿨다운 정보 조회
			const result = await service.getCooldownInfoForUser(
				mockSenderId,
				mockReceiverId,
			);

			// Then - 쿨다운이 활성화되고 남은 시간이 반환되어야 함
			expect(result.isActive).toBe(true);
			expect(result.remainingSeconds).toBeGreaterThan(0);
		});
	});

	describe("읽음 처리 통합 테스트", () => {
		it("응원을 읽음 처리해야 함", async () => {
			// Given - 읽지 않은 응원 준비
			const mockCheer = CheerBuilder.create(mockSenderId, mockReceiverId)
				.withId(mockCheerId)
				.asUnread()
				.buildWithRelations();
			mockCheerDb.findUnique.mockResolvedValue(mockCheer);
			mockCheerDb.update.mockResolvedValue({
				...mockCheer,
				readAt: new Date(),
			});

			// When - 읽음 처리
			await service.markAsRead(mockReceiverId, mockCheerId);

			// Then - 읽음 처리가 호출되어야 함
			expect(mockCheerDb.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: mockCheerId },
				}),
			);
		});

		it("존재하지 않는 응원이면 예외를 발생시켜야 함", async () => {
			// Given - 존재하지 않는 응원 ID
			mockCheerDb.findUnique.mockResolvedValue(null);

			// When & Then - 존재하지 않는 응원 읽음 처리 시 예외 발생
			await expect(service.markAsRead(mockReceiverId, 999)).rejects.toThrow(
				BusinessException,
			);
		});

		it("다른 사용자의 응원이면 예외를 발생시켜야 함", async () => {
			// Given - 다른 사용자의 응원
			const mockCheer = CheerBuilder.create(mockSenderId, "other-user")
				.withId(mockCheerId)
				.buildWithRelations();
			mockCheerDb.findUnique.mockResolvedValue(mockCheer);

			// When & Then - 다른 사용자의 응원 읽음 처리 시 예외 발생
			await expect(
				service.markAsRead(mockReceiverId, mockCheerId),
			).rejects.toThrow(BusinessException);
		});

		it("여러 응원을 읽음 처리해야 함", async () => {
			// Given - 여러 개의 읽지 않은 응원
			mockCheerDb.updateMany.mockResolvedValue({ count: 5 });

			// When - 여러 응원 읽음 처리
			const result = await service.markManyAsRead(
				mockReceiverId,
				[1, 2, 3, 4, 5],
			);

			// Then - 모든 응원이 읽음 처리되어야 함
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
