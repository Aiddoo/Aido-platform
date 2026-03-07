/**
 * AdminNotificationProcessor 단위 테스트
 *
 * Suites + GWT 패턴 적용
 * - 채널별 올바른 notifier 호출 검증
 * - 성공/실패 시 동작 검증
 */

import { TestBed } from "@suites/unit";
import type { Job } from "bullmq";

import {
	ADMIN_NOTIFIER,
	PAYMENT_NOTIFIER,
} from "../providers/admin-notifier.interface";
import {
	type AdminNotificationJobData,
	AdminNotificationJobName,
	type AdminNotificationSendData,
} from "./admin-notification-queue.constants";
import { AdminNotificationProcessor } from "./admin-notification-queue.processor";

describe("AdminNotificationProcessor", () => {
	let processor: AdminNotificationProcessor;
	let adminNotifier: { send: jest.Mock };
	let paymentNotifier: { send: jest.Mock };

	beforeEach(async () => {
		const mockAdminNotifier = {
			name: "admin",
			send: jest.fn().mockResolvedValue({ success: true }),
			isConfigured: jest.fn().mockReturnValue(true),
		};
		const mockPaymentNotifier = {
			name: "payment",
			send: jest.fn().mockResolvedValue({ success: true }),
			isConfigured: jest.fn().mockReturnValue(true),
		};

		const { unit } = await TestBed.solitary(AdminNotificationProcessor)
			.mock(ADMIN_NOTIFIER)
			.impl(() => mockAdminNotifier)
			.mock(PAYMENT_NOTIFIER)
			.impl(() => mockPaymentNotifier)
			.compile();

		processor = unit;
		adminNotifier = mockAdminNotifier;
		paymentNotifier = mockPaymentNotifier;
	});

	function makeJob(
		data: AdminNotificationSendData,
	): Job<AdminNotificationJobData> {
		return {
			name: AdminNotificationJobName.SEND,
			data,
		} as unknown as Job<AdminNotificationJobData>;
	}

	// =========================================================================
	// Stalled 이벤트
	// =========================================================================

	describe("onStalled", () => {
		it("stalled 발생 시 에러 없이 처리해야 한다", () => {
			// When & Then: 에러 없이 호출되어야 한다
			expect(() => processor.onStalled("test-job-id")).not.toThrow();
		});
	});

	// =========================================================================
	// 채널 라우팅
	// =========================================================================

	describe("채널 라우팅", () => {
		it("admin 채널 → ADMIN_NOTIFIER로 발송해야 한다", async () => {
			// Given
			const job = makeJob({
				channel: "admin",
				notification: { title: "테스트", body: "내용" },
			});

			// When
			await processor.process(job);

			// Then
			expect(adminNotifier.send).toHaveBeenCalledWith(
				expect.objectContaining({ title: "테스트", body: "내용" }),
			);
			expect(paymentNotifier.send).not.toHaveBeenCalled();
		});

		it("payment 채널 → PAYMENT_NOTIFIER로 발송해야 한다", async () => {
			// Given
			const job = makeJob({
				channel: "payment",
				notification: { title: "결제", body: "결제 내용" },
			});

			// When
			await processor.process(job);

			// Then
			expect(paymentNotifier.send).toHaveBeenCalledWith(
				expect.objectContaining({ title: "결제", body: "결제 내용" }),
			);
			expect(adminNotifier.send).not.toHaveBeenCalled();
		});
	});

	// =========================================================================
	// 성공/실패 처리
	// =========================================================================

	describe("성공/실패 처리", () => {
		it("send 성공 시 정상 완료해야 한다", async () => {
			// Given
			const job = makeJob({
				channel: "admin",
				notification: { title: "테스트", body: "내용" },
			});

			// When & Then
			await expect(processor.process(job)).resolves.not.toThrow();
		});

		it("send 실패 시 Error를 throw해야 한다 (BullMQ 재시도 트리거)", async () => {
			// Given
			adminNotifier.send.mockResolvedValue({
				success: false,
				error: "Webhook 404",
			});
			const job = makeJob({
				channel: "admin",
				notification: { title: "테스트", body: "내용" },
			});

			// When & Then
			await expect(processor.process(job)).rejects.toThrow(
				"Discord webhook failed: Webhook 404",
			);
		});
	});

	// =========================================================================
	// dispatch-signup-summary
	// =========================================================================

	describe("dispatch-signup-summary", () => {
		it("DailySignupSummaryJob.handleDailySummary()를 호출해야 한다", async () => {
			// Given
			const mockDailySummaryJob = {
				handleDailySummary: jest.fn().mockResolvedValue(undefined),
			};
			processor.setDailySummaryJob(mockDailySummaryJob as any);

			const job = {
				name: AdminNotificationJobName.DISPATCH_SUMMARY,
				data: {},
			} as unknown as Job<AdminNotificationJobData>;

			// When
			await processor.process(job);

			// Then
			expect(mockDailySummaryJob.handleDailySummary).toHaveBeenCalled();
		});

		it("DailySignupSummaryJob이 초기화되지 않으면 에러를 throw해야 한다", async () => {
			// Given — setDailySummaryJob 호출하지 않음
			const job = {
				name: AdminNotificationJobName.DISPATCH_SUMMARY,
				data: {},
			} as unknown as Job<AdminNotificationJobData>;

			// When & Then
			await expect(processor.process(job)).rejects.toThrow(
				"DailySignupSummaryJob not initialized",
			);
		});
	});

	// =========================================================================
	// unknown job
	// =========================================================================

	describe("unknown job", () => {
		it("알 수 없는 잡 이름은 경고만 출력한다", async () => {
			// Given
			const job = {
				name: "unknown-job",
				data: {},
			} as unknown as Job<AdminNotificationJobData>;

			// When & Then — 에러 없이 처리
			await expect(processor.process(job)).resolves.not.toThrow();
			expect(adminNotifier.send).not.toHaveBeenCalled();
			expect(paymentNotifier.send).not.toHaveBeenCalled();
		});
	});
});
