import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";
import {
  OPERATIONAL_ALERT,
  type OperationalAlertPort,
} from "#api/shared/application/ports/operational-alert.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { TodoAlertKey } from "../../application/todos.alerts.js";
import { TodoLogEvent } from "../../application/todos.log-events.js";
import { RebaseTodoTimezoneUseCase } from "../../application/use-cases/rebase-todo-timezone.use-case.js";
import {
  TODO_TIMEZONE_REBASE_JOB_POLICY,
  TODO_TIMEZONE_REBASE_QUEUE,
  TODO_TIMEZONE_REBASE_WORKER_POLICY,
  todoTimezoneRebaseJobSchema,
} from "./todo-timezone-rebase.queue.js";

@Injectable()
export class TodoTimezoneRebaseProcessor implements OnModuleInit {
  readonly #logger = new Logger(TodoTimezoneRebaseProcessor.name);

  readonly #alert: OperationalAlertPort;
  readonly #runtime: JobRuntimePort;

  readonly #rebaseTodoTimezone: Pick<RebaseTodoTimezoneUseCase, "execute">;
  constructor(
    @Inject(RebaseTodoTimezoneUseCase)
    rebaseTodoTimezone: Pick<RebaseTodoTimezoneUseCase, "execute">,
    @Inject(OPERATIONAL_ALERT) alert: OperationalAlertPort,
    @Inject(JOB_RUNTIME) runtime: JobRuntimePort,
  ) {
    this.#rebaseTodoTimezone = rebaseTodoTimezone;
    this.#alert = alert;
    this.#runtime = runtime;
  }

  async onModuleInit(): Promise<void> {
    await this.#runtime.work(
      TODO_TIMEZONE_REBASE_QUEUE,
      async (jobs) => {
        for (const job of jobs) {
          await this.process(job.data, job.attempt);
        }
      },
      { ...TODO_TIMEZONE_REBASE_WORKER_POLICY, queuePolicy: TODO_TIMEZONE_REBASE_JOB_POLICY },
    );
  }

  async process(untrustedJob: unknown, attempt: number): Promise<void> {
    const parsed = todoTimezoneRebaseJobSchema.safeParse(untrustedJob);
    if (!parsed.success) {
      this.#logger.warn({ event: TodoLogEvent.TIMEZONE_REBASE_INVALID });
      return;
    }
    const { userId } = parsed.data.data;
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
      if (attempt > TODO_TIMEZONE_REBASE_JOB_POLICY.retryLimit) {
        // 재시도가 끝났다. 알림이 옛 시각으로 울리므로 사람이 봐야 한다.
        this.#alert.raise({
          key: TodoAlertKey.TIMEZONE_REBASE_FAILED,
          severity: "error",
          message: "할 일 시간대 재계산이 재시도 뒤에도 실패했습니다.",
          details: { userId, attempt, errorType },
        });
      }
      throw error;
    }
  }
}
