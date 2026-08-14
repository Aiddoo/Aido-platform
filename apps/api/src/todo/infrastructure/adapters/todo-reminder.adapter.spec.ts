import type { IReminderScheduler } from "@/scheduler";

import { TodoReminderAdapter } from "./todo-reminder.adapter";

describe("TodoReminderAdapter — scheduler 경계 위임", () => {
	let scheduler: IReminderScheduler;
	let adapter: TodoReminderAdapter;

	beforeEach(() => {
		scheduler = {
			scheduleReminder: jest.fn(),
			cancelReminder: jest.fn(),
		};
		adapter = new TodoReminderAdapter(scheduler);
	});

	it("scheduler의 schedule 완료 Promise를 그대로 기다린다", async () => {
		// Given - scheduler가 비동기로 등록 완료
		jest.mocked(scheduler.scheduleReminder).mockResolvedValue(undefined);
		const scheduledTime = new Date("2026-03-01T06:00:00.000Z");

		// When & Then - Todo 경계도 완료를 관찰 가능한 Promise로 노출
		await expect(adapter.scheduleReminder(42, scheduledTime, "user-123")).resolves.toBeUndefined();
	});

	it("scheduler의 schedule 오류를 성공으로 바꾸지 않는다", async () => {
		// Given - scheduler 내부 취소/enqueue 실패
		const error = new Error("runtime unavailable");
		const rejected = Promise.reject(error);
		void rejected.catch(() => undefined);
		jest.mocked(scheduler.scheduleReminder).mockReturnValue(rejected);

		// When & Then - 같은 오류 reject
		await expect(adapter.scheduleReminder(42, new Date(), "user-123")).rejects.toBe(error);
	});

	it("scheduler의 cancelled 결과를 그대로 반환한다", async () => {
		// Given - scheduler가 작업을 취소함
		jest.mocked(scheduler.cancelReminder).mockResolvedValue({ status: "cancelled" });

		// When & Then - Todo 경계가 결과를 보존
		await expect(adapter.cancelReminder(42)).resolves.toEqual({
			status: "cancelled",
		});
	});

	it("scheduler의 missing 결과를 그대로 반환한다", async () => {
		// Given - 취소할 작업이 이미 없음
		jest.mocked(scheduler.cancelReminder).mockResolvedValue({
			status: "missing",
		});

		// When & Then - 정상적인 missing 결과
		await expect(adapter.cancelReminder(42)).resolves.toEqual({
			status: "missing",
		});
	});

	it("scheduler 인프라 오류를 성공이나 missing으로 바꾸지 않는다", async () => {
		// Given - scheduler 취소 실패
		const error = new Error("runtime unavailable");
		jest.mocked(scheduler.cancelReminder).mockRejectedValue(error);

		// When & Then - 같은 오류 reject
		await expect(adapter.cancelReminder(42)).rejects.toBe(error);
	});
});
