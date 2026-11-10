import { vi } from "vitest";

import type { QueueDefinition } from "#api/shared/application/ports/index";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";

import { REMINDER_STAGES } from "../../domain/reminder-plan.domain-service.js";
import { TodoReminderSchedulerAdapter } from "./todo-reminder-scheduler.adapter.js";
import { TODO_REMINDER_QUEUE } from "./todo-reminder.queue.js";

const USER_ID = "user-1";
const NOW = Temporal.Instant.from("2026-11-10T09:00:00Z");

// 취소한 key를 남겨 한 번에 지웠는지 본다
class CancelRecordingJobQueue extends InMemoryJobQueue {
  readonly cancelledKeys: string[][] = [];

  override async cancel(
    queue: QueueDefinition<object>,
    idempotencyKeys: readonly string[],
  ): Promise<void> {
    this.cancelledKeys.push([...idempotencyKeys]);
    await super.cancel(queue, idempotencyKeys);
  }
}

const at = (minutes: number) => NOW.add({ minutes });

describe("TodoReminderSchedulerAdapter — 영속 리마인더 스케줄링", () => {
  let jobQueue: CancelRecordingJobQueue;
  let adapter: TodoReminderSchedulerAdapter;

  beforeEach(() => {
    jobQueue = new CancelRecordingJobQueue();
    adapter = new TodoReminderSchedulerAdapter(jobQueue, new FixedClock(NOW));
  });

  const keys = () => jobQueue.jobsIn(TODO_REMINDER_QUEUE).map((job) => job.options.idempotencyKey);

  it("새 회차 리마인더는 취소 없이 한 번에 등록하고 지난 시각은 건너뛴다", async () => {
    // Given
    const reminders = [
      { todoId: 1, scheduledTime: at(120), userId: USER_ID },
      { todoId: 2, scheduledTime: at(-60), userId: USER_ID },
      { todoId: 3, scheduledTime: at(180), userId: USER_ID },
    ];
    // When
    await adapter.scheduleReminders(reminders);
    // Then
    expect(keys()).toEqual([
      "reminder_1_60min",
      "reminder_1_10min",
      "reminder_3_60min",
      "reminder_3_10min",
    ]);
    expect(jobQueue.cancelledKeys).toEqual([]);
  });

  it("지난 시각만 있으면 큐를 부르지 않는다", async () => {
    // When
    await adapter.scheduleReminders([{ todoId: 2, scheduledTime: at(-60), userId: USER_ID }]);
    // Then
    expect(jobQueue.jobs).toEqual([]);
  });

  it("2시간 뒤 마감은 60분·10분 작업을 고유 키와 단계 시각으로 등록한다", async () => {
    // When
    await adapter.scheduleReminder(1, at(120), USER_ID);
    // Then
    expect(jobQueue.jobsIn(TODO_REMINDER_QUEUE)).toEqual([
      {
        queue: TODO_REMINDER_QUEUE.name,
        payload: {
          name: "send-reminder",
          data: { todoId: 1, userId: USER_ID, stageLabel: "60min" },
        },
        options: { idempotencyKey: "reminder_1_60min", startAfter: NOW.add({ minutes: 60 }) },
      },
      {
        queue: TODO_REMINDER_QUEUE.name,
        payload: {
          name: "send-reminder",
          data: { todoId: 1, userId: USER_ID, stageLabel: "10min" },
        },
        options: { idempotencyKey: "reminder_1_10min", startAfter: NOW.add({ minutes: 110 }) },
      },
    ]);
  });

  it("30분 뒤 마감은 지난 60분 단계를 건너뛰고 10분 단계만 등록한다", async () => {
    // When
    await adapter.scheduleReminder(1, at(30), USER_ID);
    // Then
    expect(keys()).toEqual(["reminder_1_10min"]);
  });

  it("5분 뒤 마감은 모든 단계가 지나 아무것도 등록하지 않는다", async () => {
    // When
    await adapter.scheduleReminder(1, at(5), USER_ID);
    // Then
    expect(jobQueue.jobs).toHaveLength(0);
    expect(jobQueue.cancelledKeys.flat()).toHaveLength(REMINDER_STAGES.length);
  });

  it("10분 안쪽으로 시간을 다섯 번 고쳐도 알림 작업은 하나도 생기지 않는다", async () => {
    // When
    for (const minutes of [9, 8, 7, 6, 5]) {
      await adapter.scheduleReminder(1, at(minutes), USER_ID);
    }
    // Then
    expect(jobQueue.jobs).toHaveLength(0);
  });

  it("재스케줄 전 기존 작업 취소 실패를 호출자에게 전파한다", async () => {
    // Given
    const infrastructureError = new Error("postgres unavailable");
    vi.spyOn(jobQueue, "cancel").mockRejectedValueOnce(infrastructureError);
    // When
    const scheduling = adapter.scheduleReminder(42, at(120), USER_ID);
    // Then
    await expect(scheduling).rejects.toMatchObject({
      message: "Reminder cancellation failed: todoCount=1, runtime=job-runtime",
      cause: infrastructureError,
    });
    expect(jobQueue.jobs).toHaveLength(0);
  });

  it("새 리마인더 enqueue 실패를 호출자에게 전파한다", async () => {
    // Given
    const infrastructureError = new Error("queue unavailable");
    vi.spyOn(jobQueue, "enqueueMany").mockRejectedValueOnce(infrastructureError);
    // When
    const scheduling = adapter.scheduleReminder(42, at(120), USER_ID);
    // Then
    await expect(scheduling).rejects.toBe(infrastructureError);
  });

  it("같은 할 일을 다시 예약하면 옛 작업을 지우고 새 시각의 작업만 남긴다", async () => {
    // Given
    await adapter.scheduleReminder(42, at(120), USER_ID);
    // When
    await adapter.scheduleReminder(42, at(300), USER_ID);
    // Then
    expect(jobQueue.jobsIn(TODO_REMINDER_QUEUE).map((job) => job.options.startAfter)).toEqual([
      NOW.add({ minutes: 240 }),
      NOW.add({ minutes: 290 }),
    ]);
  });

  it("과거 일정은 기존 키를 취소하고 새 작업을 만들지 않는다", async () => {
    // When
    await adapter.scheduleReminder(1, at(-1), USER_ID);
    // Then
    expect(jobQueue.jobs).toHaveLength(0);
    expect(jobQueue.cancelledKeys.flat()).toHaveLength(REMINDER_STAGES.length);
  });

  it("취소 인프라 오류는 todoCount·runtime 문맥과 cause를 보존해 reject한다", async () => {
    // Given
    const infrastructureError = new Error("runtime unavailable");
    vi.spyOn(jobQueue, "cancel").mockRejectedValueOnce(infrastructureError);
    // When
    const cancellation = adapter.cancelReminders([42]);
    // Then
    await expect(cancellation).rejects.toMatchObject({
      message: "Reminder cancellation failed: todoCount=1, runtime=job-runtime",
      cause: infrastructureError,
    });
  });

  it("취소는 여러 할 일의 모든 단계 키를 한 번에 지운다", async () => {
    // When
    await adapter.cancelReminders([42, 43]);
    // Then
    expect(jobQueue.cancelledKeys).toEqual([
      [42, 43].flatMap((todoId) =>
        REMINDER_STAGES.map(({ label }) => `reminder_${todoId}_${label}`),
      ),
    ]);
  });
});
