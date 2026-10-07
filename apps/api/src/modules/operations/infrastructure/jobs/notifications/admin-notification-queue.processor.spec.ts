import { Logger } from "@nestjs/common";
import { TestBed } from "@suites/unit";
/**
 * AdminNotificationProcessor 단위 테스트
 *
 * - 잡 이름에 따라 올바른 유스케이스로 라우팅
 * - 알 수 없는 잡은 경고만
 */
import type { Mocked } from "vitest";

import { createMockJob } from "#test/mocks/index";

import { DispatchDailySignupSummary } from "../../../application/use-cases/notifications/dispatch-daily-signup-summary.use-case.js";
import { SendAdminNotification } from "../../../application/use-cases/notifications/send-admin-notification.use-case.js";
import { AdminNotificationInfraEvent } from "../../observability/notifications/admin-notification-infra.events.js";
import {
  type AdminNotificationJobData,
  AdminNotificationJobName,
  type AdminNotificationSendData,
} from "./admin-notification-queue.constants.js";
import { AdminNotificationProcessor } from "./admin-notification-queue.processor.js";

describe("AdminNotificationProcessor — 관리자 알림 프로세서", () => {
  let processor: AdminNotificationProcessor;
  let sendAdminNotification: Mocked<SendAdminNotification>;
  let dispatchDailySummary: Mocked<DispatchDailySignupSummary>;

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(AdminNotificationProcessor).compile();
    processor = unit;
    sendAdminNotification = unitRef.get(SendAdminNotification);
    dispatchDailySummary = unitRef.get(DispatchDailySignupSummary);
  });

  function createSendJob(data: AdminNotificationSendData) {
    return createMockJob<AdminNotificationJobData>(AdminNotificationJobName.SEND, data);
  }

  describe("SEND 라우팅", () => {
    it("SEND 잡 → SendAdminNotificationUseCase에 채널·알림을 위임한다", async () => {
      const notification = { title: "테스트", body: "내용" };
      const job = createSendJob({ channel: "payment", notification });

      await processor.process(job);

      expect(sendAdminNotification.execute).toHaveBeenCalledWith("payment", notification);
    });
  });

  describe("DISPATCH_SUMMARY 라우팅", () => {
    it("DISPATCH_SUMMARY 잡 → DispatchDailySignupSummaryUseCase를 호출한다", async () => {
      const job = createMockJob<AdminNotificationJobData>(
        AdminNotificationJobName.DISPATCH_SUMMARY,
        {},
      );

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
        createSendJob({ channel: "admin", notification: { title: "제목", body: "본문" } }),
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
    await processor.process(createMockJob<AdminNotificationJobData>(secret, {}));

    // Then
    expect(errorLog).toHaveBeenCalledWith({
      event: AdminNotificationInfraEvent.WORKER_FAILED,
      queueName: "admin-notification.v1",
      errorType: "worker",
    });
    expect(errorLog).toHaveBeenCalledWith({
      event: AdminNotificationInfraEvent.JOB_FAILED,
      queueName: "admin-notification.v1",
      jobId: "internal-job-1",
      jobName: undefined,
      errorType: "job",
    });
    expect(warnLog).toHaveBeenCalledExactlyOnceWith({
      event: AdminNotificationInfraEvent.JOB_INVALID,
      queueName: "admin-notification.v1",
    });
    expect(JSON.stringify([...errorLog.mock.calls, ...warnLog.mock.calls])).not.toContain(secret);
    expect(sendAdminNotification.execute).not.toHaveBeenCalled();
    expect(dispatchDailySummary.execute).not.toHaveBeenCalled();
  });

  describe("알 수 없는 job", () => {
    it("알 수 없는 잡 이름은 경고만 출력한다", async () => {
      const job = createMockJob<AdminNotificationJobData>("unknown-job", {});

      await expect(processor.process(job)).resolves.not.toThrow();
      expect(sendAdminNotification.execute).not.toHaveBeenCalled();
      expect(dispatchDailySummary.execute).not.toHaveBeenCalled();
    });
  });
});
