import { flushPromises } from "@test/mocks";
import { FakeJobRuntime } from "@test/mocks/fake-job-runtime";
import {
	REMINDER_IMMEDIATE_LABEL,
	REMINDER_STAGES,
} from "../../domain/services/reminder-plan";
import {
	BullMQReminderSchedulerAdapter,
	TODO_REMINDER_QUEUE,
} from "./bullmq-reminder-scheduler.adapter";

const USER_ID = "user-1";
const HOUR_MS = 60 * 60 * 1000;

describe("BullMQReminderSchedulerAdapter — durable reminder scheduler", () => {
	let runtime: FakeJobRuntime;
	let adapter: BullMQReminderSchedulerAdapter;

	beforeEach(() => {
		runtime = new FakeJobRuntime();
		adapter = new BullMQReminderSchedulerAdapter(runtime);
	});

	it("2시간 뒤 마감은 60분·10분 작업을 고유 키로 등록한다", async () => {
		adapter.scheduleReminder(1, new Date(Date.now() + 2 * HOUR_MS), USER_ID);
		await flushPromises();

		expect(runtime.enqueueCalls).toHaveLength(REMINDER_STAGES.length);
		expect(runtime.enqueueCalls[0]).toMatchObject({
			queue: TODO_REMINDER_QUEUE,
			data: {
				name: "send-reminder",
				data: { todoId: 1, userId: USER_ID, stageLabel: "60min" },
			},
			options: { jobKey: "reminder_1_60min" },
		});
		expect(
			runtime.enqueueCalls[0]?.options.startAfter?.getTime(),
		).toBeGreaterThan(Date.now() + 50 * 60 * 1000);
	});

	it("5분 뒤 마감은 즉시 알림 하나만 등록한다", async () => {
		adapter.scheduleReminder(1, new Date(Date.now() + 5 * 60 * 1000), USER_ID);
		await flushPromises();

		expect(runtime.enqueueCalls).toHaveLength(1);
		expect(runtime.enqueueCalls[0]).toMatchObject({
			data: { data: { stageLabel: REMINDER_IMMEDIATE_LABEL } },
			options: { jobKey: `reminder_1_${REMINDER_IMMEDIATE_LABEL}` },
		});
	});

	it("과거 일정은 기존 키를 취소하고 새 작업을 만들지 않는다", async () => {
		adapter.scheduleReminder(1, new Date(Date.now() - 60_000), USER_ID);
		await flushPromises();

		expect(runtime.enqueueCalls).toHaveLength(0);
		expect(runtime.cancelCalls).toHaveLength(REMINDER_STAGES.length + 1);
	});

	it("취소는 모든 단계의 결정적 키를 제거한다", async () => {
		adapter.cancelReminder(42);
		await flushPromises();

		expect(runtime.cancelCalls).toEqual(
			[
				...REMINDER_STAGES.map(({ label }) => label),
				REMINDER_IMMEDIATE_LABEL,
			].map((label) => ({
				queue: TODO_REMINDER_QUEUE,
				jobKey: `reminder_42_${label}`,
			})),
		);
	});
});
