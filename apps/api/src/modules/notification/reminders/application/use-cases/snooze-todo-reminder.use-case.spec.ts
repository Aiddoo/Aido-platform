import { ErrorCode } from "@aido/api/errors";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { StubSnoozeTodoReader } from "#test/doubles/notification/stub-snooze-todo.reader";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";
import { SilentLogger } from "#test/doubles/platform/silent-logger";

import { TodoReminderSnoozeSchedulerAdapter } from "../../infrastructure/jobs/todo-reminder-snooze-scheduler.adapter.js";
import {
  TODO_REMINDER_QUEUE,
  TODO_REMINDER_SNOOZE_JOB_NAME,
} from "../../infrastructure/jobs/todo-reminder.queue.js";
import { SnoozeTodoReminderUseCase } from "./snooze-todo-reminder.use-case.js";

const OWNER_ID = "user-owner";
const TODO_ID = 42;
const NOTIFICATION_ID = 1024;
// 10분 전 알림이 막 울린 때다
const NOW = Temporal.Instant.from("2026-11-18T09:30:00Z");

function setup() {
  const todoReader = new StubSnoozeTodoReader();
  todoReader.todos.set(TODO_ID, { ownerId: UserId.reconstitute(OWNER_ID), completed: false });
  const jobQueue = new InMemoryJobQueue();
  const useCase = new SnoozeTodoReminderUseCase({
    todoReader,
    snoozeScheduler: new TodoReminderSnoozeSchedulerAdapter(jobQueue),
    clock: new FixedClock(NOW),
    logger: new SilentLogger(),
  });
  return { todoReader, jobQueue, useCase };
}

describe("SnoozeTodoReminderUseCase — 리마인드 알림 다시 받기", () => {
  it("10분 뒤에 같은 할 일의 다시 알림 작업을 하나 예약한다", async () => {
    // Given
    const { jobQueue, useCase } = setup();

    // When
    const snooze = await useCase.execute({
      userId: OWNER_ID,
      todoId: TODO_ID,
      notificationId: NOTIFICATION_ID,
    });

    // Then
    expect(snooze.remindAt).toEqual(Temporal.Instant.from("2026-11-18T09:40:00Z"));
    expect(jobQueue.jobsIn(TODO_REMINDER_QUEUE)).toEqual([
      {
        queue: TODO_REMINDER_QUEUE.name,
        payload: {
          name: TODO_REMINDER_SNOOZE_JOB_NAME,
          data: {
            todoId: TODO_ID,
            userId: OWNER_ID,
            notificationId: NOTIFICATION_ID,
            remindAt: "2026-11-18T09:40:00.000Z",
          },
        },
        options: {
          idempotencyKey: `reminder-snooze_${TODO_ID}_${NOTIFICATION_ID}`,
          startAfter: Temporal.Instant.from("2026-11-18T09:40:00Z"),
        },
      },
    ]);
  });

  it("같은 알림을 두 번 눌러도 작업은 하나다", async () => {
    // Given
    const { jobQueue, useCase } = setup();
    const command = { userId: OWNER_ID, todoId: TODO_ID, notificationId: NOTIFICATION_ID };

    // When
    await Promise.all([useCase.execute(command), useCase.execute(command)]);

    // Then
    expect(jobQueue.jobsIn(TODO_REMINDER_QUEUE)).toHaveLength(1);
  });

  it("다시 온 알림에서 또 누르면 그 알림으로 한 번 더 예약한다", async () => {
    // Given
    const { jobQueue, useCase } = setup();
    await useCase.execute({ userId: OWNER_ID, todoId: TODO_ID, notificationId: NOTIFICATION_ID });

    // When
    await useCase.execute({
      userId: OWNER_ID,
      todoId: TODO_ID,
      notificationId: NOTIFICATION_ID + 1,
    });

    // Then
    expect(jobQueue.jobsIn(TODO_REMINDER_QUEUE)).toHaveLength(2);
  });

  it.each([
    { name: "없는 할 일", todoId: 999, userId: OWNER_ID },
    { name: "남의 할 일", todoId: TODO_ID, userId: "user-other" },
  ])("$name은 TODO_0801로 거절하고 예약하지 않는다", async ({ todoId, userId }) => {
    // Given
    const { jobQueue, useCase } = setup();

    // When
    const result = useCase.execute({ userId, todoId, notificationId: NOTIFICATION_ID });

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
    expect(jobQueue.jobsIn(TODO_REMINDER_QUEUE)).toEqual([]);
  });

  it("완료한 할 일은 NOTIFICATION_1007로 거절하고 예약하지 않는다", async () => {
    // Given
    const { todoReader, jobQueue, useCase } = setup();
    todoReader.todos.set(TODO_ID, { ownerId: UserId.reconstitute(OWNER_ID), completed: true });

    // When
    const result = useCase.execute({
      userId: OWNER_ID,
      todoId: TODO_ID,
      notificationId: NOTIFICATION_ID,
    });

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.NOTIFICATION_1007 });
    expect(jobQueue.jobsIn(TODO_REMINDER_QUEUE)).toEqual([]);
  });
});
