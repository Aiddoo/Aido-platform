import { vi } from "vitest";

import type { TodoReminderSchedulerPort } from "#api/modules/notification/reminders/notification-reminders.public";

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
    // Given
    vi.mocked(scheduler.scheduleReminder).mockResolvedValue(undefined);
    const scheduledTime = Temporal.Instant.from("2026-03-01T06:00:00.000Z");

    // When
    const result = adapter.scheduleReminder(42, scheduledTime, "user-123");

    // Then
    await expect(result).resolves.toBeUndefined();
  });

  it("scheduler의 schedule 오류를 성공으로 바꾸지 않는다", async () => {
    // Given
    const error = new Error("runtime unavailable");
    const rejected = Promise.reject(error);
    void rejected.catch(() => undefined);
    vi.mocked(scheduler.scheduleReminder).mockReturnValue(rejected);

    // When
    const result = adapter.scheduleReminder(
      42,
      Temporal.Instant.from("2026-03-01T06:00:00Z"),
      "user-123",
    );

    // Then
    await expect(result).rejects.toBe(error);
  });

  it("scheduler 인프라 오류를 성공으로 바꾸지 않는다", async () => {
    // Given
    const error = new Error("runtime unavailable");
    vi.mocked(scheduler.cancelReminders).mockRejectedValue(error);

    // When
    const result = adapter.cancelReminders([42]);

    // Then
    await expect(result).rejects.toBe(error);
  });
});
