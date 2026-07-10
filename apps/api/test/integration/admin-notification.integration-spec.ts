/**
 * AdminNotificationProcessor 통합 테스트
 *
 * @description
 * AdminNotificationProcessor가 ADMIN_NOTIFIER, PAYMENT_NOTIFIER와 함께 올바르게 작동하는지 검증합니다.
 * 실제 Discord 웹훅 대신 모킹된 Notifier를 사용하여 프로세서 로직을 테스트합니다.
 *
 * 통합 테스트의 목적:
 * - NestJS 의존성 주입이 올바르게 작동하는지 검증
 * - AdminNotificationProcessor의 process(job) 메서드가 올바르게 작동하는지 검증
 * - 채널별 올바른 Notifier 라우팅 검증
 * - DISPATCH_SUMMARY 잡 처리 검증
 * - 에러 핸들링 검증
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test admin-notification.integration-spec
 * ```
 */

import { Test, type TestingModule } from "@nestjs/testing";
import { suppressLogger } from "@test/setup/suppress-logger";
import type { Job } from "bullmq";
import {
	ADMIN_NOTIFIER,
	PAYMENT_NOTIFIER,
} from "@/admin-notification/providers/admin-notifier.interface";
import { AdminNotificationProcessor } from "@/admin-notification/queue/admin-notification-queue.processor";

function createMockJob(name: string, data: Record<string, unknown>): Job {
	return { name, data, id: `job-${name}` } as unknown as Job;
}

describe("AdminNotificationProcessor 통합 테스트 (Mock DB)", () => {
	let module: TestingModule;
	let processor: AdminNotificationProcessor;

	// Mock Notifiers
	const mockAdminNotifier = {
		name: "admin-discord",
		send: jest.fn().mockResolvedValue({ success: true }),
		isConfigured: jest.fn().mockReturnValue(true),
	};

	const mockPaymentNotifier = {
		name: "payment-discord",
		send: jest.fn().mockResolvedValue({ success: true }),
		isConfigured: jest.fn().mockReturnValue(true),
	};

	beforeAll(async () => {
		suppressLogger();

		module = await Test.createTestingModule({
			providers: [
				AdminNotificationProcessor,
				{
					provide: ADMIN_NOTIFIER,
					useValue: mockAdminNotifier,
				},
				{
					provide: PAYMENT_NOTIFIER,
					useValue: mockPaymentNotifier,
				},
			],
		}).compile();

		processor = module.get<AdminNotificationProcessor>(
			AdminNotificationProcessor,
		);
	});

	afterAll(async () => {
		await module.close();
		jest.restoreAllMocks();
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("SEND 잡 처리 통합 테스트", () => {
		it("SEND 잡 admin 채널 — adminNotifier.send()가 호출된다", async () => {
			// Given - admin 채널로 알림 발송 잡
			const notification = {
				title: "신규 가입자 알림",
				body: "새로운 사용자가 가입했습니다.",
			};
			const job = createMockJob("send-notification", {
				channel: "admin",
				notification,
			});

			// When - 잡 처리
			await processor.process(job);

			// Then - adminNotifier.send()가 호출되어야 함
			expect(mockAdminNotifier.send).toHaveBeenCalledWith(notification);
			expect(mockPaymentNotifier.send).not.toHaveBeenCalled();
		});

		it("SEND 잡 payment 채널 — paymentNotifier.send()가 호출된다", async () => {
			// Given - payment 채널로 알림 발송 잡
			const notification = {
				title: "결제 완료",
				body: "구독 결제가 완료되었습니다.",
			};
			const job = createMockJob("send-notification", {
				channel: "payment",
				notification,
			});

			// When - 잡 처리
			await processor.process(job);

			// Then - paymentNotifier.send()가 호출되어야 함
			expect(mockPaymentNotifier.send).toHaveBeenCalledWith(notification);
			expect(mockAdminNotifier.send).not.toHaveBeenCalled();
		});

		it("send 실패 — 에러가 throw된다", async () => {
			// Given - send가 실패를 반환하는 경우
			mockAdminNotifier.send.mockResolvedValue({
				success: false,
				error: "Webhook rate limited",
			});

			const job = createMockJob("send-notification", {
				channel: "admin",
				notification: {
					title: "테스트",
					body: "실패 테스트",
				},
			});

			// When & Then - 에러가 throw되어야 함
			await expect(processor.process(job)).rejects.toThrow(
				"Discord webhook failed",
			);
		});
	});

	describe("DISPATCH_SUMMARY 잡 처리 통합 테스트", () => {
		it("DISPATCH_SUMMARY 잡 — dailySummaryJob이 설정되면 실행된다", async () => {
			// Given - dailySummaryJob이 설정된 상태
			const mockDailySummaryJob = {
				handleDailySummary: jest.fn().mockResolvedValue(undefined),
			};
			processor.setDailySummaryJob(mockDailySummaryJob as never);

			const job = createMockJob("dispatch-signup-summary", {});

			// When - 잡 처리
			await processor.process(job);

			// Then - handleDailySummary가 호출되어야 함
			expect(mockDailySummaryJob.handleDailySummary).toHaveBeenCalled();
		});

		it("DISPATCH_SUMMARY 잡 — dailySummaryJob 미설정 시 에러를 throw한다", async () => {
			// Given - dailySummaryJob이 설정되지 않은 상태
			// 새 프로세서 인스턴스 생성 (dailySummaryJob 미설정)
			const freshModule = await Test.createTestingModule({
				providers: [
					AdminNotificationProcessor,
					{
						provide: ADMIN_NOTIFIER,
						useValue: mockAdminNotifier,
					},
					{
						provide: PAYMENT_NOTIFIER,
						useValue: mockPaymentNotifier,
					},
				],
			}).compile();

			const freshProcessor = freshModule.get<AdminNotificationProcessor>(
				AdminNotificationProcessor,
			);

			const job = createMockJob("dispatch-signup-summary", {});

			// When & Then - dailySummaryJob 미설정 에러가 throw되어야 함
			await expect(freshProcessor.process(job)).rejects.toThrow(
				"DailySignupSummaryJob not initialized",
			);

			await freshModule.close();
		});
	});
});
