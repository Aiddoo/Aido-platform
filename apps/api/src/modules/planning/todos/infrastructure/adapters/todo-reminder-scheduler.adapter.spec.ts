import { vi } from "vitest";

import type { TodoReminderSchedulerPort } from "#api/modules/notification/notification-reminders.public";

import { ReminderSchedulerAdapter } from "./todo-reminder-scheduler.adapter.js";

describe("ReminderSchedulerAdapter — scheduler 경계 위임", () => {
  let scheduler: TodoReminderSchedulerPort;
  let adapter: ReminderSchedulerAdapter;

  beforeEach(() => {
    scheduler = {
      scheduleReminder: vi.fn(),
      scheduleReminders: vi.fn(),
      cancelReminders: vi.fn(),
    };
    adapter = new ReminderSchedulerAdapter(scheduler);
  });

  it("scheduler의 schedule 완료 Promise를 그대로 기다린다", async () => {
    // Given - scheduler가 비동기로 등록 완료
    vi.mocked(scheduler.scheduleReminder).mockResolvedValue(undefined);
    const scheduledTime = Temporal.Instant.from("2026-03-01T06:00:00.000Z");

    // When & Then - Todo 경계도 완료를 관찰 가능한 Promise로 노출
    await expect(adapter.scheduleReminder(42, scheduledTime, "user-123")).resolves.toBeUndefined();
  });

  it("scheduler의 schedule 오류를 성공으로 바꾸지 않는다", async () => {
    // Given - scheduler 내부 취소/enqueue 실패
    const error = new Error("runtime unavailable");
    const rejected = Promise.reject(error);
    void rejected.catch(() => undefined);
    vi.mocked(scheduler.scheduleReminder).mockReturnValue(rejected);

    // When & Then - 같은 오류 reject
    await expect(
      adapter.scheduleReminder(42, Temporal.Instant.from("2026-03-01T06:00:00Z"), "user-123"),
    ).rejects.toBe(error);
  });

  it("scheduler 인프라 오류를 성공으로 바꾸지 않는다", async () => {
    // Given - scheduler 취소 실패
    const error = new Error("runtime unavailable");
    vi.mocked(scheduler.cancelReminders).mockRejectedValue(error);

    // When & Then - 같은 오류 reject
    await expect(adapter.cancelReminders([42])).rejects.toBe(error);
  });
});
