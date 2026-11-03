import { Inject, Injectable, Logger } from "@nestjs/common";

import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";

import type {
  IReminderScheduler,
  ReminderCancellationResult,
} from "../../../application/ports/reminders/reminder-scheduler.port.js";
import {
  allReminderLabels,
  planReminderJobs,
  REMINDER_IMMEDIATE_LABEL,
} from "../../../domain/services/reminders/reminder-plan.js";
import { todoReminderJobKey } from "../notification-job-keys.js";
import {
  TODO_REMINDER_JOB_NAME,
  TODO_REMINDER_JOB_POLICY,
  TODO_REMINDER_QUEUE,
} from "./todo-reminder-queue.constants.js";

/** 예약 계획은 도메인 planReminderJobs가 정하고, 이 어댑터는 단계별 지연 작업을 job runtime에 등록·취소한다. */
@Injectable()
export class TodoReminderSchedulerAdapter implements IReminderScheduler {
  readonly #logger = new Logger(TodoReminderSchedulerAdapter.name);

  constructor(@Inject(JOB_RUNTIME) private readonly runtime: JobRuntimePort) {}

  scheduleReminder(todoId: number, scheduledTime: Date, userId: string): Promise<void> {
    return this.#scheduleAsync(todoId, scheduledTime, userId);
  }

  cancelReminder(todoId: number): Promise<ReminderCancellationResult> {
    return this.#cancelAsync(todoId);
  }

  async #scheduleAsync(todoId: number, scheduledTime: Date, userId: string): Promise<void> {
    await this.#cancelAsync(todoId);

    const jobs = planReminderJobs(scheduledTime.getTime(), Date.now());

    if (jobs.length === 0) {
      this.#logger.debug(`Scheduled time already passed: todoId=${todoId}, skipping`);
      return;
    }

    for (const job of jobs) {
      await this.runtime.enqueue(
        TODO_REMINDER_QUEUE,
        {
          name: TODO_REMINDER_JOB_NAME,
          data: { todoId, userId, stageLabel: job.label },
        },
        {
          ...TODO_REMINDER_JOB_POLICY,
          idempotencyKey: todoReminderJobKey(todoId, job.label),
          startAfter: new Date(Date.now() + job.delay),
        },
      );

      if (job.label === REMINDER_IMMEDIATE_LABEL) {
        this.#logger.debug(`Immediate reminder scheduled: todoId=${todoId}`);
      } else {
        this.#logger.debug(
          `Reminder scheduled: todoId=${todoId}, stage=${job.label}, delay=${Math.round(job.delay / 1000)}s`,
        );
      }
    }
  }

  async #cancelAsync(todoId: number): Promise<ReminderCancellationResult> {
    let cancellationStatus: ReminderCancellationResult["status"] = "missing";

    for (const label of allReminderLabels()) {
      const jobId = todoReminderJobKey(todoId, label);
      try {
        const result = await this.runtime.cancel(TODO_REMINDER_QUEUE, jobId);
        if (result.status === "cancelled") {
          cancellationStatus = "cancelled";
          this.#logger.debug(`Reminder cancelled: todoId=${todoId}, stage=${label}`);
        }
      } catch (error) {
        throw new Error(
          `Reminder cancellation failed: todoId=${todoId}, stage=${label}, runtime=job-runtime`,
          { cause: error },
        );
      }
    }

    return { status: cancellationStatus };
  }
}
