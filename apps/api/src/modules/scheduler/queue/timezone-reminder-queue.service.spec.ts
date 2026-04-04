/**
 * TimezoneReminderQueueService 모듈 단위 테스트
 *
 * @description
 * TimezoneReminderQueueService 모듈의 DI 구성을 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test timezone-reminder-queue.service
 * ```
 */
import { getQueueToken } from "@nestjs/bullmq";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { flushPromises } from "@test/mocks";
import type { Queue } from "bullmq";
import {
	type ReminderHourChangedJobData,
	TIMEZONE_REMINDER_QUEUE,
	TimezoneReminderJobName,
} from "./timezone-reminder-queue.constants";
import { TimezoneReminderQueueService } from "./timezone-reminder-queue.service";

describe("TimezoneReminderQueueService — 타임존 리마인더 서비스", () => {
	let service: TimezoneReminderQueueService;
	let queue: Mocked<Queue>;

	beforeEach(async () => {
		const mockQueue = {
			add: jest.fn().mockResolvedValue(undefined),
		};

		const { unit, unitRef } = await TestBed.solitary(
			TimezoneReminderQueueService,
		)
			.mock(getQueueToken(TIMEZONE_REMINDER_QUEUE))
			.impl(() => mockQueue)
			.compile();

		service = unit;
		queue = unitRef.get(getQueueToken(TIMEZONE_REMINDER_QUEUE));
	});

	describe("enqueueReminderHourChanged", () => {
		it("잡을 큐에 등록한다", async () => {
			// Given
			const payload: ReminderHourChangedJobData = {
				userId: "user-1",
				timezone: "Asia/Seoul",
				morningReminderHour: 8,
				morningReminderMinute: 0,
			};

			// When
			service.enqueueReminderHourChanged(payload);
			await flushPromises();

			// Then
			expect(queue.add).toHaveBeenCalledWith(
				TimezoneReminderJobName.REMINDER_HOUR_CHANGED,
				payload,
			);
		});

		it("큐 등록 실패 시 에러를 throw하지 않는다 (fire-and-forget)", async () => {
			// Given
			queue.add.mockRejectedValue(new Error("Redis connection error"));
			const payload: ReminderHourChangedJobData = {
				userId: "user-1",
				timezone: "Asia/Seoul",
				morningReminderHour: 8,
				morningReminderMinute: 0,
			};

			// When & Then — 에러 전파 없음
			service.enqueueReminderHourChanged(payload);
			await expect(flushPromises()).resolves.not.toThrow();
		});
	});
});
