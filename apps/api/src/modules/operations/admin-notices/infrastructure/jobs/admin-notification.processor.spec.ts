import { Logger } from "@nestjs/common";
import { TestBed } from "@suites/unit";
/**
 * AdminNotificationProcessor 단위 테스트
 *
 * - 잡 이름에 따라 올바른 유스케이스로 라우팅
 * - 알 수 없는 잡은 경고만
 */
import type { Mocked } from "vitest";

import { DispatchDailySignupSummaryUseCase } from "../../application/use-cases/dispatch-daily-signup-summary.use-case.js";
import { SendAdminNotificationUseCase } from "../../application/use-cases/send-admin-notification.use-case.js";
import { AdminNoticeInfraLogEvent } from "../admin-notices-infra.log-events.js";
import { AdminNotificationProcessor } from "./admin-notification.processor.js";
import {
  AdminNotificationJobName,
  type AdminNotificationSendData,
} from "./admin-notification.queue.js";

describe("AdminNotificationProcessor — 관리자 알림 프로세서", () => {
  let processor: AdminNotificationProcessor;
  let sendAdminNotification: Mocked<SendAdminNotificationUseCase>;
  let dispatchDailySummary: Mocked<DispatchDailySignupSummaryUseCase>;

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(AdminNotificationProcessor).compile();
    processor = unit;
    sendAdminNotification = unitRef.get(SendAdminNotificationUseCase);
    dispatchDailySummary = unitRef.get(DispatchDailySignupSummaryUseCase);
  });

  function createSendJob(data: AdminNotificationSendData) {
    return { name: AdminNotificationJobName.SEND, data };
  }

  describe("SEND 라우팅", () => {
    it("SEND 잡 → SendAdminNotificationUseCase에 채널·알림을 위임한다", async () => {
      const notice = {
        type: "message",
        message: { title: "테스트", body: "내용", severity: "success" },
      } as const;
      const job = createSendJob({ channel: "payment", notice });

      await processor.process(job);

      expect(sendAdminNotification.execute).toHaveBeenCalledWith("payment", notice);
    });
  });

  it("배포 중 남은 이전 형식 SEND 잡도 info 알림으로 바꿔 위임한다", async () => {
    // Given
    const legacy = {
      name: AdminNotificationJobName.SEND,
      data: { channel: "admin", notification: { title: "가입", body: "새 회원", color: 0x57f287 } },
    };

    // When
    await processor.process(legacy);

    // Then
    expect(sendAdminNotification.execute).toHaveBeenCalledWith("admin", {
      type: "message",
      message: { title: "가입", body: "새 회원", severity: "info", fields: [] },
    });
  });

  describe("DISPATCH_SUMMARY 라우팅", () => {
    it("DISPATCH_SUMMARY 잡 → DispatchDailySignupSummaryUseCase를 호출한다", async () => {
      const job = { name: AdminNotificationJobName.DISPATCH_SUMMARY, data: {} };

      await processor.process(job);

      expect(dispatchDailySummary.execute).toHaveBeenCalled();
      expect(sendAdminNotification.execute).not.toHaveBeenCalled();
    });
  });

  it("SEND 실패를 같은 오류로 전파하여 큐 재시도 의미를 유지한다", async () => {
    // Given
    const error = new Error("synthetic-private-retry-error");
    sendAdminNotification.execute.mockRejectedValue(error);

    // When / Then
    await expect(
      processor.process(
        createSendJob({
          channel: "admin",
          notice: { type: "message", message: { title: "제목", body: "본문", severity: "info" } },
        }),
      ),
    ).rejects.toBe(error);
  });

  it("worker·실패·미검증 job 원문은 로그에 남기지 않는다", async () => {
    // Given
    const secret = "synthetic-private-webhook-token-and-body";
    const error = new Error(secret);
    error.name = secret;
    const errorLog = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const warnLog = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

    // When
    processor.onError(error);
    processor.onFailed({ id: "internal-job-1", name: secret }, error);
    await processor.process({ name: secret, data: {} });

    // Then
    expect(errorLog).toHaveBeenCalledWith({
      event: AdminNoticeInfraLogEvent.WORKER_FAILED,
      queueName: "admin-notification.v1",
      errorType: "worker",
    });
    expect(errorLog).toHaveBeenCalledWith({
      event: AdminNoticeInfraLogEvent.JOB_FAILED,
      queueName: "admin-notification.v1",
      jobId: "internal-job-1",
      jobName: undefined,
      errorType: "job",
    });
    expect(warnLog).toHaveBeenCalledExactlyOnceWith({
      event: AdminNoticeInfraLogEvent.JOB_INVALID,
      queueName: "admin-notification.v1",
    });
    expect(JSON.stringify([...errorLog.mock.calls, ...warnLog.mock.calls])).not.toContain(secret);
    expect(sendAdminNotification.execute).not.toHaveBeenCalled();
    expect(dispatchDailySummary.execute).not.toHaveBeenCalled();
  });

  describe("알 수 없는 job", () => {
    it("알 수 없는 잡 이름은 경고만 출력한다", async () => {
      const job = { name: "unknown-job", data: {} };

      await expect(processor.process(job)).resolves.not.toThrow();
      expect(sendAdminNotification.execute).not.toHaveBeenCalled();
      expect(dispatchDailySummary.execute).not.toHaveBeenCalled();
    });
  });
});
