import { Injectable } from "@nestjs/common";

import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import { toIsoString } from "#api/shared/domain/time/instant";

import {
  type SnoozedReminderBooking,
  type SnoozedReminderSchedule,
  TodoReminderSnoozeSchedulerPort,
} from "../../application/ports/todo-reminder-snooze-scheduler.port.js";
import { todoReminderSnoozeJobKey } from "./reminder-job-keys.constants.js";
import { TODO_REMINDER_QUEUE, TODO_REMINDER_SNOOZE_JOB_NAME } from "./todo-reminder.queue.js";

/** 다시 알림은 리마인더와 같은 큐·worker로 보낸다. 늦음·완료 판단도 그 worker가 보낼 때 한다 */
@Injectable()
export class TodoReminderSnoozeSchedulerAdapter extends TodoReminderSnoozeSchedulerPort {
  readonly #jobQueue: Pick<JobQueuePort, "enqueue" | "findPayload">;

  constructor(jobQueue: JobQueuePort) {
    super();
    this.#jobQueue = jobQueue;
  }

  async scheduleSnooze({
    todoId,
    userId,
    notificationId,
    remindAt,
  }: SnoozedReminderSchedule): Promise<SnoozedReminderBooking> {
    const idempotencyKey = todoReminderSnoozeJobKey(todoId.value, notificationId.value);
    const jobId = await this.#jobQueue.enqueue(
      TODO_REMINDER_QUEUE,
      {
        name: TODO_REMINDER_SNOOZE_JOB_NAME,
        data: {
          todoId: todoId.value,
          userId: userId.value,
          notificationId: notificationId.value,
          remindAt: toIsoString(remindAt),
        },
      },
      { idempotencyKey, startAfter: remindAt },
    );
    if (jobId != null) {
      return { remindAt, isNew: true };
    }
    return { remindAt: await this.#bookedRemindAt(idempotencyKey, remindAt), isNew: false };
  }

  // 같은 알림의 예약이 이미 있으면 그 시각을 돌려준다. 그사이 지워졌으면 이번 요청 시각이다
  async #bookedRemindAt(
    idempotencyKey: string,
    requestedAt: Temporal.Instant,
  ): Promise<Temporal.Instant> {
    const booked = await this.#jobQueue.findPayload(TODO_REMINDER_QUEUE, idempotencyKey);
    if (booked?.name !== TODO_REMINDER_SNOOZE_JOB_NAME) {
      return requestedAt;
    }
    return Temporal.Instant.from(booked.data.remindAt);
  }
}
