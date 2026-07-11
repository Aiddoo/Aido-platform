/**
 * TimezoneReminderProcessor 잡/프로세서 단위 테스트
 *
 * @description
 * TimezoneReminderProcessor가 잡 이름에 따라 오케스트레이터 핸들러에 위임하는지
 * 격리 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test timezone-reminder-queue.processor
 * ```
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createMockJob } from "@test/mocks";

import { TimezoneAwareReminderOrchestrator } from "../../application/services/timezone-aware-reminder.orchestrator";
import {
	type ReminderHourChangedJobData,
	type SocialDigestJobData,
	type SweepRemindersJobData,
	TimezoneReminderJobName,
} from "./timezone-reminder-queue.constants";
import { TimezoneReminderProcessor } from "./timezone-reminder-queue.processor";

describe("TimezoneReminderProcessor — 타임존 리마인더 프로세서", () => {
	let processor: TimezoneReminderProcessor;
	let orchestrator: Mocked<TimezoneAwareReminderOrchestrator>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			TimezoneReminderProcessor,
		).compile();

		processor = unit;
		orchestrator = unitRef.get(TimezoneAwareReminderOrchestrator);
	});

	describe("sweep-reminders", () => {
		it("sweep-reminders 잡을 sweep 핸들러에 위임한다", async () => {
			// Given
			const data: SweepRemindersJobData = {};
			const job = createMockJob(TimezoneReminderJobName.SWEEP_REMINDERS, data);

			// When
			await processor.process(job);

			// Then
			expect(orchestrator.handleMinuteSweep).toHaveBeenCalled();
		});
	});

	describe("reminder-hour-changed", () => {
		it("reminder-hour-changed 잡을 catch-up 핸들러에 위임한다", async () => {
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
			expect(orchestrator.handleReminderHourChanged).toHaveBeenCalledWith(data);
		});
	});

	describe("social-digest", () => {
		it("social-digest 잡을 소셜 다이제스트 핸들러에 위임한다", async () => {
			// Given
			const data: SocialDigestJobData = { timezone: "Asia/Seoul" };
			const job = createMockJob(TimezoneReminderJobName.SOCIAL_DIGEST, data);

			// When
			await processor.process(job);

			// Then
			expect(orchestrator.handleSocialDigest).toHaveBeenCalledWith(data);
		});
	});
});
