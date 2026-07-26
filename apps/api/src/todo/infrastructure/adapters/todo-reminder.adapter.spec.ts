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

	it("scheduler의 cancelled 결과를 그대로 반환한다", async () => {
		// Given - scheduler가 작업을 취소함
		jest
			.mocked(scheduler.cancelReminder)
			.mockResolvedValue({ status: "cancelled" });

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
