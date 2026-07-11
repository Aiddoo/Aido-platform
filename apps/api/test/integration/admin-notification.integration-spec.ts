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
 * pnpm --filter @aido/api test admin-notification.integration-spec
 * ```
 */

import { Test, type TestingModule } from "@nestjs/testing";
import { suppressLogger } from "@test/setup/suppress-logger";
import type { Job } from "bullmq";
import { ADMIN_NOTIFIER, PAYMENT_NOTIFIER } from "@/admin-notification";
import { ADMIN_NOTIFICATION_QUEUE_PORT } from "@/admin-notification/application/ports/admin-notification-queue.port";
import { SIGNUP_STATS_READER } from "@/admin-notification/application/ports/signup-stats.reader.port";
import { DispatchDailySignupSummaryUseCase } from "@/admin-notification/application/use-cases/dispatch-daily-signup-summary/dispatch-daily-signup-summary.use-case";
import { SendAdminNotificationUseCase } from "@/admin-notification/application/use-cases/send-admin-notification/send-admin-notification.use-case";
import { AdminNotificationProcessor } from "@/admin-notification/infrastructure/queue/admin-notification-queue.processor";

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

	// Mock ports (dispatch summary)
	const mockSignupStatsReader = {
		getSignupStats: jest.fn().mockResolvedValue({
			signupsByProvider: [{ provider: "CREDENTIAL", count: 3 }],
			totalUsers: 100,
		}),
	};

	const mockQueuePort = {
		enqueueSend: jest.fn().mockResolvedValue(undefined),
	};

	beforeAll(async () => {
		suppressLogger();

		module = await Test.createTestingModule({
			providers: [
				AdminNotificationProcessor,
				SendAdminNotificationUseCase,
				DispatchDailySignupSummaryUseCase,
				{
					provide: ADMIN_NOTIFIER,
					useValue: mockAdminNotifier,
				},
				{
					provide: PAYMENT_NOTIFIER,
					useValue: mockPaymentNotifier,
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
		it("DISPATCH_SUMMARY 잡 — 집계 후 SEND 잡을 큐에 등록한다", async () => {
			// Given
			const job = createMockJob("dispatch-signup-summary", {});

			// When - 잡 처리
			await processor.process(job);

			// Then - 가입 통계 집계 후 admin 채널로 큐 등록
			expect(mockSignupStatsReader.getSignupStats).toHaveBeenCalled();
			expect(mockQueuePort.enqueueSend).toHaveBeenCalledWith(
				"admin",
				expect.objectContaining({
					title: expect.stringContaining("일일 가입 리포트"),
				}),
				expect.objectContaining({
					jobId: expect.stringContaining("signup-summary_"),
				}),
			);
		});

		it("DISPATCH_SUMMARY 잡 — 집계 실패 시에도 예외를 전파하지 않는다", async () => {
			// Given - 리더가 실패
			mockSignupStatsReader.getSignupStats.mockRejectedValueOnce(
				new Error("DB connection error"),
			);

			const job = createMockJob("dispatch-signup-summary", {});

			// When & Then - 예외 전파 없음, 큐 등록도 없음
			await expect(processor.process(job)).resolves.not.toThrow();
			expect(mockQueuePort.enqueueSend).not.toHaveBeenCalled();
		});
	});
});
