/**
 * Nudge 모듈 통합 테스트 (Mock DB)
 *
 * endpoint use-case와 NudgeReader가
 * PrismaNudgeRepository(Mock DB)·알림/한도 어댑터·FollowReader와 함께 DI로 조립되고
 * 동작하는지 검증한다. HTTP 계약은 e2e가 담당하며 여기서는 ApplicationException 발생만 확인한다.
 *
 * 실행: pnpm --filter @aido/api test nudge.integration-spec
 */

import { TransactionHost } from "@nestjs-cls/transactional";
import { Test, type TestingModule } from "@nestjs/testing";
import { NudgeBuilder, TodoBuilder } from "@test/builders";
import { createMockDatabaseService } from "@test/mocks/mock-database.factory";
import { createUnitOfWorkMock } from "@test/mocks/ports";
import { suppressLogger } from "@test/setup/suppress-logger";

import { FollowReader } from "@/follow";
import { NotificationQueueService } from "@/notification/queue";
import { NUDGE_LIMIT_READER } from "@/nudge/application/ports/nudge-limit-reader.port";
import { NUDGE_NOTIFIER } from "@/nudge/application/ports/nudge-notifier.port";
import { NUDGE_REPOSITORY } from "@/nudge/application/ports/nudge.repository.port";
import { NudgeReader } from "@/nudge/application/services/nudge.reader";
import { MarkNudgeReadUseCase } from "@/nudge/application/use-cases/mark-nudge-read/mark-nudge-read.use-case";
import { SendNudgeUseCase } from "@/nudge/application/use-cases/send-nudge/send-nudge.use-case";
import { SendRemindNudgeUseCase } from "@/nudge/application/use-cases/send-remind-nudge/send-remind-nudge.use-case";
import { NudgeLimitReaderAdapter } from "@/nudge/infrastructure/adapters/nudge-limit-reader.adapter";
import { NudgeNotifierAdapter } from "@/nudge/infrastructure/adapters/nudge-notifier.adapter";
import { PrismaNudgeRepository } from "@/nudge/infrastructure/persistence/prisma-nudge.repository";
import { EntitlementService } from "@/shared/application/entitlement/entitlement.service";
import { PaginationService } from "@/shared/application/pagination/services/pagination.service";
import { MUTATION_LOCK, UNIT_OF_WORK } from "@/shared/application/ports";
import { subtractDays } from "@/shared/domain/date/utils/arithmetic";
import { todayInTimezone } from "@/shared/domain/date/utils/timezone";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";

describe("Nudge 모듈 통합 테스트 (Mock DB)", () => {
	let module: TestingModule;
	let reader: NudgeReader;
	let sendNudgeUseCase: SendNudgeUseCase;
	let sendRemindNudgeUseCase: SendRemindNudgeUseCase;
	let markNudgeReadUseCase: MarkNudgeReadUseCase;
	const nudgeApi = {
		sendNudge: (input: Parameters<SendNudgeUseCase["execute"]>[0], timezone: string) =>
			sendNudgeUseCase.execute(input, timezone),
		sendRemindNudge: (input: Parameters<SendRemindNudgeUseCase["execute"]>[0], timezone: string) =>
			sendRemindNudgeUseCase.execute(input, timezone),
		getReceivedNudges: (input: Parameters<NudgeReader["getReceivedNudges"]>[0]) =>
			reader.getReceivedNudges(input),
		getSentNudges: (input: Parameters<NudgeReader["getSentNudges"]>[0]) =>
			reader.getSentNudges(input),
		getLimitInfo: (userId: string, timezone: string) => reader.getLimitInfo(userId, timezone),
		getCooldownInfoForUser: (senderId: string, receiverId: string) =>
			reader.getCooldownInfoForUser(senderId, receiverId),
		getRemindCooldownInfo: (senderId: string, receiverId: string) =>
			reader.getRemindCooldownInfo(senderId, receiverId),
		markAsRead: (userId: string, nudgeId: number) =>
			markNudgeReadUseCase.execute({ userId, nudgeId }),
	};

	const mockNudgeDb = {
		create: jest.fn(),
		findUnique: jest.fn(),
		findFirst: jest.fn(),
		findMany: jest.fn(),
		update: jest.fn(),
		count: jest.fn(),
	};
	const mockReminderNudgeDb = {
		create: jest.fn(),
		findFirst: jest.fn(),
	};
	const mockTodoDb = {
		findUnique: jest.fn(),
		count: jest.fn(),
	};
	const mockDatabaseService = createMockDatabaseService({
		nudge: mockNudgeDb,
		reminderNudge: mockReminderNudgeDb,
		todo: mockTodoDb,
	});

	const mockFollowReader = { isMutualFriend: jest.fn() };
	const mockNotificationQueueService = { enqueueNudgeSent: jest.fn() };
	const mockEntitlementService = {
		getFeatureLimit: jest.fn(),
		getFeatureLimitInTx: jest.fn(),
		calculateRemaining: jest.fn(),
	};

	const senderId = "user-nudge-sender-123";
	const receiverId = "user-nudge-receiver-456";
	const todoId = 1;
	const nudgeId = 1;
	const today = todayInTimezone("UTC");

	const buildRelations = (id: number) =>
		NudgeBuilder.create(senderId, receiverId, todoId)
			.withId(id)
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
			.withTodoInfo({ id: todoId, title: "테스트 할일", completed: false })
			.buildWithRelations();

	beforeAll(async () => {
		suppressLogger();

		module = await Test.createTestingModule({
			providers: [
				NudgeReader,
				SendNudgeUseCase,
				SendRemindNudgeUseCase,
				MarkNudgeReadUseCase,
				{ provide: NUDGE_REPOSITORY, useClass: PrismaNudgeRepository },
				{ provide: NUDGE_NOTIFIER, useClass: NudgeNotifierAdapter },
				{ provide: NUDGE_LIMIT_READER, useClass: NudgeLimitReaderAdapter },
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
				{ provide: FollowReader, useValue: mockFollowReader },
				{
					provide: NotificationQueueService,
					useValue: mockNotificationQueueService,
				},
				{ provide: EntitlementService, useValue: mockEntitlementService },
			],
		}).compile();

		reader = module.get(NudgeReader);
		sendNudgeUseCase = module.get(SendNudgeUseCase);
		sendRemindNudgeUseCase = module.get(SendRemindNudgeUseCase);
		markNudgeReadUseCase = module.get(MarkNudgeReadUseCase);
	});

	afterAll(async () => {
		await module.close();
		jest.restoreAllMocks();
	});

	beforeEach(() => {
		jest.clearAllMocks();
		NudgeBuilder.resetIdCounter();
		TodoBuilder.resetIdCounter();
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

	const publicTodayTodo = () =>
		TodoBuilder.create(receiverId).withId(todoId).withStartDate(today).build();

	describe("DI 통합", () => {
		it("Nudge UseCase와 Reader가 조립된다", () => {
			expect(sendNudgeUseCase).toBeInstanceOf(SendNudgeUseCase);
			expect(reader).toBeInstanceOf(NudgeReader);
		});
		it("NudgeRepository 포트가 주입된다", () => {
			expect(module.get(NUDGE_REPOSITORY)).toBeInstanceOf(PrismaNudgeRepository);
		});
	});

	describe("콕 찌르기 전송", () => {
		it("친구에게 콕 찌르기를 전송하고 알림을 enqueue한다", async () => {
			mockFollowReader.isMutualFriend.mockResolvedValue(true);
			mockTodoDb.findUnique.mockResolvedValue(publicTodayTodo());
			mockNudgeDb.count.mockResolvedValue(0);
			mockNudgeDb.findFirst.mockResolvedValue(null);
			mockNudgeDb.create.mockResolvedValue(buildRelations(nudgeId));

			const result = await nudgeApi.sendNudge({ senderId, receiverId, todoId }, "UTC");

			expect(result.id).toBe(nudgeId);
			expect(mockFollowReader.isMutualFriend).toHaveBeenCalledWith(senderId, receiverId);
			expect(mockNotificationQueueService.enqueueNudgeSent).toHaveBeenCalledWith(
				expect.any(Object),
			);
		});

		it("친구가 아니면 ApplicationException", async () => {
			mockFollowReader.isMutualFriend.mockResolvedValue(false);
			await expect(nudgeApi.sendNudge({ senderId, receiverId, todoId }, "UTC")).rejects.toThrow(
				ApplicationException,
			);
		});

		it("자기 자신에게 전송하면 ApplicationException", async () => {
			await expect(
				nudgeApi.sendNudge({ senderId, receiverId: senderId, todoId }, "UTC"),
			).rejects.toThrow(ApplicationException);
		});

		it("일일 제한 초과면 ApplicationException", async () => {
			mockFollowReader.isMutualFriend.mockResolvedValue(true);
			mockTodoDb.findUnique.mockResolvedValue(publicTodayTodo());
			mockNudgeDb.count.mockResolvedValue(3);
			await expect(nudgeApi.sendNudge({ senderId, receiverId, todoId }, "UTC")).rejects.toThrow(
				ApplicationException,
			);
		});

		it("쿨다운 중이면 ApplicationException", async () => {
			mockFollowReader.isMutualFriend.mockResolvedValue(true);
			mockTodoDb.findUnique.mockResolvedValue(publicTodayTodo());
			mockNudgeDb.count.mockResolvedValue(0);
			mockNudgeDb.findFirst.mockResolvedValue(
				NudgeBuilder.create(senderId, receiverId, todoId).withCreatedAt(new Date()).build(),
			);
			await expect(nudgeApi.sendNudge({ senderId, receiverId, todoId }, "UTC")).rejects.toThrow(
				ApplicationException,
			);
		});

		it("오늘의 할 일이 아니면 ApplicationException", async () => {
			mockFollowReader.isMutualFriend.mockResolvedValue(true);
			mockTodoDb.findUnique.mockResolvedValue(
				TodoBuilder.create(receiverId).withId(todoId).withStartDate(subtractDays(1, today)).build(),
			);
			await expect(nudgeApi.sendNudge({ senderId, receiverId, todoId }, "UTC")).rejects.toThrow(
				ApplicationException,
			);
		});

		it("비공개 Todo면 ApplicationException", async () => {
			mockFollowReader.isMutualFriend.mockResolvedValue(true);
			mockTodoDb.findUnique.mockResolvedValue(
				TodoBuilder.create(receiverId).withId(todoId).withStartDate(today).asPrivate().build(),
			);
			await expect(nudgeApi.sendNudge({ senderId, receiverId, todoId }, "UTC")).rejects.toThrow(
				ApplicationException,
			);
		});

		it("다른 사용자의 Todo면 ApplicationException", async () => {
			mockFollowReader.isMutualFriend.mockResolvedValue(true);
			mockTodoDb.findUnique.mockResolvedValue(
				TodoBuilder.create("other-user").withId(todoId).withStartDate(today).build(),
			);
			await expect(nudgeApi.sendNudge({ senderId, receiverId, todoId }, "UTC")).rejects.toThrow(
				ApplicationException,
			);
		});
	});

	describe("리마인드 콕 찌르기 전송", () => {
		it("친구가 오늘 할 일이 없으면 전송하고 알림을 enqueue한다", async () => {
			mockFollowReader.isMutualFriend.mockResolvedValue(true);
			mockTodoDb.count.mockResolvedValue(0);
			mockReminderNudgeDb.findFirst.mockResolvedValue(null);
			mockReminderNudgeDb.create.mockResolvedValue({
				id: 10,
				senderId,
				receiverId,
				message: null,
				createdAt: new Date(),
				sender: {
					id: senderId,
					userTag: "SENDER12",
					profile: { name: "Sender User", profileImage: null },
				},
			});

			const result = await nudgeApi.sendRemindNudge({ senderId, receiverId }, "UTC");

			expect(result.id).toBe(10);
			expect(mockNotificationQueueService.enqueueNudgeSent).toHaveBeenCalledWith(
				expect.objectContaining({ nudgeId: 10, senderId, receiverId }),
			);
		});

		it("친구가 오늘 할 일이 있으면 ApplicationException", async () => {
			mockFollowReader.isMutualFriend.mockResolvedValue(true);
			mockTodoDb.count.mockResolvedValue(2);
			await expect(nudgeApi.sendRemindNudge({ senderId, receiverId }, "UTC")).rejects.toThrow(
				ApplicationException,
			);
		});

		it("쿨다운 중이면 ApplicationException", async () => {
			mockFollowReader.isMutualFriend.mockResolvedValue(true);
			mockTodoDb.count.mockResolvedValue(0);
			mockReminderNudgeDb.findFirst.mockResolvedValue({
				id: 11,
				senderId,
				receiverId,
				message: null,
				createdAt: new Date(),
			});
			await expect(nudgeApi.sendRemindNudge({ senderId, receiverId }, "UTC")).rejects.toThrow(
				ApplicationException,
			);
		});
	});

	describe("목록 조회", () => {
		it("받은 콕 찌르기 목록에 sender.userTag가 포함된다", async () => {
			mockNudgeDb.findMany.mockResolvedValue([buildRelations(1)]);
			mockNudgeDb.count.mockResolvedValue(1);

			const result = await nudgeApi.getReceivedNudges({ userId: receiverId });
			expect(result.items[0]?.sender.userTag).toBe("SENDER12");
		});

		it("보낸 콕 찌르기 목록을 조회한다", async () => {
			mockNudgeDb.findMany.mockResolvedValue([buildRelations(1), buildRelations(2)]);
			const result = await nudgeApi.getSentNudges({ userId: senderId });
			expect(result.items).toHaveLength(2);
			expect(result.pagination).toBeDefined();
		});
	});

	describe("일일 제한 정보", () => {
		it("FREE 사용자의 제한 정보", async () => {
			mockNudgeDb.count.mockResolvedValue(2);
			const result = await nudgeApi.getLimitInfo(senderId, "UTC");
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
			mockNudgeDb.count.mockResolvedValue(10);
			const result = await nudgeApi.getLimitInfo(senderId, "UTC");
			expect(result.dailyLimit).toBeNull();
			expect(result.remaining).toBeNull();
		});
	});

	describe("쿨다운 정보", () => {
		it("기록이 없으면 비활성", async () => {
			mockNudgeDb.findFirst.mockResolvedValue(null);
			const result = await nudgeApi.getCooldownInfoForUser(senderId, receiverId);
			expect(result.isActive).toBe(false);
		});

		it("최근 콕 찌르기가 있으면 활성 + 남은 시간", async () => {
			mockNudgeDb.findFirst.mockResolvedValue(
				NudgeBuilder.create(senderId, receiverId, todoId).withCreatedAt(new Date()).build(),
			);
			const result = await nudgeApi.getCooldownInfoForUser(senderId, receiverId);
			expect(result.isActive).toBe(true);
			expect(result.remainingSeconds).toBeGreaterThan(0);
		});

		it("리마인드 쿨다운 정보를 조회한다", async () => {
			mockReminderNudgeDb.findFirst.mockResolvedValue(null);
			const result = await nudgeApi.getRemindCooldownInfo(senderId, receiverId);
			expect(result.isActive).toBe(false);
		});
	});

	describe("읽음 처리", () => {
		it("콕 찌르기를 읽음 처리한다", async () => {
			mockNudgeDb.findUnique.mockResolvedValue(
				NudgeBuilder.create(senderId, receiverId, todoId).withId(nudgeId).asUnread().build(),
			);
			mockNudgeDb.update.mockResolvedValue({});

			await nudgeApi.markAsRead(receiverId, nudgeId);
			expect(mockNudgeDb.update).toHaveBeenCalledWith(
				expect.objectContaining({ where: { id: nudgeId } }),
			);
		});

		it("존재하지 않으면 ApplicationException", async () => {
			mockNudgeDb.findUnique.mockResolvedValue(null);
			await expect(nudgeApi.markAsRead(receiverId, 999)).rejects.toThrow(ApplicationException);
		});

		it("다른 사용자의 콕 찌르기면 ApplicationException", async () => {
			mockNudgeDb.findUnique.mockResolvedValue(
				NudgeBuilder.create(senderId, "other-user", todoId).withId(nudgeId).build(),
			);
			await expect(nudgeApi.markAsRead(receiverId, nudgeId)).rejects.toThrow(ApplicationException);
		});
	});
});
