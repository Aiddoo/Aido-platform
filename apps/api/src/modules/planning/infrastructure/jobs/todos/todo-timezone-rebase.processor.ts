import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";
import {
  OPERATIONAL_ALERT,
  type OperationalAlertPort,
} from "#api/shared/application/ports/operational-alert.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { PlanningTodoLogEvent } from "../../../application/observability/todos/planning-todo-log.events.js";
import { RebaseTodoTimezone } from "../../../application/use-cases/todos/rebase-todo-timezone.use-case.js";
import {
  TODO_TIMEZONE_REBASE_JOB_POLICY,
  TODO_TIMEZONE_REBASE_QUEUE,
  TODO_TIMEZONE_REBASE_WORKER_POLICY,
  todoTimezoneRebaseJobSchema,
} from "./todo-timezone-rebase-queue.constants.js";

export const TODO_TIMEZONE_REBASE_ALERT_KEY = "planning.todo-timezone-rebase-failed";

@Injectable()
export class TodoTimezoneRebaseProcessor implements OnModuleInit {
  readonly #logger = new Logger(TodoTimezoneRebaseProcessor.name);

  constructor(
    @Inject(RebaseTodoTimezone)
    private readonly rebaseTodoTimezone: Pick<RebaseTodoTimezone, "execute">,
    @Inject(OPERATIONAL_ALERT) private readonly alert: OperationalAlertPort,
    @Inject(JOB_RUNTIME) private readonly runtime: JobRuntimePort,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.runtime.work(
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
      this.#logger.warn({ event: PlanningTodoLogEvent.TIMEZONE_REBASE_INVALID });
      return;
    }
    const { userId } = parsed.data.data;
    try {
      await this.rebaseTodoTimezone.execute({ userId });
    } catch (error) {
      const errorType = toErrorType(error);
      this.#logger.warn({
        event: PlanningTodoLogEvent.TIMEZONE_REBASE_FAILED,
        userId,
        attempt,
        errorType,
      });
      if (attempt > TODO_TIMEZONE_REBASE_JOB_POLICY.retryLimit) {
        // 재시도가 끝났다. 알림이 옛 시각으로 울리므로 사람이 봐야 한다.
        this.alert.raise({
          key: TODO_TIMEZONE_REBASE_ALERT_KEY,
          severity: "error",
          message: "할 일 시간대 재계산이 재시도 뒤에도 실패했습니다.",
          details: { userId, attempt, errorType },
        });
      }
      throw error;
    }
  }
}
