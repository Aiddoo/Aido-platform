import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { runInBackground } from "#api/platform/jobs/non-blocking-init";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import { TodoSeriesLogEvent } from "../../application/todo-series.log-events.js";
import {
  TODO_SERIES_MATERIALIZATION_PAYLOAD,
  TODO_SERIES_MATERIALIZATION_QUEUE,
  TODO_SERIES_MATERIALIZATION_SCHEDULE_TIME,
  TodoSeriesMaterializationJobKey,
} from "./todo-series-materialization.queue.js";

@Injectable()
export class TodoSeriesMaterializationScheduler implements OnModuleInit {
  readonly #logger = new Logger(TodoSeriesMaterializationScheduler.name);
  readonly #jobQueue: JobQueuePort;
  readonly #clock: ClockPort;
  schedulerRegistration: Promise<void> = Promise.resolve();

  constructor(jobQueue: JobQueuePort, clock: ClockPort) {
    this.#jobQueue = jobQueue;
    this.#clock = clock;
  }

  onModuleInit(): void {
    // Queue 장애가 API 부팅을 막지 않도록 등록 완료를 백그라운드에서 기다린다.
    this.schedulerRegistration = runInBackground(
      this.#logger,
      "Todo series materialization scheduler registration",
      async () => {
        await this.#jobQueue.registerSchedules(TODO_SERIES_MATERIALIZATION_QUEUE);
        this.#logger.log({ event: TodoSeriesLogEvent.MATERIALIZE_SCHEDULER_REGISTERED });
        await this.#catchUpIfNeeded();
      },
    );
  }

  /** missed: once를 몰랐던 옛 스케줄 행에서 놓친 오늘 실행도 실행일 키로 하루 한 번만 따라잡는다. */
  async #catchUpIfNeeded(): Promise<void> {
    const { timezone, hour, minute } = TODO_SERIES_MATERIALIZATION_SCHEDULE_TIME;
    const currentTime = this.#clock.now().toZonedDateTimeISO(timezone);
    if (currentTime.hour * 60 + currentTime.minute < hour * 60 + minute) {
      return;
    }

    const localDate = currentTime.toPlainDate().toString();
    await this.#jobQueue.enqueue(
      TODO_SERIES_MATERIALIZATION_QUEUE,
      TODO_SERIES_MATERIALIZATION_PAYLOAD,
      { idempotencyKey: TodoSeriesMaterializationJobKey.catchUp(localDate) },
    );
    this.#logger.log({
      event: TodoSeriesLogEvent.MATERIALIZE_CATCH_UP_DISPATCHED,
      localDate,
    });
  }
}
