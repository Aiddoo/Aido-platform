import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import type { Job } from "bullmq";

import type { TimezoneAwareReminderJob } from "../jobs/timezone-aware-reminder.job";
import {
	type ReminderHourChangedJobData,
	type TimezoneReminderJobData,
	TimezoneReminderJobName,
} from "./timezone-reminder-queue.constants";
import { TimezoneReminderProcessor } from "./timezone-reminder-queue.processor";

// =============================================================================
// Helpers
// =============================================================================

function createMockJob<T extends TimezoneReminderJobData>(
	name: string,
	data: T,
): Job<T> {
	return { name, data, id: `job-${name}` } as unknown as Job<T>;
}

// =============================================================================
// Tests
// =============================================================================

describe("TimezoneReminderProcessor", () => {
	let processor: TimezoneReminderProcessor;
	let reminderJob: Mocked<TimezoneAwareReminderJob>;

	beforeEach(async () => {
		const mockReminderJob = {
			handleMinuteSweep: jest.fn().mockResolvedValue(undefined),
			handleReminderHourChanged: jest.fn().mockResolvedValue(undefined),
		};

		const { unit } = await TestBed.solitary(
			TimezoneReminderProcessor,
		).compile();

		processor = unit;
		reminderJob =
			mockReminderJob as unknown as Mocked<TimezoneAwareReminderJob>;
		processor.setReminderJob(
			reminderJob as unknown as TimezoneAwareReminderJob,
		);
	});

	// =========================================================================
	// sweep-reminders
	// =========================================================================

	describe("sweep-reminders", () => {
		it("sweep-reminders 잡을 처리한다", async () => {
			// Given
			const job = createMockJob(
				TimezoneReminderJobName.SWEEP_REMINDERS,
				{} as Record<string, never>,
			);

			// When
			await processor.process(job);

			// Then
			expect(reminderJob.handleMinuteSweep).toHaveBeenCalled();
		});
	});

	// =========================================================================
	// reminder-hour-changed
	// =========================================================================

	describe("reminder-hour-changed", () => {
		it("reminder-hour-changed 잡을 처리한다", async () => {
			// Given
			const data: ReminderHourChangedJobData = {
				userId: "user-1",
				timezone: "Asia/Seoul",
				morningReminderHour: 8,
				morningReminderMinute: 0,
			};
			const job = createMockJob(
				TimezoneReminderJobName.REMINDER_HOUR_CHANGED,
				data,
			);

			// When
			await processor.process(job);

			// Then
			expect(reminderJob.handleReminderHourChanged).toHaveBeenCalledWith(data);
		});
	});

	// =========================================================================
	// unknown job
	// =========================================================================

	describe("unknown job", () => {
		it("알 수 없는 잡 이름은 경고 로그를 남긴다", async () => {
			// Given
			const job = createMockJob("unknown-job", {} as TimezoneReminderJobData);

			// When & Then — 에러 없이 처리
			await expect(processor.process(job)).resolves.not.toThrow();
			expect(reminderJob.handleMinuteSweep).not.toHaveBeenCalled();
			expect(reminderJob.handleReminderHourChanged).not.toHaveBeenCalled();
		});
	});
});
