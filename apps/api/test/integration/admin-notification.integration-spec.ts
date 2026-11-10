import { Test, type TestingModule } from "@nestjs/testing";
/**
 * AdminNotificationProcessor 통합 테스트
 *
 * @description
 * AdminNotificationProcessor가 use-case(SendAdminNotification·DispatchDailySignupSummary)와
 * 함께 올바르게 작동하는지 검증합니다. 실제 Discord 웹훅·큐 대신 모킹된 포트를 사용합니다.
 *
 * 통합 테스트의 목적:
 * - NestJS 의존성 주입이 올바르게 작동하는지 검증
 * - AdminNotificationProcessor의 process(job) 메서드가 올바르게 작동하는지 검증
 * - 채널별 올바른 Notifier 라우팅 검증
 * - DISPATCH_SUMMARY 잡 처리(집계 → 큐 등록) 검증
 * - 에러 핸들링 검증
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/server test admin-notification.integration-spec
 * ```
 */
import { vi } from "vitest";

import { ADMIN_NOTIFICATION_QUEUE_PORT } from "#api/modules/operations/admin-notices/application/ports/admin-notification-queue.port";
import { ADMIN_NOTIFIER } from "#api/modules/operations/admin-notices/application/ports/admin-notifier.port";
import { SIGNUP_STATS_READER } from "#api/modules/operations/admin-notices/application/ports/signup-stats.reader.port";
import { AdminNotificationProcessor } from "#api/modules/operations/admin-notices/infrastructure/jobs/admin-notification.processor";
import { OPERATIONAL_ALERT } from "#api/shared/application/ports/operational-alert.port";
import { RecordingOperationalAlert } from "#test/mocks/recording-operational-alert";
import { suppressLogger } from "#test/setup/suppress-logger";

import {
  dispatchDailySignupSummaryProvider,
  sendAdminNotificationProvider,
} from "../../src/modules/operations/admin-notices/operations-admin-notices-application.providers.js";

function createMockJob(name: string, data: Record<string, unknown>) {
  return { name, data, id: `job-${name}` };
}

describe("AdminNotificationProcessor 통합 테스트 (Mock DB)", () => {
  let module: TestingModule;
  let processor: AdminNotificationProcessor;

  const alerts = new RecordingOperationalAlert();
  const mockAdminNotifier = {
    send: vi.fn().mockResolvedValue({ status: "sent" }),
  };

  // Mock ports (dispatch summary)
  const mockSignupStatsReader = {
    getSignupStats: vi.fn().mockResolvedValue({
      signupsByProvider: [{ provider: "CREDENTIAL", count: 3 }],
      totalUsers: 100,
    }),
  };

  const mockQueuePort = {
    enqueueSend: vi.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    suppressLogger();

    module = await Test.createTestingModule({
      providers: [
        AdminNotificationProcessor,
        sendAdminNotificationProvider,
        dispatchDailySignupSummaryProvider,
        {
          provide: ADMIN_NOTIFIER,
          useValue: mockAdminNotifier,
        },
        {
          provide: OPERATIONAL_ALERT,
          useValue: alerts,
        },
        {
          provide: SIGNUP_STATS_READER,
          useValue: mockSignupStatsReader,
        },
        {
          provide: ADMIN_NOTIFICATION_QUEUE_PORT,
          useValue: mockQueuePort,
        },
      ],
    }).compile();

    processor = module.get<AdminNotificationProcessor>(AdminNotificationProcessor);
  });

  afterAll(async () => {
    await module.close();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.resetAllMocks();
    alerts.alerts.length = 0;
    mockAdminNotifier.send.mockResolvedValue({ status: "sent" });
    mockSignupStatsReader.getSignupStats.mockResolvedValue({
      signupsByProvider: [{ provider: "CREDENTIAL", count: 3 }],
      totalUsers: 100,
    });
    mockQueuePort.enqueueSend.mockResolvedValue(undefined);
  });

  describe("SEND 잡 처리 통합 테스트", () => {
    it("배포 전 큐에 남은 조립 메시지 잡도 admin 채널 일반 메시지로 발송한다", async () => {
      // Given - 이전 형식(notification)으로 큐에 남은 admin 채널 잡
      const notification = {
        title: "신규 가입자 알림",
        body: "새로운 사용자가 가입했습니다.",
        severity: "success",
      };
      const job = createMockJob("send-notification", {
        channel: "admin",
        notification,
      });

      // When - 잡 처리
      await processor.process(job);

      // Then - 포트가 admin 채널로 호출되어야 함
      expect(mockAdminNotifier.send).toHaveBeenCalledWith("admin", {
        type: "message",
        message: notification,
      });
    });

    it("SEND 잡 payment 채널 — 구독 알림을 그대로 payment 채널로 발송한다", async () => {
      // Given - payment 채널로 구독 알림 발송 잡
      const notice = {
        type: "subscription_event",
        user: { userId: "user-1", email: "user@example.com", userTag: "MATT2025" },
        subscription: { event: "renewed", environment: "PRODUCTION", price: { usd: 2.99 } },
      };
      const job = createMockJob("send-notification", { channel: "payment", notice });

      // When - 잡 처리
      await processor.process(job);

      // Then - 포트가 payment 채널로 호출되어야 함
      expect(mockAdminNotifier.send).toHaveBeenCalledWith("payment", notice);
    });

    it("재시도 가능한 실패 — 큐 재시도를 위해 에러가 throw된다", async () => {
      // Given
      mockAdminNotifier.send.mockResolvedValue({
        status: "failed",
        retryable: true,
        statusCode: 429,
      });
      const job = createMockJob("send-notification", {
        channel: "admin",
        notice: {
          type: "message",
          message: { title: "테스트", body: "실패 테스트", severity: "info" },
        },
      });

      // When & Then
      await expect(processor.process(job)).rejects.toThrow("Admin notification delivery failed");
      expect(alerts.alerts).toEqual([]);
    });

    it("재시도 불가 거절 — throw 없이 운영 경보를 올린다", async () => {
      // Given
      mockAdminNotifier.send.mockResolvedValue({
        status: "failed",
        retryable: false,
        statusCode: 404,
      });
      const job = createMockJob("send-notification", {
        channel: "payment",
        notice: {
          type: "message",
          message: { title: "테스트", body: "거절 테스트", severity: "info" },
        },
      });

      // When
      await processor.process(job);

      // Then
      expect(alerts.alerts).toEqual([
        expect.objectContaining({ key: "operations.admin-notification.rejected" }),
      ]);
    });

    it("채널 미설정 — 던지지도 경보를 올리지도 않는다", async () => {
      // Given
      mockAdminNotifier.send.mockResolvedValue({ status: "skipped", reason: "not_configured" });
      const job = createMockJob("send-notification", {
        channel: "admin",
        notice: {
          type: "message",
          message: { title: "테스트", body: "미설정 테스트", severity: "info" },
        },
      });

      // When & Then
      await expect(processor.process(job)).resolves.toBeUndefined();
      expect(alerts.alerts).toEqual([]);
    });
  });

  describe("DISPATCH_SUMMARY 잡 처리 통합 테스트", () => {
    it("DISPATCH_SUMMARY 잡 — 집계 후 SEND 잡을 큐에 등록한다", async () => {
      // Given
      const job = createMockJob("dispatch-signup-summary", {});

      // When - 잡 처리
      await processor.process(job);

      // Then - 가입 통계 집계 후 admin 채널로 큐 등록
      expect(mockSignupStatsReader.getSignupStats).toHaveBeenCalled();
      expect(mockQueuePort.enqueueSend).toHaveBeenCalledWith(
        "admin",
        {
          type: "message",
          message: expect.objectContaining({ title: expect.stringContaining("일일 가입 리포트") }),
        },
        expect.objectContaining({
          jobId: expect.stringContaining("signup-summary_"),
        }),
      );
    });

    it("DISPATCH_SUMMARY 잡 — 집계 실패 시에도 예외를 전파하지 않는다", async () => {
      // Given - 리더가 실패
      mockSignupStatsReader.getSignupStats.mockRejectedValueOnce(new Error("DB connection error"));

      const job = createMockJob("dispatch-signup-summary", {});

      // When & Then - 예외 전파 없음, 큐 등록도 없음
      await expect(processor.process(job)).resolves.not.toThrow();
      expect(mockQueuePort.enqueueSend).not.toHaveBeenCalled();
    });
  });
});
