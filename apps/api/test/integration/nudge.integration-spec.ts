import { TransactionHost } from "@nestjs-cls/transactional";
/**
 * Nudge 모듈 통합 테스트 (Mock DB)
 *
 * endpoint use-case와 NudgeReader가
 * PrismaNudgeRepository(Mock DB)·알림/한도 어댑터·FollowReader와 함께 DI로 조립되고
 * 동작하는지 검증한다. HTTP 계약은 e2e가 담당하며 여기서는 ApplicationException 발생만 확인한다.
 *
 * 실행: pnpm --filter @aido/api test nudge.integration-spec
 */
import { Test, type TestingModule } from "@nestjs/testing";
import { and } from "@prisma/orm-postgres/orm-client";
import { vi } from "vitest";

import { FollowReader } from "#api/follow/index";
import { NotificationPublisher, NotificationRecipientLocaleReader } from "#api/notification/index";
import { NotificationQueueService } from "#api/notification/queue";
import { NUDGE_LIMIT_READER } from "#api/nudge/application/ports/nudge-limit-reader.port";
import { NUDGE_NOTIFIER } from "#api/nudge/application/ports/nudge-notifier.port";
import { NUDGE_REPOSITORY } from "#api/nudge/application/ports/nudge.repository.port";
import { NudgeReader } from "#api/nudge/application/services/nudge.reader";
import { MarkNudgeReadUseCase } from "#api/nudge/application/use-cases/mark-nudge-read/mark-nudge-read.use-case";
import { SendNudgeUseCase } from "#api/nudge/application/use-cases/send-nudge/send-nudge.use-case";
import { SendRemindNudgeUseCase } from "#api/nudge/application/use-cases/send-remind-nudge/send-remind-nudge.use-case";
import { NudgeLimitReaderAdapter } from "#api/nudge/infrastructure/adapters/nudge-limit-reader.adapter";
import { NudgeNotifierAdapter } from "#api/nudge/infrastructure/adapters/nudge-notifier.adapter";
import { PrismaNudgeRepository } from "#api/nudge/infrastructure/persistence/prisma-nudge.repository";
import { EntitlementService } from "#api/shared/application/entitlement/entitlement.service";
import { PaginationService } from "#api/shared/application/pagination/services/pagination.service";
import { MUTATION_LOCK, UNIT_OF_WORK } from "#api/shared/application/ports/index";
import { subtractDays } from "#api/shared/domain/date/utils/arithmetic";
import { todayInTimezone } from "#api/shared/domain/date/utils/timezone";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";
import { TypedConfigService } from "#api/shared/infrastructure/config/services/config.service";
import { NudgeBuilder, TodoBuilder } from "#test/builders/index";
import {
  assertNativeWhere,
  createMockDatabaseContext,
  databaseFixture,
  nativeRows,
} from "#test/mocks/database.mock";
import { createUnitOfWorkMock } from "#test/mocks/ports/index";
import { suppressLogger } from "#test/setup/suppress-logger";

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

  const nativeContext = createMockDatabaseContext();
  const mockNudgeDb = nativeContext.orm.public.Nudge;
  const mockReminderNudgeDb = nativeContext.orm.public.ReminderNudge;
  const mockTodoDb = nativeContext.orm.public.Todo;

  const mockFollowReader = { isMutualFriend: vi.fn() };
  const mockNotificationQueueService = { enqueueNudgeSent: vi.fn() };
  const mockEntitlementService = {
    getFeatureLimit: vi.fn(),
    getFeatureLimitInTx: vi.fn(),
    calculateRemaining: vi.fn(),
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
        { provide: NotificationPublisher, useValue: { publish: vi.fn() } },
        { provide: NotificationRecipientLocaleReader, useValue: { getRecipientLocale: vi.fn() } },
        PaginationService,
        { provide: UNIT_OF_WORK, useValue: createUnitOfWorkMock() },
        {
          provide: MUTATION_LOCK,
          useValue: { acquire: vi.fn().mockResolvedValue(undefined) },
        },
        { provide: TransactionHost, useValue: { tx: nativeContext } },
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
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
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
      mockTodoDb.first.mockResolvedValue(databaseFixture("Todo", publicTodayTodo()));
      mockNudgeDb.aggregate.mockResolvedValue({ count: 0 });
      mockNudgeDb.first.mockResolvedValue(databaseFixture("Nudge", null));
      mockNudgeDb.create.mockResolvedValue(databaseFixture("Nudge", buildRelations(nudgeId)));

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
      mockTodoDb.first.mockResolvedValue(databaseFixture("Todo", publicTodayTodo()));
      mockNudgeDb.aggregate.mockResolvedValue({ count: 3 });
      await expect(nudgeApi.sendNudge({ senderId, receiverId, todoId }, "UTC")).rejects.toThrow(
        ApplicationException,
      );
    });

    it("쿨다운 중이면 ApplicationException", async () => {
      mockFollowReader.isMutualFriend.mockResolvedValue(true);
      mockTodoDb.first.mockResolvedValue(databaseFixture("Todo", publicTodayTodo()));
      mockNudgeDb.aggregate.mockResolvedValue({ count: 0 });
      mockNudgeDb.first.mockResolvedValue(
        databaseFixture(
          "Nudge",
          NudgeBuilder.create(senderId, receiverId, todoId).withCreatedAt(new Date()).build(),
        ),
      );
      await expect(nudgeApi.sendNudge({ senderId, receiverId, todoId }, "UTC")).rejects.toThrow(
        ApplicationException,
      );
    });

    it("오늘의 할 일이 아니면 ApplicationException", async () => {
      mockFollowReader.isMutualFriend.mockResolvedValue(true);
      mockTodoDb.first.mockResolvedValue(
        databaseFixture(
          "Todo",
          TodoBuilder.create(receiverId)
            .withId(todoId)
            .withStartDate(subtractDays(1, today))
            .build(),
        ),
      );
      await expect(nudgeApi.sendNudge({ senderId, receiverId, todoId }, "UTC")).rejects.toThrow(
        ApplicationException,
      );
    });

    it("비공개 Todo면 ApplicationException", async () => {
      mockFollowReader.isMutualFriend.mockResolvedValue(true);
      mockTodoDb.first.mockResolvedValue(
        databaseFixture(
          "Todo",
          TodoBuilder.create(receiverId).withId(todoId).withStartDate(today).asPrivate().build(),
        ),
      );
      await expect(nudgeApi.sendNudge({ senderId, receiverId, todoId }, "UTC")).rejects.toThrow(
        ApplicationException,
      );
    });

    it("다른 사용자의 Todo면 ApplicationException", async () => {
      mockFollowReader.isMutualFriend.mockResolvedValue(true);
      mockTodoDb.first.mockResolvedValue(
        databaseFixture(
          "Todo",
          TodoBuilder.create("other-user").withId(todoId).withStartDate(today).build(),
        ),
      );
      await expect(nudgeApi.sendNudge({ senderId, receiverId, todoId }, "UTC")).rejects.toThrow(
        ApplicationException,
      );
    });
  });

  describe("리마인드 콕 찌르기 전송", () => {
    it("친구가 오늘 할 일이 없으면 전송하고 알림을 enqueue한다", async () => {
      mockFollowReader.isMutualFriend.mockResolvedValue(true);
      mockTodoDb.aggregate.mockResolvedValue({ count: 0 });
      mockReminderNudgeDb.first.mockResolvedValue(databaseFixture("ReminderNudge", null));
      mockReminderNudgeDb.create.mockResolvedValue(
        databaseFixture("ReminderNudge", {
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
        }),
      );

      const result = await nudgeApi.sendRemindNudge({ senderId, receiverId }, "UTC");

      expect(result.id).toBe(10);
      expect(mockNotificationQueueService.enqueueNudgeSent).toHaveBeenCalledWith(
        expect.objectContaining({ nudgeId: 10, senderId, receiverId }),
      );
    });

    it("친구가 오늘 할 일이 있으면 ApplicationException", async () => {
      mockFollowReader.isMutualFriend.mockResolvedValue(true);
      mockTodoDb.aggregate.mockResolvedValue({ count: 2 });
      await expect(nudgeApi.sendRemindNudge({ senderId, receiverId }, "UTC")).rejects.toThrow(
        ApplicationException,
      );
    });

    it("쿨다운 중이면 ApplicationException", async () => {
      mockFollowReader.isMutualFriend.mockResolvedValue(true);
      mockTodoDb.aggregate.mockResolvedValue({ count: 0 });
      mockReminderNudgeDb.first.mockResolvedValue(
        databaseFixture("ReminderNudge", {
          id: 11,
          senderId,
          receiverId,
          message: null,
          createdAt: new Date(),
        }),
      );
      await expect(nudgeApi.sendRemindNudge({ senderId, receiverId }, "UTC")).rejects.toThrow(
        ApplicationException,
      );
    });
  });

  describe("목록 조회", () => {
    it("받은 콕 찌르기 목록에 sender.userTag가 포함된다", async () => {
      mockNudgeDb.all.mockReturnValue(nativeRows(databaseFixture("Nudge", [buildRelations(1)])));
      mockNudgeDb.aggregate.mockResolvedValue({ count: 1 });

      const result = await nudgeApi.getReceivedNudges({ userId: receiverId });
      expect(result.items[0]?.sender.userTag).toBe("SENDER12");
    });

    it("보낸 콕 찌르기 목록을 조회한다", async () => {
      mockNudgeDb.all.mockReturnValue(
        nativeRows(databaseFixture("Nudge", [buildRelations(1), buildRelations(2)])),
      );
      const result = await nudgeApi.getSentNudges({ userId: senderId });
      expect(result.items).toHaveLength(2);
      expect(result.pagination).toBeDefined();
    });
  });

  describe("일일 제한 정보", () => {
    it("FREE 사용자의 제한 정보", async () => {
      mockNudgeDb.aggregate.mockResolvedValue({ count: 2 });
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
      mockNudgeDb.aggregate.mockResolvedValue({ count: 10 });
      const result = await nudgeApi.getLimitInfo(senderId, "UTC");
      expect(result.dailyLimit).toBeNull();
      expect(result.remaining).toBeNull();
    });
  });

  describe("쿨다운 정보", () => {
    it("기록이 없으면 비활성", async () => {
      mockNudgeDb.first.mockResolvedValue(databaseFixture("Nudge", null));
      const result = await nudgeApi.getCooldownInfoForUser(senderId, receiverId);
      expect(result.isActive).toBe(false);
    });

    it("최근 콕 찌르기가 있으면 활성 + 남은 시간", async () => {
      mockNudgeDb.first.mockResolvedValue(
        databaseFixture(
          "Nudge",
          NudgeBuilder.create(senderId, receiverId, todoId).withCreatedAt(new Date()).build(),
        ),
      );
      const result = await nudgeApi.getCooldownInfoForUser(senderId, receiverId);
      expect(result.isActive).toBe(true);
      expect(result.remainingSeconds).toBeGreaterThan(0);
    });

    it("리마인드 쿨다운 정보를 조회한다", async () => {
      mockReminderNudgeDb.first.mockResolvedValue(databaseFixture("ReminderNudge", null));
      const result = await nudgeApi.getRemindCooldownInfo(senderId, receiverId);
      expect(result.isActive).toBe(false);
    });
  });

  describe("읽음 처리", () => {
    it("콕 찌르기를 읽음 처리한다", async () => {
      mockNudgeDb.first.mockResolvedValue(
        databaseFixture(
          "Nudge",
          NudgeBuilder.create(senderId, receiverId, todoId).withId(nudgeId).asUnread().build(),
        ),
      );
      mockNudgeDb.updateAndCount.mockResolvedValue(1);

      await nudgeApi.markAsRead(receiverId, nudgeId);
      assertNativeWhere("Nudge", mockNudgeDb.where.mock.calls.at(-1)?.[0], (row) =>
        and(row.id.eq(nudgeId), row.readAt.isNull()),
      );
    });

    it("존재하지 않으면 ApplicationException", async () => {
      mockNudgeDb.first.mockResolvedValue(databaseFixture("Nudge", null));
      await expect(nudgeApi.markAsRead(receiverId, 999)).rejects.toThrow(ApplicationException);
    });

    it("다른 사용자의 콕 찌르기면 ApplicationException", async () => {
      mockNudgeDb.first.mockResolvedValue(
        databaseFixture(
          "Nudge",
          NudgeBuilder.create(senderId, "other-user", todoId).withId(nudgeId).build(),
        ),
      );
      await expect(nudgeApi.markAsRead(receiverId, nudgeId)).rejects.toThrow(ApplicationException);
    });
  });
});
