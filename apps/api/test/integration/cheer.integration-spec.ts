/**
 * Cheer 모듈 통합 테스트 (Mock DB)
 *
 * 클린아키텍처(무버스 use-case) 구조로 재작성. CheerFacade·use-case·CheerReader가
 * PrismaCheerRepository(Mock DB)·알림/한도 어댑터·FollowFacade와 함께 DI로 조립되고
 * 동작하는지 검증한다. HTTP 계약은 e2e가 담당하며 여기서는 ApplicationException 발생만 확인한다.
 *
 * 실행: pnpm --filter @aido/api test cheer.integration-spec
 */

import { Test, type TestingModule } from "@nestjs/testing";
import { TransactionHost } from "@nestjs-cls/transactional";
import { CheerBuilder } from "@test/builders";
import { createMockDatabaseService } from "@test/mocks/mock-database.factory";
import { createUnitOfWorkMock } from "@test/mocks/ports";
import { suppressLogger } from "@test/setup/suppress-logger";

import { CheerFacade } from "@/cheer";
import { CHEER_REPOSITORY } from "@/cheer/application/ports/cheer.repository.port";
import { CHEER_LIMIT_READER } from "@/cheer/application/ports/cheer-limit-reader.port";
import { CHEER_NOTIFIER } from "@/cheer/application/ports/cheer-notifier.port";
import { CheerReader } from "@/cheer/application/services/cheer.reader";
import { MarkCheerReadUseCase } from "@/cheer/application/use-cases/mark-cheer-read/mark-cheer-read.use-case";
import { MarkManyCheersReadUseCase } from "@/cheer/application/use-cases/mark-many-cheers-read/mark-many-cheers-read.use-case";
import { SendCheerUseCase } from "@/cheer/application/use-cases/send-cheer/send-cheer.use-case";
import { CheerLimitReaderAdapter } from "@/cheer/infrastructure/adapters/cheer-limit-reader.adapter";
import { CheerNotifierAdapter } from "@/cheer/infrastructure/adapters/cheer-notifier.adapter";
import { PrismaCheerRepository } from "@/cheer/infrastructure/persistence/prisma-cheer.repository";
import { FollowFacade } from "@/follow";
import { NotificationQueueService } from "@/notification";
import { EntitlementService } from "@/shared/application/entitlement/entitlement.service";
import { PaginationService } from "@/shared/application/pagination/services/pagination.service";
import { MUTATION_LOCK, UNIT_OF_WORK } from "@/shared/application/ports";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";

describe("Cheer 모듈 통합 테스트 (Mock DB)", () => {
	let module: TestingModule;
	let facade: CheerFacade;

	const mockCheerDb = {
		create: jest.fn(),
		findUnique: jest.fn(),
		findFirst: jest.fn(),
		findMany: jest.fn(),
		update: jest.fn(),
		updateMany: jest.fn(),
		count: jest.fn(),
	};
	const mockUserDb = { findUnique: jest.fn() };
	const mockDatabaseService = createMockDatabaseService({
		cheer: mockCheerDb,
		user: mockUserDb,
	});

	const mockFollowFacade = { isMutualFriend: jest.fn() };
	const mockNotificationQueueService = { enqueueCheerSent: jest.fn() };
	const mockEntitlementService = {
		getFeatureLimit: jest.fn(),
		getFeatureLimitInTx: jest.fn(),
		calculateRemaining: jest.fn(),
	};

	const senderId = "user-cheer-sender-123";
	const receiverId = "user-cheer-receiver-456";
	const cheerId = 1;

	const withSenderReceiver = (b: CheerBuilder) =>
		b
			.withSenderInfo({
				id: senderId,
				userTag: "SENDER12",
				profile: { name: "Sender User", profileImage: null },
			})
			.withReceiverInfo({
				id: receiverId,
				userTag: "RECEIVER",
				profile: { name: "Receiver User", profileImage: null },
			})
			.buildWithRelations();

	beforeAll(async () => {
		suppressLogger();

		module = await Test.createTestingModule({
			providers: [
				CheerFacade,
				CheerReader,
				SendCheerUseCase,
				MarkCheerReadUseCase,
				MarkManyCheersReadUseCase,
				{ provide: CHEER_REPOSITORY, useClass: PrismaCheerRepository },
				{ provide: CHEER_NOTIFIER, useClass: CheerNotifierAdapter },
				{ provide: CHEER_LIMIT_READER, useClass: CheerLimitReaderAdapter },
				PaginationService,
				{ provide: UNIT_OF_WORK, useValue: createUnitOfWorkMock() },
				{
					provide: MUTATION_LOCK,
					useValue: { acquire: jest.fn().mockResolvedValue(undefined) },
				},
				{ provide: TransactionHost, useValue: { tx: mockDatabaseService } },
				{
					provide: TypedConfigService,
					useValue: {
						pagination: { defaultPageSize: 20, maxPageSize: 100 },
					},
				},
				{ provide: FollowFacade, useValue: mockFollowFacade },
				{
					provide: NotificationQueueService,
					useValue: mockNotificationQueueService,
				},
				{ provide: EntitlementService, useValue: mockEntitlementService },
			],
		}).compile();

		facade = module.get(CheerFacade);
	});

	afterAll(async () => {
		await module.close();
		jest.restoreAllMocks();
	});

	beforeEach(() => {
		jest.clearAllMocks();
		CheerBuilder.resetIdCounter();
		mockEntitlementService.getFeatureLimit.mockResolvedValue({
			dailyLimit: 3,
			isAdmin: false,
			subscriptionStatus: "FREE",
		});
		mockEntitlementService.getFeatureLimitInTx.mockResolvedValue({
			dailyLimit: 3,
			isAdmin: false,
			subscriptionStatus: "FREE",
		});
		mockEntitlementService.calculateRemaining.mockImplementation(
			(dailyLimit: number | null, used: number) =>
				dailyLimit === null ? null : Math.max(0, dailyLimit - used),
		);
	});

	describe("DI 통합", () => {
		it("CheerFacade가 조립된다", () => {
			expect(facade).toBeInstanceOf(CheerFacade);
		});
		it("CheerRepository 포트가 주입된다", () => {
			expect(module.get(CHEER_REPOSITORY)).toBeInstanceOf(
				PrismaCheerRepository,
			);
		});
	});

	describe("응원 전송", () => {
		it("친구에게 응원을 전송하고 알림을 enqueue한다", async () => {
			mockFollowFacade.isMutualFriend.mockResolvedValue(true);
			mockCheerDb.count.mockResolvedValue(0);
			mockCheerDb.findFirst.mockResolvedValue(null);
			mockCheerDb.create.mockResolvedValue(
				withSenderReceiver(
					CheerBuilder.create(senderId, receiverId)
						.withId(cheerId)
						.withMessage("축하해요!"),
				),
			);

			const result = await facade.sendCheer(
				{ senderId, receiverId, message: "축하해요!" },
				"UTC",
			);

			expect(result.id).toBe(cheerId);
			expect(mockFollowFacade.isMutualFriend).toHaveBeenCalledWith(
				senderId,
				receiverId,
			);
			expect(
				mockNotificationQueueService.enqueueCheerSent,
			).toHaveBeenCalledWith(expect.any(Object));
		});

		it("메시지 없이도 전송된다", async () => {
			mockFollowFacade.isMutualFriend.mockResolvedValue(true);
			mockCheerDb.count.mockResolvedValue(0);
			mockCheerDb.findFirst.mockResolvedValue(null);
			mockCheerDb.create.mockResolvedValue(
				withSenderReceiver(
					CheerBuilder.create(senderId, receiverId).withId(cheerId),
				),
			);

			const result = await facade.sendCheer({ senderId, receiverId }, "UTC");
			expect(result.id).toBe(cheerId);
		});

		it("친구가 아니면 ApplicationException", async () => {
			mockFollowFacade.isMutualFriend.mockResolvedValue(false);
			await expect(
				facade.sendCheer({ senderId, receiverId }, "UTC"),
			).rejects.toThrow(ApplicationException);
		});

		it("자기 자신에게 전송하면 ApplicationException", async () => {
			await expect(
				facade.sendCheer({ senderId, receiverId: senderId }, "UTC"),
			).rejects.toThrow(ApplicationException);
		});

		it("일일 제한 초과면 ApplicationException", async () => {
			mockFollowFacade.isMutualFriend.mockResolvedValue(true);
			mockCheerDb.count.mockResolvedValue(3);
			await expect(
				facade.sendCheer({ senderId, receiverId }, "UTC"),
			).rejects.toThrow(ApplicationException);
		});

		it("쿨다운 중이면 ApplicationException", async () => {
			mockFollowFacade.isMutualFriend.mockResolvedValue(true);
			mockCheerDb.count.mockResolvedValue(0);
			mockCheerDb.findFirst.mockResolvedValue(
				CheerBuilder.create(senderId, receiverId)
					.withCreatedAt(new Date())
					.build(),
			);
			await expect(
				facade.sendCheer({ senderId, receiverId }, "UTC"),
			).rejects.toThrow(ApplicationException);
		});
	});

	describe("목록 조회", () => {
		it("받은 응원 목록에 sender.userTag가 포함된다", async () => {
			mockCheerDb.findMany.mockResolvedValue([
				withSenderReceiver(CheerBuilder.create(senderId, receiverId).withId(1)),
			]);
			mockCheerDb.count.mockResolvedValue(1);

			const result = await facade.getReceivedCheers({ userId: receiverId });
			expect(result.items[0]?.sender.userTag).toBe("SENDER12");
		});

		it("보낸 응원 목록을 조회한다", async () => {
			mockCheerDb.findMany.mockResolvedValue([
				withSenderReceiver(CheerBuilder.create(senderId, receiverId).withId(1)),
				withSenderReceiver(CheerBuilder.create(senderId, receiverId).withId(2)),
			]);
			const result = await facade.getSentCheers({ userId: senderId });
			expect(result.items).toHaveLength(2);
			expect(result.pagination).toBeDefined();
		});
	});

	describe("일일 제한 정보", () => {
		it("FREE 사용자의 제한 정보", async () => {
			mockCheerDb.count.mockResolvedValue(2);
			const result = await facade.getLimitInfo(senderId, "UTC");
			expect(result.dailyLimit).toBe(3);
			expect(result.used).toBe(2);
			expect(result.remaining).toBe(1);
		});

		it("ACTIVE 사용자는 무제한", async () => {
			mockEntitlementService.getFeatureLimit.mockResolvedValue({
				dailyLimit: null,
				isAdmin: false,
				subscriptionStatus: "ACTIVE",
			});
			mockCheerDb.count.mockResolvedValue(10);
			const result = await facade.getLimitInfo(senderId, "UTC");
			expect(result.dailyLimit).toBeNull();
			expect(result.remaining).toBeNull();
		});
	});

	describe("쿨다운 정보", () => {
		it("기록이 없으면 비활성", async () => {
			mockCheerDb.findFirst.mockResolvedValue(null);
			const result = await facade.getCooldownInfoForUser(senderId, receiverId);
			expect(result.isActive).toBe(false);
		});

		it("최근 응원이 있으면 활성 + 남은 시간", async () => {
			mockCheerDb.findFirst.mockResolvedValue(
				CheerBuilder.create(senderId, receiverId)
					.withCreatedAt(new Date())
					.build(),
			);
			const result = await facade.getCooldownInfoForUser(senderId, receiverId);
			expect(result.isActive).toBe(true);
			expect(result.remainingSeconds).toBeGreaterThan(0);
		});
	});

	describe("읽음 처리", () => {
		it("응원을 읽음 처리한다", async () => {
			mockCheerDb.findUnique.mockResolvedValue(
				CheerBuilder.create(senderId, receiverId)
					.withId(cheerId)
					.asUnread()
					.build(),
			);
			mockCheerDb.update.mockResolvedValue({});

			await facade.markAsRead(receiverId, cheerId);
			expect(mockCheerDb.update).toHaveBeenCalledWith(
				expect.objectContaining({ where: { id: cheerId } }),
			);
		});

		it("존재하지 않으면 ApplicationException", async () => {
			mockCheerDb.findUnique.mockResolvedValue(null);
			await expect(facade.markAsRead(receiverId, 999)).rejects.toThrow(
				ApplicationException,
			);
		});

		it("다른 사용자의 응원이면 ApplicationException", async () => {
			mockCheerDb.findUnique.mockResolvedValue(
				CheerBuilder.create(senderId, "other-user").withId(cheerId).build(),
			);
			await expect(facade.markAsRead(receiverId, cheerId)).rejects.toThrow(
				ApplicationException,
			);
		});

		it("여러 응원을 읽음 처리한다", async () => {
			mockCheerDb.updateMany.mockResolvedValue({ count: 5 });
			const result = await facade.markManyAsRead(receiverId, [1, 2, 3, 4, 5]);
			expect(result).toBe(5);
			expect(mockCheerDb.updateMany).toHaveBeenCalledWith({
				where: { id: { in: [1, 2, 3, 4, 5] }, receiverId, readAt: null },
				data: { readAt: expect.any(Date) },
			});
		});
	});
});
