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

import { EventEmitter2 } from "@nestjs/event-emitter";
import { Test, type TestingModule } from "@nestjs/testing";
import { NudgeBuilder, TodoBuilder, UserBuilder } from "@test/builders";
import { createMockDatabaseService } from "@test/mocks/mock-database.factory";
import { suppressLogger } from "@test/setup/suppress-logger";
import { TypedConfigService } from "@/common/config/services/config.service";
import { subtractDays } from "@/common/date/utils/arithmetic";
import { todayInTimezone } from "@/common/date/utils/timezone";
import { BusinessException } from "@/common/exception/services/business-exception.service";
import { PaginationService } from "@/common/pagination/services/pagination.service";
import { DatabaseService } from "@/database/database.service";
import { FollowService } from "@/modules/follow/follow.service";
import { NudgeRepository } from "@/modules/nudge/nudge.repository";
import { NudgeService } from "@/modules/nudge/nudge.service";

describe("NudgeService 통합 테스트 (Mock DB)", () => {
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

	const mockDatabaseService = createMockDatabaseService({
		nudge: mockNudgeDb,
		user: mockUserDb,
		todo: mockTodoDb,
	});

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

	beforeAll(async () => {
		suppressLogger();

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

	const todayMidnight = todayInTimezone("UTC");

	beforeEach(() => {
		jest.clearAllMocks();
		NudgeBuilder.resetIdCounter();
		TodoBuilder.resetIdCounter();
	});

	describe("DI 통합 테스트", () => {
		it("NudgeService가 정상적으로 주입되어야 함", () => {
			// Given - NestJS 테스트 모듈 설정 완료

			// When - 서비스 인스턴스 확인

			// Then - 서비스가 정의되어 있어야 함
			expect(service).toBeDefined();
			expect(service).toBeInstanceOf(NudgeService);
		});

		it("NudgeRepository가 정상적으로 주입되어야 함", () => {
			// Given - NestJS 테스트 모듈 설정 완료

			// When - 레포지토리 인스턴스 확인

			// Then - 레포지토리가 정의되어 있어야 함
			expect(repository).toBeDefined();
			expect(repository).toBeInstanceOf(NudgeRepository);
		});
	});

	describe("콕 찌르기 전송 통합 테스트", () => {
		it("친구에게 콕 찌르기를 전송해야 함", async () => {
			// Given - 친구 관계의 두 사용자와 Todo 준비
			const mockSender = UserBuilder.create()
				.withId(mockSenderId)
				.verified()
				.build();
			const mockReceiver = UserBuilder.create()
				.withId(mockReceiverId)
				.verified()
				.build();
			const mockTodo = TodoBuilder.create(mockReceiverId)
				.withId(mockTodoId)
				.withTitle("테스트 할일")
				.withStartDate(todayMidnight)
				.build();
			const mockNudge = NudgeBuilder.create(
				mockSenderId,
				mockReceiverId,
				mockTodoId,
			)
				.withId(mockNudgeId)
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
				.withTodoInfo({
					id: mockTodoId,
					title: "테스트 할일",
					completed: false,
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
			mockTodoDb.findUnique.mockResolvedValue(mockTodo);
			mockNudgeDb.count.mockResolvedValue(0);
			mockNudgeDb.findFirst.mockResolvedValue(null);
			mockNudgeDb.create.mockResolvedValue(mockNudge);

			// When - 콕 찌르기 전송
			const result = await service.sendNudge({
				senderId: mockSenderId,
				receiverId: mockReceiverId,
				todoId: mockTodoId,
			});

			// Then - 콕 찌르기가 성공적으로 전송되어야 함
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
			// Given - 친구가 아닌 상태로 설정
			mockFollowService.isMutualFriend.mockResolvedValue(false);

			// When & Then - 친구가 아니면 예외 발생
			await expect(
				service.sendNudge({
					senderId: mockSenderId,
					receiverId: mockReceiverId,
					todoId: mockTodoId,
				}),
			).rejects.toThrow(BusinessException);
		});

		it("자기 자신에게 전송하면 예외를 발생시켜야 함", async () => {
			// Given - 자기 자신에게 콕 찌르기 전송 시도

			// When & Then - 자기 자신에게 전송 시 예외 발생
			await expect(
				service.sendNudge({
					senderId: mockSenderId,
					receiverId: mockSenderId,
					todoId: mockTodoId,
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
			const mockTodo = TodoBuilder.create(mockReceiverId)
				.withId(mockTodoId)
				.withStartDate(todayMidnight)
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
			mockTodoDb.findUnique.mockResolvedValue(mockTodo);
			mockNudgeDb.count.mockResolvedValue(3);

			// When & Then - 일일 제한 초과 시 예외 발생
			await expect(
				service.sendNudge({
					senderId: mockSenderId,
					receiverId: mockReceiverId,
					todoId: mockTodoId,
				}),
			).rejects.toThrow(BusinessException);
		});

		it("쿨다운 중이면 예외를 발생시켜야 함", async () => {
			// Given - 최근에 콕 찌르기를 보낸 상태 (쿨다운 활성화)
			const mockSender = UserBuilder.create()
				.withId(mockSenderId)
				.verified()
				.build();
			const mockReceiver = UserBuilder.create()
				.withId(mockReceiverId)
				.verified()
				.build();
			const mockTodo = TodoBuilder.create(mockReceiverId)
				.withId(mockTodoId)
				.withStartDate(todayMidnight)
				.build();
			const recentNudge = NudgeBuilder.create(
				mockSenderId,
				mockReceiverId,
				mockTodoId,
			)
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
			mockTodoDb.findUnique.mockResolvedValue(mockTodo);
			mockNudgeDb.count.mockResolvedValue(0);
			mockNudgeDb.findFirst.mockResolvedValue(recentNudge);

			// When & Then - 쿨다운 중이면 예외 발생
			await expect(
				service.sendNudge({
					senderId: mockSenderId,
					receiverId: mockReceiverId,
					todoId: mockTodoId,
				}),
			).rejects.toThrow(BusinessException);
		});

		it("오늘의 할 일이 아니면 예외를 발생시켜야 함", async () => {
			// Given - 어제 날짜의 Todo
			const yesterday = subtractDays(1, todayMidnight);
			const mockTodo = TodoBuilder.create(mockReceiverId)
				.withId(mockTodoId)
				.withStartDate(yesterday)
				.build();

			mockFollowService.isMutualFriend.mockResolvedValue(true);
			mockUserDb.findUnique.mockResolvedValueOnce({
				subscriptionStatus: "FREE",
			});
			mockTodoDb.findUnique.mockResolvedValue(mockTodo);

			// When & Then - 오늘의 할 일이 아니므로 예외 발생
			await expect(
				service.sendNudge({
					senderId: mockSenderId,
					receiverId: mockReceiverId,
					todoId: mockTodoId,
				}),
			).rejects.toThrow(BusinessException);
		});

		it("비공개 Todo면 예외를 발생시켜야 함", async () => {
			// Given - 오늘 날짜지만 PRIVATE인 Todo
			const mockTodo = TodoBuilder.create(mockReceiverId)
				.withId(mockTodoId)
				.withStartDate(todayMidnight)
				.asPrivate()
				.build();

			mockFollowService.isMutualFriend.mockResolvedValue(true);
			mockTodoDb.findUnique.mockResolvedValue(mockTodo);

			// When & Then - PRIVATE Todo는 은닉 처리로 예외 발생
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
			// Given - 받은 콕 찌르기 데이터 준비
			const mockNudges = [
				NudgeBuilder.create(mockSenderId, mockReceiverId, 1)
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
					.withTodoInfo({ id: 1, title: "할 일 1", completed: false })
					.buildWithRelations(),
				NudgeBuilder.create(mockSenderId, mockReceiverId, 2)
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
					.withTodoInfo({ id: 2, title: "할 일 2", completed: false })
					.buildWithRelations(),
			];
			mockNudgeDb.findMany.mockResolvedValue(mockNudges);
			mockNudgeDb.count.mockResolvedValue(2);

			// When - 받은 콕 찌르기 목록 조회
			const result = await service.getReceivedNudges({
				userId: mockReceiverId,
			});

			// Then - 콕 찌르기 목록과 페이지네이션 정보가 반환되어야 함
			expect(result.items).toBeDefined();
			expect(result.pagination).toBeDefined();
			expect(mockNudgeDb.findMany).toHaveBeenCalled();
		});

		it("받은 콕 찌르기 목록에 sender.userTag가 포함되어야 함", async () => {
			// Given - sender 정보가 포함된 콕 찌르기 데이터 준비
			const mockNudges = [
				NudgeBuilder.create(mockSenderId, mockReceiverId, mockTodoId)
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
			mockNudgeDb.findMany.mockResolvedValue(mockNudges);
			mockNudgeDb.count.mockResolvedValue(1);

			// When - 받은 콕 찌르기 목록 조회
			const result = await service.getReceivedNudges({
				userId: mockReceiverId,
			});

			// Then - sender.userTag가 포함되어야 함
			expect(result.items[0]?.sender.userTag).toBeDefined();
			expect(result.items[0]?.sender.userTag).toBe("SENDER12");
		});
	});

	describe("보낸 콕 찌르기 목록 조회 통합 테스트", () => {
		it("보낸 콕 찌르기 목록을 조회해야 함", async () => {
			// Given - 보낸 콕 찌르기 데이터 준비
			const mockNudges = [
				NudgeBuilder.create(mockSenderId, mockReceiverId, 1)
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
				NudgeBuilder.create(mockSenderId, mockReceiverId, 2)
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
			mockNudgeDb.findMany.mockResolvedValue(mockNudges);
			mockNudgeDb.count.mockResolvedValue(2);

			// When - 보낸 콕 찌르기 목록 조회
			const result = await service.getSentNudges({ userId: mockSenderId });

			// Then - 콕 찌르기 목록과 페이지네이션 정보가 반환되어야 함
			expect(result.items).toBeDefined();
			expect(result.pagination).toBeDefined();
			expect(mockNudgeDb.findMany).toHaveBeenCalled();
		});

		it("보낸 콕 찌르기 목록에 sender.userTag가 포함되어야 함", async () => {
			// Given - sender 정보가 포함된 콕 찌르기 데이터 준비
			const mockNudges = [
				NudgeBuilder.create(mockSenderId, mockReceiverId, mockTodoId)
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
			mockNudgeDb.findMany.mockResolvedValue(mockNudges);
			mockNudgeDb.count.mockResolvedValue(1);

			// When - 보낸 콕 찌르기 목록 조회
			const result = await service.getSentNudges({ userId: mockSenderId });

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
			mockNudgeDb.count.mockResolvedValue(2);

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
			mockNudgeDb.count.mockReset();

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
			mockNudgeDb.count.mockResolvedValue(10);

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
			mockNudgeDb.findFirst.mockResolvedValue(null);

			// When - 쿨다운 정보 조회
			const result = await service.getCooldownInfoForUser(
				mockSenderId,
				mockReceiverId,
			);

			// Then - 쿨다운이 비활성화 상태여야 함
			expect(result.isActive).toBe(false);
		});

		it("쿨다운 중이면 남은 시간을 반환해야 함", async () => {
			// Given - 최근에 콕 찌르기를 보낸 상태 (쿨다운 활성화)
			const recentNudge = NudgeBuilder.create(
				mockSenderId,
				mockReceiverId,
				mockTodoId,
			)
				.withCreatedAt(new Date())
				.build();
			mockNudgeDb.findFirst.mockResolvedValue(recentNudge);

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
		it("콕 찌르기를 읽음 처리해야 함", async () => {
			// Given - 읽지 않은 콕 찌르기 준비
			const mockNudge = NudgeBuilder.create(
				mockSenderId,
				mockReceiverId,
				mockTodoId,
			)
				.withId(mockNudgeId)
				.asUnread()
				.buildWithRelations();
			mockNudgeDb.findUnique.mockResolvedValue(mockNudge);
			mockNudgeDb.update.mockResolvedValue({
				...mockNudge,
				readAt: new Date(),
			});

			// When - 읽음 처리
			await service.markAsRead(mockReceiverId, mockNudgeId);

			// Then - 읽음 처리가 호출되어야 함
			expect(mockNudgeDb.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: mockNudgeId },
				}),
			);
		});

		it("존재하지 않는 콕 찌르기면 예외를 발생시켜야 함", async () => {
			// Given - 존재하지 않는 콕 찌르기 ID
			mockNudgeDb.findUnique.mockResolvedValue(null);

			// When & Then - 존재하지 않는 콕 찌르기 읽음 처리 시 예외 발생
			await expect(service.markAsRead(mockReceiverId, 999)).rejects.toThrow(
				BusinessException,
			);
		});

		it("다른 사용자의 콕 찌르기면 예외를 발생시켜야 함", async () => {
			// Given - 다른 사용자의 콕 찌르기
			const mockNudge = NudgeBuilder.create(
				mockSenderId,
				"other-user",
				mockTodoId,
			)
				.withId(mockNudgeId)
				.buildWithRelations();
			mockNudgeDb.findUnique.mockResolvedValue(mockNudge);

			// When & Then - 다른 사용자의 콕 찌르기 읽음 처리 시 예외 발생
			await expect(
				service.markAsRead(mockReceiverId, mockNudgeId),
			).rejects.toThrow(BusinessException);
		});
	});
});
