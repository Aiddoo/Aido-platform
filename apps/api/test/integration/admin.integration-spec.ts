import { TransactionHost } from "@nestjs-cls/transactional";
import { Test, type TestingModule } from "@nestjs/testing";
import { vi } from "vitest";

import { NotificationPublisher } from "#api/modules/notification/notification-delivery.public";
import { ADMIN_BROADCAST_NOTIFIER } from "#api/modules/operations/application/ports/admin/admin-broadcast-notifier.port";
import { ADMIN_GROWTH_METRICS } from "#api/modules/operations/application/ports/admin/admin-growth-metrics.port";
import { ADMIN_USER_DIRECTORY } from "#api/modules/operations/application/ports/admin/admin-user-directory.port";
import { BroadcastNotification } from "#api/modules/operations/application/use-cases/admin/broadcast-notification.use-case";
import { SendTargetedNotification } from "#api/modules/operations/application/use-cases/admin/send-targeted-notification.use-case";
import { DrizzleAdminUserDirectoryAdapter } from "#api/modules/operations/infrastructure/adapters/admin/drizzle-admin-user-directory.adapter";
import { NotificationAdminBroadcastNotifierAdapter } from "#api/modules/operations/infrastructure/adapters/admin/notification-admin-broadcast-notifier.adapter";
import {
  broadcastNotificationProvider,
  getGrowthSummaryProvider,
  sendTargetedNotificationProvider,
} from "#api/modules/operations/operations-admin-application.providers";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";
import {
  createFakeTransactionHost,
  type ExecutedStatement,
  queryResult,
} from "#test/mocks/drizzle.mock";
import { suppressLogger } from "#test/setup/suppress-logger";

describe("Admin 수직 통합 테스트 (Mock DB/Notification)", () => {
  let module: TestingModule;
  let broadcastNotificationUseCase: BroadcastNotification;
  let sendTargetedNotificationUseCase: SendTargetedNotification;

  let userRows: object[] = [];
  const respond = vi.fn(async (_statement: ExecutedStatement) => queryResult(userRows));
  const { host: txHost, statements } = createFakeTransactionHost(respond);

  const mockNotificationPublisher = {
    publishBatch: vi.fn().mockResolvedValue({ count: 0 }),
  };

  beforeAll(async () => {
    suppressLogger();

    module = await Test.createTestingModule({
      providers: [
        broadcastNotificationProvider,
        getGrowthSummaryProvider,
        sendTargetedNotificationProvider,
        {
          provide: ADMIN_GROWTH_METRICS,
          useValue: { getSummary: vi.fn() },
        },
        {
          provide: ADMIN_USER_DIRECTORY,
          useClass: DrizzleAdminUserDirectoryAdapter,
        },
        {
          provide: ADMIN_BROADCAST_NOTIFIER,
          useClass: NotificationAdminBroadcastNotifierAdapter,
        },
        { provide: TransactionHost, useValue: txHost },
        { provide: NotificationPublisher, useValue: mockNotificationPublisher },
      ],
    }).compile();

    await module.init();
    broadcastNotificationUseCase = module.get(BroadcastNotification);
    sendTargetedNotificationUseCase = module.get(SendTargetedNotification);
  });

  afterAll(async () => {
    await module.close();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    statements.length = 0;
    mockNotificationPublisher.publishBatch.mockResolvedValue({ count: 0 });
  });

  describe("브로드캐스트", () => {
    it("ALL — 모든 사용자에게 알림이 발송된다", async () => {
      // Given
      userRows = [["user-1"], ["user-2"], ["user-3"]];
      mockNotificationPublisher.publishBatch.mockResolvedValue({
        count: 3,
      });

      // When
      const result = await broadcastNotificationUseCase.execute({
        title: "테스트 알림",
        body: "전체 사용자 알림입니다",
        targetFilter: "ALL",
        action: undefined,
        force: false,
      });

      // Then
      expect(result.totalTargets).toBe(3);
      expect(result.successCount).toBe(3);
      expect(mockNotificationPublisher.publishBatch).toHaveBeenCalled();
    });

    it("WITH_PUSH_TOKEN — 푸시 토큰 조건이 where 절에 반영된다", async () => {
      // Given
      userRows = [["user-push-1"], ["user-push-2"]];
      mockNotificationPublisher.publishBatch.mockResolvedValue({
        count: 2,
      });

      // When
      const result = await broadcastNotificationUseCase.execute({
        title: "푸시 알림",
        body: "푸시 토큰 사용자 알림입니다",
        targetFilter: "WITH_PUSH_TOKEN",
        action: undefined,
        force: false,
      });

      // Then
      expect(result.totalTargets).toBe(2);
      expect(result.successCount).toBe(2);
      expect(statements[0]?.text).toContain('"PushToken"');
    });

    it("대상 없음 — BusinessException을 던진다", async () => {
      // Given
      userRows = [];

      // When
      await expect(
        broadcastNotificationUseCase.execute({
          title: "테스트 알림",
          body: "대상 없음",
          targetFilter: "ALL",
          action: undefined,
          force: false,
        }),
      ).rejects.toThrow(ApplicationException);
    });
  });

  describe("타겟 발송", () => {
    it("지정된 userId 목록에 ADMIN_TARGETED 알림이 발송된다", async () => {
      // Given
      userRows = [["target-user-1"], ["target-user-2"]];
      mockNotificationPublisher.publishBatch.mockResolvedValue({
        count: 2,
      });

      // When
      const result = await sendTargetedNotificationUseCase.execute({
        title: "타겟 알림",
        body: "지정 사용자 알림입니다",
        userIds: ["target-user-1", "target-user-2"],
        action: undefined,
        force: false,
      });

      // Then
      expect(result.totalTargets).toBe(2);
      expect(result.successCount).toBe(2);
      expect(mockNotificationPublisher.publishBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            userId: "target-user-1",
            type: "ADMIN_TARGETED",
            force: false,
          }),
          expect.objectContaining({
            userId: "target-user-2",
            type: "ADMIN_TARGETED",
            force: false,
          }),
        ]),
      );
    });

    it("존재하지 않는 userId는 필터링된다", async () => {
      // Given
      userRows = [["existing-1"], ["existing-2"]];
      mockNotificationPublisher.publishBatch.mockResolvedValue({
        count: 2,
      });

      // When
      const result = await sendTargetedNotificationUseCase.execute({
        title: "타겟 알림",
        body: "일부 사용자 알림입니다",
        userIds: ["existing-1", "non-existing", "existing-2"],
        action: undefined,
        force: false,
      });

      // Then
      expect(result.totalTargets).toBe(2);
      expect(mockNotificationPublisher.publishBatch).toHaveBeenCalledWith(
        expect.not.arrayContaining([expect.objectContaining({ userId: "non-existing" })]),
      );
    });
  });
});
