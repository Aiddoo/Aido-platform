/**
 * AdminNotificationProcessor 단위 테스트
 *
 * - 잡 이름에 따라 올바른 유스케이스로 라우팅
 * - 알 수 없는 잡은 경고만
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createMockJob } from "@test/mocks";

import { DispatchDailySignupSummaryUseCase } from "../../application/use-cases/dispatch-daily-signup-summary/dispatch-daily-signup-summary.use-case";
import { SendAdminNotificationUseCase } from "../../application/use-cases/send-admin-notification/send-admin-notification.use-case";
import {
	type AdminNotificationJobData,
	AdminNotificationJobName,
	type AdminNotificationSendData,
} from "./admin-notification-queue.constants";
import { AdminNotificationProcessor } from "./admin-notification-queue.processor";

describe("AdminNotificationProcessor — 관리자 알림 프로세서", () => {
	let processor: AdminNotificationProcessor;
	let sendAdminNotification: Mocked<SendAdminNotificationUseCase>;
	let dispatchDailySummary: Mocked<DispatchDailySignupSummaryUseCase>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			AdminNotificationProcessor,
		).compile();
		processor = unit;
		sendAdminNotification = unitRef.get(SendAdminNotificationUseCase);
		dispatchDailySummary = unitRef.get(DispatchDailySignupSummaryUseCase);
	});

	function createSendJob(data: AdminNotificationSendData) {
		return createMockJob<AdminNotificationJobData>(
			AdminNotificationJobName.SEND,
			data,
		);
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

			expect(sendAdminNotification.execute).toHaveBeenCalledWith(
				"payment",
				notification,
			);
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

	describe("unknown job", () => {
		it("알 수 없는 잡 이름은 경고만 출력한다", async () => {
			const job = createMockJob<AdminNotificationJobData>("unknown-job", {});

			await expect(processor.process(job)).resolves.not.toThrow();
			expect(sendAdminNotification.execute).not.toHaveBeenCalled();
			expect(dispatchDailySummary.execute).not.toHaveBeenCalled();
		});
	});
});
