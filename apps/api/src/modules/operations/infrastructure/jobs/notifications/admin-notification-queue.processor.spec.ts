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

  describe("onStalled", () => {
    it("stalled 발생 시 에러 없이 처리해야 한다", () => {
      expect(() => processor.onStalled("test-job-id")).not.toThrow();
    });
  });

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

  describe("알 수 없는 job", () => {
    it("알 수 없는 잡 이름은 경고만 출력한다", async () => {
      const job = createMockJob<AdminNotificationJobData>("unknown-job", {});

      await expect(processor.process(job)).resolves.not.toThrow();
      expect(sendAdminNotification.execute).not.toHaveBeenCalled();
      expect(dispatchDailySummary.execute).not.toHaveBeenCalled();
    });
  });
});
