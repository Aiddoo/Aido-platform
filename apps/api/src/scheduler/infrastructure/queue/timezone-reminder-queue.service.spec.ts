import { TEST_CUID } from "@test/fixtures";
import { flushPromises } from "@test/mocks";
import { FakeJobRuntime } from "@test/mocks/fake-job-runtime";
import {
	type ReminderHourChangedJobData,
	TIMEZONE_REMINDER_QUEUE,
	TimezoneReminderJobName,
} from "./timezone-reminder-queue.constants";
import { TimezoneReminderQueueService } from "./timezone-reminder-queue.service";

describe("TimezoneReminderQueueService — durable runtime", () => {
	let runtime: FakeJobRuntime;
	let service: TimezoneReminderQueueService;

	beforeEach(() => {
		runtime = new FakeJobRuntime();
		service = new TimezoneReminderQueueService(runtime);
	});

	it("리마인더 시간 변경을 판별 가능한 메시지로 등록한다", async () => {
		const payload: ReminderHourChangedJobData = {
			userId: "user-1",
			timezone: "Asia/Seoul",
			morningReminderHour: 8,
			morningReminderMinute: 0,
		};

		service.enqueueReminderHourChanged(payload);
		await flushPromises();

		expect(runtime.enqueueCalls[0]).toMatchObject({
			queue: TIMEZONE_REMINDER_QUEUE,
			data: {
				name: TimezoneReminderJobName.REMINDER_HOUR_CHANGED,
				data: payload,
			},
		});
	});

	it("social digest를 90분 뒤 시작하도록 등록한다", async () => {
		const before = Date.now();
		service.enqueueSocialDigest({
			timezone: "Asia/Seoul",
			recipientUserIds: [TEST_CUID.USER_1],
		});
		await flushPromises();

		expect(runtime.enqueueCalls[0]).toMatchObject({
			data: { name: TimezoneReminderJobName.SOCIAL_DIGEST },
		});
		expect(
			runtime.enqueueCalls[0]?.options.startAfter?.getTime(),
		).toBeGreaterThanOrEqual(before + 90 * 60 * 1000);
	});

	it("매분 sweep 스케줄을 KST로 upsert한다", async () => {
		await service.registerSweepScheduler();

		expect(runtime.scheduleCalls[0]).toMatchObject({
			scheduleKey: "tz-reminder-sweep-scheduler",
			cron: "* * * * *",
			queue: TIMEZONE_REMINDER_QUEUE,
			options: { timezone: "Asia/Seoul" },
		});
	});
});
