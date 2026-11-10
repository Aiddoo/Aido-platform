import { Inject, Injectable } from "@nestjs/common";

import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";

import { todoReminderJobKey } from "../../../push/infrastructure/jobs/notification-job-keys.constants.js";
import type {
  IReminderScheduler,
  ReminderSchedule,
} from "../../application/ports/reminder-scheduler.port.js";
import { allReminderLabels, planReminderJobs } from "../../domain/reminder-plan.domain-service.js";
import {
  TODO_REMINDER_JOB_NAME,
  TODO_REMINDER_JOB_POLICY,
  TODO_REMINDER_QUEUE,
} from "./todo-reminder-queue.constants.js";

/** 예약 계획은 도메인 planReminderJobs가 정하고, 이 어댑터는 단계별 지연 작업을 job runtime에 등록·취소한다. */
@Injectable()
export class TodoReminderSchedulerAdapter implements IReminderScheduler {
  readonly #runtime: JobRuntimePort;

  constructor(@Inject(JOB_RUNTIME) runtime: JobRuntimePort) {
    this.#runtime = runtime;
  }

  async scheduleReminder(todoId: number, scheduledTime: Date, userId: string): Promise<void> {
    await this.cancelReminders([todoId]);
    await this.scheduleReminders([{ todoId, scheduledTime, userId }]);
  }

  async scheduleReminders(reminders: readonly ReminderSchedule[]): Promise<void> {
    const nowMs = Date.now();
    const jobs = reminders.flatMap(({ todoId, scheduledTime, userId }) =>
      planReminderJobs(scheduledTime.getTime(), nowMs).map((job) => ({
        data: {
          name: TODO_REMINDER_JOB_NAME,
          data: { todoId, userId, stageLabel: job.label },
        },
        options: {
          ...TODO_REMINDER_JOB_POLICY,
          idempotencyKey: todoReminderJobKey(todoId, job.label),
          startAfter: new Date(nowMs + job.delay),
        },
      })),
    );
    if (jobs.length > 0) {
      await this.#runtime.enqueueMany(TODO_REMINDER_QUEUE, jobs);
    }
  }

  async cancelReminders(todoIds: readonly number[]): Promise<void> {
    const keys = todoIds.flatMap((todoId) =>
      allReminderLabels().map((label) => todoReminderJobKey(todoId, label)),
    );
    try {
      await this.#runtime.cancel(TODO_REMINDER_QUEUE, keys);
    } catch (error) {
      throw new Error(
        `Reminder cancellation failed: todoCount=${todoIds.length}, runtime=job-runtime`,
        { cause: error },
      );
    }
  }
}
