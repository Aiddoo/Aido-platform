import { getQueueToken } from "@nestjs/bullmq";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { flushPromises } from "@test/mocks";
import type { Queue } from "bullmq";
import {
	REMINDER_IMMEDIATE_LABEL,
	REMINDER_STAGES,
} from "../../constants/reminder.constants";
import {
	BullMQReminderSchedulerAdapter,
	TODO_REMINDER_QUEUE,
} from "./bullmq-reminder-scheduler.adapter";

// =============================================================================
// Constants
// =============================================================================

const USER_ID = "user-1";
const TODO_TITLE = "Test Todo";
const SIXTY_MIN_MS = 60 * 60 * 1000;

// =============================================================================
// Tests
// =============================================================================

describe("BullMQReminderSchedulerAdapter", () => {
	let adapter: BullMQReminderSchedulerAdapter;
	let queue: Mocked<Queue>;

	beforeEach(async () => {
		const mockQueue = {
			add: jest.fn().mockResolvedValue(undefined),
			getJob: jest.fn().mockResolvedValue(null),
		};

		const { unit, unitRef } = await TestBed.solitary(
			BullMQReminderSchedulerAdapter,
		)
			.mock(getQueueToken(TODO_REMINDER_QUEUE))
			.impl(() => mockQueue)
			.compile();

		adapter = unit;
		queue = unitRef.get(getQueueToken(TODO_REMINDER_QUEUE));
	});

	// =========================================================================
	// scheduleReminder — 다단계 BullMQ 잡 등록
	// =========================================================================

	describe("scheduleReminder", () => {
		it("2시간+ 후 마감이면 60분, 10분 두 단계 잡을 등록한다", async () => {
			// Given — 2시간 후 마감
			const scheduledTime = new Date(Date.now() + 2 * SIXTY_MIN_MS);

			// When
			adapter.scheduleReminder(1, scheduledTime, USER_ID, TODO_TITLE);
			await flushPromises();

			// Then — 각 단계별 잡 등록
			expect(queue.add).toHaveBeenCalledTimes(REMINDER_STAGES.length);

			// 60분 단계
			expect(queue.add).toHaveBeenCalledWith(
				"send-reminder",
				expect.objectContaining({
					todoId: 1,
					userId: USER_ID,
					todoTitle: TODO_TITLE,
					stageLabel: "60min",
				}),
				expect.objectContaining({
					jobId: "reminder_1_60min",
					removeOnComplete: true,
				}),
			);

			// 10분 단계
			expect(queue.add).toHaveBeenCalledWith(
				"send-reminder",
				expect.objectContaining({ stageLabel: "10min" }),
				expect.objectContaining({ jobId: "reminder_1_10min" }),
			);
		});

		it("30분 후 마감이면 60분 단계는 스킵하고 10분 단계만 등록한다", async () => {
			// Given — 30분 후 마감
			const scheduledTime = new Date(Date.now() + 30 * 60 * 1000);

			// When
			adapter.scheduleReminder(1, scheduledTime, USER_ID, TODO_TITLE);
			await flushPromises();

			// Then — 10분 단계만 등록 (getJob 호출 제외)
			expect(queue.add).toHaveBeenCalledTimes(1);
			expect(queue.add).toHaveBeenCalledWith(
				"send-reminder",
				expect.objectContaining({ stageLabel: "10min" }),
				expect.objectContaining({ jobId: "reminder_1_10min" }),
			);
		});

		it("5분 후 마감이면 모든 단계가 지나서 즉시 발송 잡을 등록한다", async () => {
			// Given — 5분 후 마감
			const scheduledTime = new Date(Date.now() + 5 * 60 * 1000);

			// When
			adapter.scheduleReminder(1, scheduledTime, USER_ID, TODO_TITLE);
			await flushPromises();

			// Then — 즉시 발송 잡
			expect(queue.add).toHaveBeenCalledTimes(1);
			expect(queue.add).toHaveBeenCalledWith(
				"send-reminder",
				expect.objectContaining({
					stageLabel: REMINDER_IMMEDIATE_LABEL,
					todoId: 1,
				}),
				expect.objectContaining({
					jobId: `reminder_1_${REMINDER_IMMEDIATE_LABEL}`,
					delay: 0,
				}),
			);
		});

		it("scheduledTime이 과거면 아무것도 하지 않는다", async () => {
			// Given — 과거 시간
			const scheduledTime = new Date(Date.now() - 60 * 1000);

			// When
			adapter.scheduleReminder(1, scheduledTime, USER_ID, TODO_TITLE);
			await flushPromises();

			// Then — 잡 등록 없음 (getJob은 기존 잡 제거 시도로 호출될 수 있음)
			expect(queue.add).not.toHaveBeenCalled();
		});

		it("같은 todoId로 재호출하면 기존 잡을 제거하고 새로 등록한다", async () => {
			// Given — 기존 잡 존재 시뮬레이션
			const mockJob = { remove: jest.fn().mockResolvedValue(undefined) };
			queue.getJob.mockResolvedValue(mockJob as never);

			const scheduledTime = new Date(Date.now() + 2 * SIXTY_MIN_MS);

			// When
			adapter.scheduleReminder(1, scheduledTime, USER_ID, TODO_TITLE);
			await flushPromises();

			// Then — 기존 잡 제거 호출됨
			expect(mockJob.remove).toHaveBeenCalled();
			// 새 잡 등록됨
			expect(queue.add).toHaveBeenCalledTimes(REMINDER_STAGES.length);
		});

		it("잡 등록 시 올바른 delay 값이 전달된다", async () => {
			// Given — 2시간 후 마감
			const now = Date.now();
			const scheduledTime = new Date(now + 2 * SIXTY_MIN_MS);

			// When
			adapter.scheduleReminder(1, scheduledTime, USER_ID, TODO_TITLE);
			await flushPromises();

			// Then — 60분 단계의 delay 확인
			const firstCall = queue.add.mock.calls.find(
				(call) => (call[2] as { jobId: string }).jobId === "reminder_1_60min",
			);
			expect(firstCall).toBeDefined();
			const options = firstCall?.[2] as { delay: number };
			// delay = scheduledTime - 60min - now ≈ 60min
			expect(options.delay).toBeGreaterThan(50 * 60 * 1000);
			expect(options.delay).toBeLessThanOrEqual(SIXTY_MIN_MS);
		});
	});

	// =========================================================================
	// cancelReminder
	// =========================================================================

	describe("cancelReminder", () => {
		it("등록된 모든 단계 잡을 제거한다", async () => {
			// Given — 잡 존재
			const mockJob = { remove: jest.fn().mockResolvedValue(undefined) };
			queue.getJob.mockResolvedValue(mockJob as never);

			// When
			adapter.cancelReminder(1);
			await flushPromises();

			// Then — 모든 단계 + immediate 잡 제거 시도
			const expectedJobCount = REMINDER_STAGES.length + 1; // stages + immediate
			expect(queue.getJob).toHaveBeenCalledTimes(expectedJobCount);
			expect(mockJob.remove).toHaveBeenCalledTimes(expectedJobCount);
		});

		it("잡이 없으면 에러 없이 무시한다", async () => {
			// Given — 잡 없음
			queue.getJob.mockResolvedValue(undefined as never);

			// When & Then
			adapter.cancelReminder(999);
			await expect(flushPromises()).resolves.not.toThrow();
		});

		it("잡 제거 중 에러가 발생해도 다른 잡 제거에 영향을 주지 않는다", async () => {
			// Given — 첫 번째 잡 제거 실패, 두 번째는 성공
			const failJob = {
				remove: jest.fn().mockRejectedValue(new Error("Already processed")),
			};
			const successJob = {
				remove: jest.fn().mockResolvedValue(undefined),
			};

			queue.getJob
				.mockResolvedValueOnce(failJob as never)
				.mockResolvedValueOnce(successJob as never)
				.mockResolvedValue(undefined as never);

			// When
			adapter.cancelReminder(1);
			await flushPromises();

			// Then — 두 번째 잡도 제거 시도됨
			expect(successJob.remove).toHaveBeenCalled();
		});
	});
});
