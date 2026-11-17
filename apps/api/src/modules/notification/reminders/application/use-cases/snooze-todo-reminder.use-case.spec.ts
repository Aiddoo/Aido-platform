import { ErrorCode } from "@aido/api/errors";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { StubSnoozeNotificationReader } from "#test/doubles/notification/stub-snooze-notification.reader";
import { StubSnoozeTodoReader } from "#test/doubles/notification/stub-snooze-todo.reader";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";
import { SilentLogger } from "#test/doubles/platform/silent-logger";

import { TodoReminderSnoozeSchedulerAdapter } from "../../infrastructure/jobs/todo-reminder-snooze-scheduler.adapter.js";
import {
  TODO_REMINDER_QUEUE,
  TODO_REMINDER_SNOOZE_JOB_NAME,
} from "../../infrastructure/jobs/todo-reminder.queue.js";
import type { SnoozeNotificationReadModel } from "../read-models/scheduler.read-model.js";
import { SnoozeTodoReminderUseCase } from "./snooze-todo-reminder.use-case.js";

const OWNER_ID = "user-owner";
const TODO_ID = 42;
const NOTIFICATION_ID = 1024;
// 10분 전 알림이 막 울린 때다
const NOW = Temporal.Instant.from("2026-11-18T09:30:00Z");

function reminderNotification(
  overrides: Partial<SnoozeNotificationReadModel> = {},
): SnoozeNotificationReadModel {
  return {
    recipientId: UserId.reconstitute(OWNER_ID),
    type: "TODO_REMINDER",
    todoId: TODO_ID,
    stage: "10min",
    createdAt: NOW,
    ...overrides,
  };
}

function setup() {
  const todoReader = new StubSnoozeTodoReader();
  todoReader.todos.set(TODO_ID, { ownerId: UserId.reconstitute(OWNER_ID), completed: false });
  const notificationReader = new StubSnoozeNotificationReader();
  notificationReader.notifications.set(NOTIFICATION_ID, reminderNotification());
  notificationReader.notifications.set(
    NOTIFICATION_ID + 1,
    reminderNotification({ stage: "snooze" }),
  );
  const jobQueue = new InMemoryJobQueue();
  const clock = new FixedClock(NOW);
  const useCase = new SnoozeTodoReminderUseCase({
    todoReader,
    notificationReader,
    snoozeScheduler: new TodoReminderSnoozeSchedulerAdapter(jobQueue),
    clock,
    logger: new SilentLogger(),
  });
  return { todoReader, notificationReader, jobQueue, clock, useCase };
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

  it("같은 알림을 나중에 다시 눌러도 작업은 하나이고 처음 예약한 시각을 돌려준다", async () => {
    // Given
    const { jobQueue, clock, useCase } = setup();
    const command = { userId: OWNER_ID, todoId: TODO_ID, notificationId: NOTIFICATION_ID };
    await useCase.execute(command);
    clock.advanceBy({ minutes: 3 });

    // When
    const repeated = await useCase.execute(command);

    // Then
    expect(repeated.remindAt).toEqual(Temporal.Instant.from("2026-11-18T09:40:00Z"));
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

  it.each([
    { name: "없는 알림", notification: null },
    {
      name: "남이 받은 알림",
      notification: reminderNotification({ recipientId: UserId.reconstitute("user-other") }),
    },
    { name: "다른 할 일의 알림", notification: reminderNotification({ todoId: TODO_ID + 1 }) },
    { name: "반복 알림 멈춤 안내", notification: reminderNotification({ stage: "series-paused" }) },
    {
      name: "리마인드가 아닌 알림",
      notification: reminderNotification({ type: "NUDGE_RECEIVED" }),
    },
    {
      name: "하루 넘게 지난 알림",
      notification: reminderNotification({ createdAt: NOW.subtract({ hours: 24, seconds: 1 }) }),
    },
  ])("$name으로는 NOTIFICATION_1004로 거절하고 예약하지 않는다", async ({ notification }) => {
    // Given
    const { notificationReader, jobQueue, useCase } = setup();
    notificationReader.notifications.delete(NOTIFICATION_ID);
    if (notification != null) {
      notificationReader.notifications.set(NOTIFICATION_ID, notification);
    }

    // When
    const result = useCase.execute({
      userId: OWNER_ID,
      todoId: TODO_ID,
      notificationId: NOTIFICATION_ID,
    });

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.NOTIFICATION_1004 });
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
