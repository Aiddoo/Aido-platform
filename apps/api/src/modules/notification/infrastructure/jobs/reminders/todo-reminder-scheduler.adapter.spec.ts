import { vi } from "vitest";

import { FakeJobRuntime } from "#test/mocks/fake-job-runtime";

import { REMINDER_STAGES } from "../../../domain/services/reminders/reminder-plan.js";
import { TODO_REMINDER_QUEUE } from "./todo-reminder-queue.constants.js";
import { TodoReminderSchedulerAdapter } from "./todo-reminder-scheduler.adapter.js";

const USER_ID = "user-1";
const HOUR_MS = 60 * 60 * 1000;

describe("TodoReminderSchedulerAdapter — 영속 리마인더 스케줄링", () => {
  let runtime: FakeJobRuntime;
  let adapter: TodoReminderSchedulerAdapter;

  beforeEach(() => {
    runtime = new FakeJobRuntime();
    adapter = new TodoReminderSchedulerAdapter(runtime);
  });

  it("새 회차 리마인더는 취소 없이 한 번에 등록하고 지난 시각은 건너뛴다", async () => {
    // Given
    const reminders = [
      { todoId: 1, scheduledTime: new Date(Date.now() + 2 * HOUR_MS), userId: USER_ID },
      { todoId: 2, scheduledTime: new Date(Date.now() - HOUR_MS), userId: USER_ID },
      { todoId: 3, scheduledTime: new Date(Date.now() + 3 * HOUR_MS), userId: USER_ID },
    ];
    // When
    await adapter.scheduleReminders(reminders);
    // Then
    expect(runtime.enqueueCalls.map((call) => call.options.idempotencyKey)).toEqual([
      "reminder_1_60min",
      "reminder_1_10min",
      "reminder_3_60min",
      "reminder_3_10min",
    ]);
    expect(runtime.cancelCalls).toEqual([]);
  });

  it("지난 시각만 있으면 큐를 부르지 않는다", async () => {
    // When
    await adapter.scheduleReminders([
      { todoId: 2, scheduledTime: new Date(Date.now() - HOUR_MS), userId: USER_ID },
    ]);
    // Then
    expect(runtime.enqueueCalls).toEqual([]);
  });

  it("2시간 뒤 마감은 60분·10분 작업을 고유 키로 등록한다", async () => {
    await adapter.scheduleReminder(1, new Date(Date.now() + 2 * HOUR_MS), USER_ID);

    expect(runtime.enqueueCalls).toHaveLength(REMINDER_STAGES.length);
    expect(runtime.enqueueCalls[0]).toMatchObject({
      queue: TODO_REMINDER_QUEUE,
      data: {
        name: "send-reminder",
        data: { todoId: 1, userId: USER_ID, stageLabel: "60min" },
      },
      options: { idempotencyKey: "reminder_1_60min" },
    });
    expect(runtime.enqueueCalls[0]?.options.startAfter?.getTime()).toBeGreaterThan(
      Date.now() + 50 * 60 * 1000,
    );
  });

  it("30분 뒤 마감은 지난 60분 단계를 건너뛰고 10분 단계만 등록한다", async () => {
    await adapter.scheduleReminder(1, new Date(Date.now() + 30 * 60 * 1000), USER_ID);

    expect(runtime.enqueueCalls).toHaveLength(1);
    expect(runtime.enqueueCalls[0]).toMatchObject({
      data: { data: { stageLabel: "10min" } },
      options: { idempotencyKey: "reminder_1_10min" },
    });
  });

  it("5분 뒤 마감은 모든 단계가 지나 아무것도 등록하지 않는다", async () => {
    await adapter.scheduleReminder(1, new Date(Date.now() + 5 * 60 * 1000), USER_ID);

    expect(runtime.enqueueCalls).toHaveLength(0);
    expect(runtime.cancelCalls).toHaveLength(REMINDER_STAGES.length);
  });

  it("10분 안쪽으로 시간을 다섯 번 고쳐도 알림 작업은 하나도 생기지 않는다", async () => {
    // Given
    const minutesLeft = [9, 8, 7, 6, 5];
    // When
    for (const minutes of minutesLeft) {
      await adapter.scheduleReminder(1, new Date(Date.now() + minutes * 60 * 1000), USER_ID);
    }
    // Then
    expect(runtime.enqueueCalls).toHaveLength(0);
  });

  it("과거 일정은 기존 키를 취소하고 새 작업을 만들지 않는다", async () => {
    await adapter.scheduleReminder(1, new Date(Date.now() - 60_000), USER_ID);

    expect(runtime.enqueueCalls).toHaveLength(0);
    expect(runtime.cancelCalls).toHaveLength(REMINDER_STAGES.length);
  });

  it("재스케줄 전 기존 작업 취소 실패를 호출자에게 전파한다", async () => {
    // Given
    const infrastructureError = new Error("postgres unavailable");
    vi.spyOn(runtime, "cancel").mockRejectedValueOnce(infrastructureError);
    // When
    const scheduling = adapter.scheduleReminder(42, new Date(Date.now() + 2 * HOUR_MS), USER_ID);
    // Then
    await expect(scheduling).rejects.toMatchObject({
      message: "Reminder cancellation failed: todoCount=1, runtime=job-runtime",
      cause: infrastructureError,
    });
    expect(runtime.enqueueCalls).toHaveLength(0);
  });

  it("새 리마인더 enqueue 실패를 호출자에게 전파한다", async () => {
    // Given
    const infrastructureError = new Error("queue unavailable");
    vi.spyOn(runtime, "enqueueMany").mockRejectedValueOnce(infrastructureError);
    // When
    const scheduling = adapter.scheduleReminder(42, new Date(Date.now() + 2 * HOUR_MS), USER_ID);
    // Then
    await expect(scheduling).rejects.toBe(infrastructureError);
  });

  it("같은 할 일을 다시 예약하면 새 시각의 작업이 기록된다", async () => {
    // Given
    await adapter.scheduleReminder(42, new Date(Date.now() + 2 * HOUR_MS), USER_ID);
    runtime.enqueueCalls.length = 0;
    const moved = Date.now() + 5 * HOUR_MS;
    // When
    await adapter.scheduleReminder(42, new Date(moved), USER_ID);
    // Then
    expect(runtime.enqueueCalls).toHaveLength(REMINDER_STAGES.length);
    expect(runtime.enqueueCalls[0]?.options.startAfter?.getTime()).toBeGreaterThan(
      moved - 2 * HOUR_MS,
    );
  });

  it("취소는 여러 할 일의 모든 단계 키를 한 번에 지운다", async () => {
    // Given
    const cancel = vi.spyOn(runtime, "cancel");
    // When
    await adapter.cancelReminders([42, 43]);
    // Then
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(runtime.cancelCalls.map(({ idempotencyKey }) => idempotencyKey)).toEqual(
      [42, 43].flatMap((todoId) =>
        REMINDER_STAGES.map(({ label }) => `reminder_${todoId}_${label}`),
      ),
    );
  });

  it("취소 인프라 오류는 todoCount·runtime 문맥과 cause를 보존해 reject한다", async () => {
    // Given
    const infrastructureError = new Error("runtime unavailable");
    vi.spyOn(runtime, "cancel").mockRejectedValueOnce(infrastructureError);
    // When
    const cancellation = adapter.cancelReminders([42]);
    // Then
    await expect(cancellation).rejects.toMatchObject({
      message: "Reminder cancellation failed: todoCount=1, runtime=job-runtime",
      cause: infrastructureError,
    });
  });
});
