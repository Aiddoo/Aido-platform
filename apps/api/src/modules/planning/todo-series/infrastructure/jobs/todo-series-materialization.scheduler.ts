import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import dayjs from "dayjs";

import { runInBackground } from "#api/platform/jobs/non-blocking-init";
import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";

import { TodoSeriesLogEvent } from "../../application/todo-series.log-events.js";
import {
  TODO_SERIES_MATERIALIZATION_JOB_NAME,
  TODO_SERIES_MATERIALIZATION_JOB_OPTIONS,
  TODO_SERIES_MATERIALIZATION_QUEUE,
  TODO_SERIES_MATERIALIZATION_SCHEDULE,
  TodoSeriesMaterializationJobKey,
} from "./todo-series-materialization.queue.js";

@Injectable()
export class TodoSeriesMaterializationJob implements OnModuleInit {
  readonly #logger = new Logger(TodoSeriesMaterializationJob.name);
  schedulerRegistration: Promise<void> = Promise.resolve();

  readonly #runtime: JobRuntimePort;

  constructor(@Inject(JOB_RUNTIME) runtime: JobRuntimePort) {
    this.#runtime = runtime;
  }

  onModuleInit(): void {
    // Queue 장애가 API 부팅을 막지 않도록 등록 완료를 백그라운드에서 기다린다.
    this.schedulerRegistration = runInBackground(
      this.#logger,
      "Todo series materialization scheduler registration",
      async () => {
        await this.#runtime.schedule(
          TODO_SERIES_MATERIALIZATION_SCHEDULE.id,
          TODO_SERIES_MATERIALIZATION_SCHEDULE.cron,
          TODO_SERIES_MATERIALIZATION_QUEUE,
          { name: TODO_SERIES_MATERIALIZATION_JOB_NAME, data: {} },
          TODO_SERIES_MATERIALIZATION_JOB_OPTIONS,
        );
        this.#logger.log({ event: TodoSeriesLogEvent.MATERIALIZE_SCHEDULER_REGISTERED });
        await this.#catchUpIfNeeded();
      },
    );
  }

  /** 배포·재시작으로 오늘 실행을 놓쳤어도 실행일 키로 하루 한 번만 따라잡는다. */
  async #catchUpIfNeeded(): Promise<void> {
    const { timezone, catchUpHour, catchUpMinute } = TODO_SERIES_MATERIALIZATION_SCHEDULE;
    const currentTime = dayjs().tz(timezone);
    if (currentTime.hour() * 60 + currentTime.minute() < catchUpHour * 60 + catchUpMinute) {
      return;
    }

    const localDate = currentTime.format("YYYY-MM-DD");
    await this.#runtime.enqueue(
      TODO_SERIES_MATERIALIZATION_QUEUE,
      { name: TODO_SERIES_MATERIALIZATION_JOB_NAME, data: {} },
      {
        ...TODO_SERIES_MATERIALIZATION_JOB_OPTIONS,
        idempotencyKey: TodoSeriesMaterializationJobKey.catchUp(localDate),
      },
    );
    this.#logger.log({
      event: TodoSeriesLogEvent.MATERIALIZE_CATCH_UP_DISPATCHED,
      localDate,
    });
  }
}
