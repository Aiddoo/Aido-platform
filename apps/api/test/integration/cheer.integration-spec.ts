import { TransactionHost } from "@nestjs-cls/transactional";
/**
 * Cheer 모듈 통합 테스트 (Mock DB)
 *
 * endpoint use-case와 CheerReader가
 * PrismaCheerRepository(Mock DB)·알림/한도 어댑터·FollowReader와 함께 DI로 조립되고
 * 동작하는지 검증한다. HTTP 계약은 e2e가 담당하며 여기서는 ApplicationException 발생만 확인한다.
 *
 * 실행: pnpm --filter @aido/api test cheer.integration-spec
 */
import { Test, type TestingModule } from "@nestjs/testing";
import { and } from "@prisma/orm-postgres/orm-client";
import { vi } from "vitest";

import { CHEER_LIMIT_READER } from "#api/cheer/application/ports/cheer-limit-reader.port";
import { CHEER_NOTIFIER } from "#api/cheer/application/ports/cheer-notifier.port";
import { CHEER_REPOSITORY } from "#api/cheer/application/ports/cheer.repository.port";
import { CheerReader } from "#api/cheer/application/services/cheer.reader";
import { MarkCheerReadUseCase } from "#api/cheer/application/use-cases/mark-cheer-read/mark-cheer-read.use-case";
import { MarkManyCheersReadUseCase } from "#api/cheer/application/use-cases/mark-many-cheers-read/mark-many-cheers-read.use-case";
import { SendCheerUseCase } from "#api/cheer/application/use-cases/send-cheer/send-cheer.use-case";
import { CheerLimitReaderAdapter } from "#api/cheer/infrastructure/adapters/cheer-limit-reader.adapter";
import { CheerNotifierAdapter } from "#api/cheer/infrastructure/adapters/cheer-notifier.adapter";
import { PrismaCheerRepository } from "#api/cheer/infrastructure/persistence/prisma-cheer.repository";
import { FollowReader } from "#api/follow/index";
import { NotificationQueueService } from "#api/notification/queue";
import { EntitlementService } from "#api/shared/application/entitlement/entitlement.service";
import { PaginationService } from "#api/shared/application/pagination/services/pagination.service";
import { MUTATION_LOCK, UNIT_OF_WORK } from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";
import { TypedConfigService } from "#api/shared/infrastructure/config/services/config.service";
import { CheerBuilder } from "#test/builders/index";
import { asMock } from "#test/mocks/bull-job.mock";
import {
  assertNativeWhere,
  createMockDatabaseContext,
  databaseFixture,
  databaseWriteExpectation,
  nativeRows,
} from "#test/mocks/database.mock";
import { createUnitOfWorkMock } from "#test/mocks/ports/index";
import { suppressLogger } from "#test/setup/suppress-logger";

describe("Cheer 모듈 통합 테스트 (Mock DB)", () => {
  let module: TestingModule;
  let reader: CheerReader;
  let sendCheerUseCase: SendCheerUseCase;
  let markCheerReadUseCase: MarkCheerReadUseCase;
  let markManyCheersReadUseCase: MarkManyCheersReadUseCase;
  const cheerApi = {
    sendCheer: (input: Parameters<SendCheerUseCase["execute"]>[0], timezone: string) =>
      sendCheerUseCase.execute(input, timezone),
    getReceivedCheers: (input: Parameters<CheerReader["getReceivedCheers"]>[0]) =>
      reader.getReceivedCheers(input),
    getSentCheers: (input: Parameters<CheerReader["getSentCheers"]>[0]) =>
      reader.getSentCheers(input),
    getLimitInfo: (userId: string, timezone: string) => reader.getLimitInfo(userId, timezone),
    getCooldownInfoForUser: (senderId: string, receiverId: string) =>
      reader.getCooldownInfoForUser(senderId, receiverId),
    markAsRead: (userId: string, cheerId: number) =>
      markCheerReadUseCase.execute({ userId, cheerId }),
    markManyAsRead: (userId: string, cheerIds: number[]) =>
      markManyCheersReadUseCase.execute({ userId, cheerIds }),
  };

  const nativeContext = createMockDatabaseContext();
  const mockCheerDb = nativeContext.orm.public.Cheer;

  const mockFollowReader = { isMutualFriend: vi.fn() };
  const mockNotificationQueueService = { enqueueCheerSent: vi.fn() };
  const mockEntitlementService = {
    getFeatureLimit: vi.fn(),
    getFeatureLimitInTx: vi.fn(),
    calculateRemaining: vi.fn(),
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

    reader = module.get(CheerReader);
    sendCheerUseCase = module.get(SendCheerUseCase);
    markCheerReadUseCase = module.get(MarkCheerReadUseCase);
    markManyCheersReadUseCase = module.get(MarkManyCheersReadUseCase);
  });

  afterAll(async () => {
    await module.close();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
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
    it("Cheer UseCase와 Reader가 조립된다", () => {
      expect(sendCheerUseCase).toBeInstanceOf(SendCheerUseCase);
      expect(reader).toBeInstanceOf(CheerReader);
    });
    it("CheerRepository 포트가 주입된다", () => {
      expect(module.get(CHEER_REPOSITORY)).toBeInstanceOf(PrismaCheerRepository);
    });
  });

  describe("응원 전송", () => {
    it("친구에게 응원을 전송하고 알림을 enqueue한다", async () => {
      mockFollowReader.isMutualFriend.mockResolvedValue(true);
      asMock(mockCheerDb.aggregate).mockResolvedValue({ count: 0 });
      asMock(mockCheerDb.first).mockResolvedValue(databaseFixture("Cheer", null));
      asMock(mockCheerDb.create).mockResolvedValue(
        databaseFixture(
          "Cheer",
          withSenderReceiver(
            CheerBuilder.create(senderId, receiverId).withId(cheerId).withMessage("축하해요!"),
          ),
        ),
      );

      const result = await cheerApi.sendCheer(
        { senderId, receiverId, message: "축하해요!" },
        "UTC",
      );

      expect(result.id).toBe(cheerId);
      expect(mockFollowReader.isMutualFriend).toHaveBeenCalledWith(senderId, receiverId);
      expect(mockNotificationQueueService.enqueueCheerSent).toHaveBeenCalledWith(
        expect.any(Object),
      );
    });

    it("메시지 없이도 전송된다", async () => {
      mockFollowReader.isMutualFriend.mockResolvedValue(true);
      asMock(mockCheerDb.aggregate).mockResolvedValue({ count: 0 });
      asMock(mockCheerDb.first).mockResolvedValue(databaseFixture("Cheer", null));
      asMock(mockCheerDb.create).mockResolvedValue(
        databaseFixture(
          "Cheer",
          withSenderReceiver(CheerBuilder.create(senderId, receiverId).withId(cheerId)),
        ),
      );

      const result = await cheerApi.sendCheer({ senderId, receiverId }, "UTC");
      expect(result.id).toBe(cheerId);
    });

    it("친구가 아니면 ApplicationException", async () => {
      mockFollowReader.isMutualFriend.mockResolvedValue(false);
      await expect(cheerApi.sendCheer({ senderId, receiverId }, "UTC")).rejects.toThrow(
        ApplicationException,
      );
    });

    it("자기 자신에게 전송하면 ApplicationException", async () => {
      await expect(cheerApi.sendCheer({ senderId, receiverId: senderId }, "UTC")).rejects.toThrow(
        ApplicationException,
      );
    });

    it("일일 제한 초과면 ApplicationException", async () => {
      mockFollowReader.isMutualFriend.mockResolvedValue(true);
      asMock(mockCheerDb.aggregate).mockResolvedValue({ count: 3 });
      await expect(cheerApi.sendCheer({ senderId, receiverId }, "UTC")).rejects.toThrow(
        ApplicationException,
      );
    });

    it("쿨다운 중이면 ApplicationException", async () => {
      mockFollowReader.isMutualFriend.mockResolvedValue(true);
      asMock(mockCheerDb.aggregate).mockResolvedValue({ count: 0 });
      asMock(mockCheerDb.first).mockResolvedValue(
        databaseFixture(
          "Cheer",
          CheerBuilder.create(senderId, receiverId).withCreatedAt(new Date()).build(),
        ),
      );
      await expect(cheerApi.sendCheer({ senderId, receiverId }, "UTC")).rejects.toThrow(
        ApplicationException,
      );
    });
  });

  describe("목록 조회", () => {
    it("받은 응원 목록에 sender.userTag가 포함된다", async () => {
      mockCheerDb.all.mockReturnValue(
        nativeRows(
          databaseFixture("Cheer", [
            withSenderReceiver(CheerBuilder.create(senderId, receiverId).withId(1)),
          ]),
        ),
      );
      asMock(mockCheerDb.aggregate).mockResolvedValue({ count: 1 });

      const result = await cheerApi.getReceivedCheers({ userId: receiverId });
      expect(result.items[0]?.sender.userTag).toBe("SENDER12");
    });

    it("보낸 응원 목록을 조회한다", async () => {
      mockCheerDb.all.mockReturnValue(
        nativeRows(
          databaseFixture("Cheer", [
            withSenderReceiver(CheerBuilder.create(senderId, receiverId).withId(1)),
            withSenderReceiver(CheerBuilder.create(senderId, receiverId).withId(2)),
          ]),
        ),
      );
      const result = await cheerApi.getSentCheers({ userId: senderId });
      expect(result.items).toHaveLength(2);
      expect(result.pagination).toBeDefined();
    });
  });

  describe("일일 제한 정보", () => {
    it("FREE 사용자의 제한 정보", async () => {
      asMock(mockCheerDb.aggregate).mockResolvedValue({ count: 2 });
      const result = await cheerApi.getLimitInfo(senderId, "UTC");
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
      asMock(mockCheerDb.aggregate).mockResolvedValue({ count: 10 });
      const result = await cheerApi.getLimitInfo(senderId, "UTC");
      expect(result.dailyLimit).toBeNull();
      expect(result.remaining).toBeNull();
    });
  });

  describe("쿨다운 정보", () => {
    it("기록이 없으면 비활성", async () => {
      asMock(mockCheerDb.first).mockResolvedValue(databaseFixture("Cheer", null));
      const result = await cheerApi.getCooldownInfoForUser(senderId, receiverId);
      expect(result.isActive).toBe(false);
    });

    it("최근 응원이 있으면 활성 + 남은 시간", async () => {
      asMock(mockCheerDb.first).mockResolvedValue(
        databaseFixture(
          "Cheer",
          CheerBuilder.create(senderId, receiverId).withCreatedAt(new Date()).build(),
        ),
      );
      const result = await cheerApi.getCooldownInfoForUser(senderId, receiverId);
      expect(result.isActive).toBe(true);
      expect(result.remainingSeconds).toBeGreaterThan(0);
    });
  });

  describe("읽음 처리", () => {
    it("응원을 읽음 처리한다", async () => {
      asMock(mockCheerDb.first).mockResolvedValue(
        databaseFixture(
          "Cheer",
          CheerBuilder.create(senderId, receiverId).withId(cheerId).asUnread().build(),
        ),
      );
      asMock(mockCheerDb.update).mockResolvedValue(databaseFixture("Cheer", {}));

      await cheerApi.markAsRead(receiverId, cheerId);
      assertNativeWhere("Cheer", mockCheerDb.where.mock.calls.at(-1)?.[0], (row) =>
        row.id.eq(cheerId),
      );
    });

    it("존재하지 않으면 ApplicationException", async () => {
      asMock(mockCheerDb.first).mockResolvedValue(databaseFixture("Cheer", null));
      await expect(cheerApi.markAsRead(receiverId, 999)).rejects.toThrow(ApplicationException);
    });

    it("다른 사용자의 응원이면 ApplicationException", async () => {
      asMock(mockCheerDb.first).mockResolvedValue(
        databaseFixture(
          "Cheer",
          CheerBuilder.create(senderId, "other-user").withId(cheerId).build(),
        ),
      );
      await expect(cheerApi.markAsRead(receiverId, cheerId)).rejects.toThrow(ApplicationException);
    });

    it("여러 응원을 읽음 처리한다", async () => {
      asMock(mockCheerDb.updateAndCount).mockResolvedValue(5);
      const result = await cheerApi.markManyAsRead(receiverId, [1, 2, 3, 4, 5]);
      expect(result).toBe(5);
      assertNativeWhere("Cheer", mockCheerDb.where.mock.calls.at(-1)?.[0], (row) =>
        and(row.id.in([1, 2, 3, 4, 5]), row.receiverId.eq(receiverId), row.readAt.isNull()),
      );
      expect(mockCheerDb.updateAndCount).toHaveBeenCalledWith(
        expect.objectContaining(databaseWriteExpectation("Cheer", { readAt: expect.any(String) })),
      );
    });
  });
});
