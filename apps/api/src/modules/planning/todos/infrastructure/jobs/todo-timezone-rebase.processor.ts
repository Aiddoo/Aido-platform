import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { TodoAlerts } from "../../application/todos.alerts.js";
import { TodoLogEvent } from "../../application/todos.log-events.js";
import { RebaseTodoTimezoneUseCase } from "../../application/use-cases/rebase-todo-timezone.use-case.js";
import {
  TODO_TIMEZONE_REBASE_QUEUE,
  type TodoTimezoneRebasePayload,
} from "./todo-timezone-rebase.queue.js";

@Injectable()
export class TodoTimezoneRebaseProcessor implements OnModuleInit {
  readonly #logger = new Logger(TodoTimezoneRebaseProcessor.name);
  readonly #rebaseTodoTimezone: Pick<RebaseTodoTimezoneUseCase, "execute">;
  readonly #alert: OperationalAlertPort;
  readonly #jobQueue: JobQueuePort;

  constructor(
    @Inject(RebaseTodoTimezoneUseCase)
    rebaseTodoTimezone: Pick<RebaseTodoTimezoneUseCase, "execute">,
    alert: OperationalAlertPort,
    jobQueue: JobQueuePort,
  ) {
    this.#rebaseTodoTimezone = rebaseTodoTimezone;
    this.#alert = alert;
    this.#jobQueue = jobQueue;
  }

  async onModuleInit(): Promise<void> {
    await this.#jobQueue.work(TODO_TIMEZONE_REBASE_QUEUE, async (jobs) => {
      for (const job of jobs) {
        await this.process(job.data, job.attempt);
      }
    });
  }

  async process(payload: TodoTimezoneRebasePayload, attempt: number): Promise<void> {
    const { userId } = payload.data;
    try {
      await this.#rebaseTodoTimezone.execute({ userId });
    } catch (error) {
      const errorType = toErrorType(error);
      this.#logger.warn({
        event: TodoLogEvent.TIMEZONE_REBASE_FAILED,
        userId,
        attempt,
        errorType,
      });
      if (attempt > TODO_TIMEZONE_REBASE_QUEUE.retry.retryLimit) {
        // 재시도가 끝났다. 알림이 옛 시각으로 울리므로 사람이 봐야 한다.
        this.#alert.raise({
          ...TodoAlerts.TIMEZONE_REBASE_FAILED,
          details: { userId, attempt, errorType },
        });
      }
      throw error;
    }
  }
}
