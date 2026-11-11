import { Injectable } from "@nestjs/common";

import { ClockPort } from "#api/shared/application/ports/clock.port";
import { type EnqueueManyJob, JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import { todoReminderJobKey } from "../../../push/infrastructure/jobs/notification-job-keys.constants.js";
import {
  type ReminderSchedule,
  TodoReminderSchedulerPort,
} from "../../application/ports/todo-reminder-scheduler.port.js";
import { allReminderLabels, planReminderJobs } from "../../domain/reminder-plan.domain-service.js";
import {
  TODO_REMINDER_JOB_NAME,
  TODO_REMINDER_QUEUE,
  type TodoReminderRuntimeJob,
} from "./todo-reminder.queue.js";

/** 예약 계획은 도메인 planReminderJobs가 정하고, 이 어댑터는 단계별 지연 작업을 큐에 등록·취소한다. */
@Injectable()
export class TodoReminderSchedulerAdapter extends TodoReminderSchedulerPort {
  readonly #jobQueue: JobQueuePort;
  readonly #clock: ClockPort;

  constructor(jobQueue: JobQueuePort, clock: ClockPort) {
    super();
    this.#jobQueue = jobQueue;
    this.#clock = clock;
  }

  async scheduleReminder(
    todoId: number,
    scheduledTime: Temporal.Instant,
    userId: string,
  ): Promise<void> {
    await this.cancelReminders([todoId]);
    await this.scheduleReminders([{ todoId, scheduledTime, userId }]);
  }

  async scheduleReminders(reminders: readonly ReminderSchedule[]): Promise<void> {
    const now = this.#clock.now();
    const jobs = reminders.flatMap(({ todoId, scheduledTime, userId }) =>
      planReminderJobs(scheduledTime.epochMilliseconds, now.epochMilliseconds).map(
        (job): EnqueueManyJob<TodoReminderRuntimeJob> => ({
          payload: {
            name: TODO_REMINDER_JOB_NAME,
            data: { todoId, userId, stageLabel: job.label },
          },
          idempotencyKey: todoReminderJobKey(todoId, job.label),
          startAfter: now.add({ milliseconds: job.delay }),
        }),
      ),
    );
    if (jobs.length > 0) {
      await this.#jobQueue.enqueueMany(TODO_REMINDER_QUEUE, jobs);
    }
  }

  async cancelReminders(todoIds: readonly number[]): Promise<void> {
    const keys = todoIds.flatMap((todoId) =>
      allReminderLabels().map((label) => todoReminderJobKey(todoId, label)),
    );
    try {
      await this.#jobQueue.cancel(TODO_REMINDER_QUEUE, keys);
    } catch (error) {
      throw new Error(
        `Reminder cancellation failed: todoCount=${todoIds.length}, runtime=job-runtime`,
        { cause: error },
      );
    }
  }
}
