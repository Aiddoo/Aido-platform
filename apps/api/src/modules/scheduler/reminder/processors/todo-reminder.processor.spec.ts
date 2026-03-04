import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import type { Job } from "bullmq";

import { DatabaseService } from "@/database/database.service";

import { NotificationService } from "../../../notification/notification.service";
import type { ReminderJobData } from "../adapters/bullmq-reminder-scheduler.adapter";
import { TodoReminderProcessor } from "./todo-reminder.processor";

// =============================================================================
// Constants
// =============================================================================

const USER_ID = "user-1";
const TODO_TITLE = "Test Todo";

// =============================================================================
// Helpers
// =============================================================================

function createMockJob(
	data: Partial<ReminderJobData> = {},
): Job<ReminderJobData> {
	return {
		data: {
			todoId: data.todoId ?? 1,
			userId: data.userId ?? USER_ID,
			todoTitle: data.todoTitle ?? TODO_TITLE,
			stageLabel: data.stageLabel ?? "60min",
		},
	} as Job<ReminderJobData>;
}

// =============================================================================
// Tests
// =============================================================================

describe("TodoReminderProcessor", () => {
	let processor: TodoReminderProcessor;
	let databaseService: Mocked<DatabaseService>;
	let notificationService: Mocked<NotificationService>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			TodoReminderProcessor,
		).compile();

		processor = unit;
		databaseService = unitRef.get(DatabaseService);
		notificationService = unitRef.get(NotificationService);
	});

	/**
	 * DB mock 설정 헬퍼
	 */
	const setupMocks = (
		options: { todoExists?: boolean; notificationExists?: boolean } = {},
	) => {
		const { todoExists = true, notificationExists = false } = options;

		Object.defineProperty(databaseService, "todo", {
			value: {
				findFirst: jest.fn().mockResolvedValue(todoExists ? { id: 1 } : null),
			},
			configurable: true,
			writable: true,
		});

		Object.defineProperty(databaseService, "notification", {
			value: {
				findFirst: jest
					.fn()
					.mockResolvedValue(notificationExists ? { id: 999 } : null),
			},
			configurable: true,
			writable: true,
		});
	};

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
	// process — 정상 처리
	// =========================================================================

	describe("정상 처리", () => {
		it("유효한 투두에 대해 알림을 발송한다", async () => {
			// Given
			setupMocks({ todoExists: true, notificationExists: false });
			notificationService.createAndSend.mockResolvedValue({} as never);

			const job = createMockJob({
				todoId: 1,
				stageLabel: "60min",
			});

			// When
			await processor.process(job);

			// Then
			expect(notificationService.createAndSend).toHaveBeenCalledTimes(1);
			expect(notificationService.createAndSend).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: USER_ID,
					type: "TODO_REMINDER",
					todoId: 1,
					metadata: { stage: "60min" },
				}),
			);
		});

		it("10min 단계 알림을 발송한다", async () => {
			// Given
			setupMocks({ todoExists: true, notificationExists: false });
			notificationService.createAndSend.mockResolvedValue({} as never);

			const job = createMockJob({ stageLabel: "10min" });

			// When
			await processor.process(job);

			// Then
			expect(notificationService.createAndSend).toHaveBeenCalledWith(
				expect.objectContaining({
					metadata: { stage: "10min" },
				}),
			);
		});

		it("immediate 단계 알림을 발송한다", async () => {
			// Given
			setupMocks({ todoExists: true, notificationExists: false });
			notificationService.createAndSend.mockResolvedValue({} as never);

			const job = createMockJob({ stageLabel: "immediate" });

			// When
			await processor.process(job);

			// Then
			expect(notificationService.createAndSend).toHaveBeenCalledWith(
				expect.objectContaining({
					metadata: { stage: "immediate" },
				}),
			);
		});
	});

	// =========================================================================
	// process — 투두 유효성 검증
	// =========================================================================

	describe("투두 유효성 검증", () => {
		it("투두가 완료되었으면 알림을 발송하지 않는다", async () => {
			// Given
			setupMocks({ todoExists: false });

			const job = createMockJob();

			// When
			await processor.process(job);

			// Then
			expect(notificationService.createAndSend).not.toHaveBeenCalled();
		});

		it("투두가 삭제되었으면 알림을 발송하지 않는다", async () => {
			// Given — findFirst가 null 반환 (삭제됨)
			setupMocks({ todoExists: false });

			const job = createMockJob();

			// When
			await processor.process(job);

			// Then
			expect(notificationService.createAndSend).not.toHaveBeenCalled();
		});
	});

	// =========================================================================
	// process — DB dedup
	// =========================================================================

	describe("DB 중복 방지", () => {
		it("24시간 내 동일 알림이 있으면 스킵한다", async () => {
			// Given — 투두는 존재하지만 동일 알림이 이미 발송됨
			setupMocks({ todoExists: true, notificationExists: true });

			const job = createMockJob();

			// When
			await processor.process(job);

			// Then
			expect(notificationService.createAndSend).not.toHaveBeenCalled();
		});

		it("동일 알림이 없으면 정상 발송한다", async () => {
			// Given
			setupMocks({ todoExists: true, notificationExists: false });
			notificationService.createAndSend.mockResolvedValue({} as never);

			const job = createMockJob();

			// When
			await processor.process(job);

			// Then
			expect(notificationService.createAndSend).toHaveBeenCalledTimes(1);
		});
	});

	// =========================================================================
	// process — 에러 처리
	// =========================================================================

	describe("에러 처리", () => {
		it("알림 발송 실패 시 에러가 전파된다 (BullMQ 재시도)", async () => {
			// Given
			setupMocks({ todoExists: true, notificationExists: false });
			const error = new Error("Push failed");
			notificationService.createAndSend.mockRejectedValue(error);

			const job = createMockJob();

			// When & Then — BullMQ가 재시도하도록 에러 전파
			await expect(processor.process(job)).rejects.toThrow("Push failed");
		});

		it("DB 조회 실패 시 에러가 전파된다 (BullMQ 재시도)", async () => {
			// Given
			Object.defineProperty(databaseService, "todo", {
				value: {
					findFirst: jest
						.fn()
						.mockRejectedValue(new Error("DB connection failed")),
				},
				configurable: true,
				writable: true,
			});

			const job = createMockJob();

			// When & Then
			await expect(processor.process(job)).rejects.toThrow(
				"DB connection failed",
			);
		});
	});
});
