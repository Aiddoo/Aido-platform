import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import { runInBackground } from "./non-blocking-init.js";
import { SCHEDULE_WATCHDOG_QUEUE } from "./schedule-watchdog.queue.js";

@Injectable()
export class ScheduleWatchdogScheduler implements OnModuleInit {
  readonly #logger = new Logger(ScheduleWatchdogScheduler.name);
  readonly #jobQueue: JobQueuePort;
  schedulerRegistration: Promise<void> = Promise.resolve();

  constructor(jobQueue: JobQueuePort) {
    this.#jobQueue = jobQueue;
  }

  onModuleInit(): void {
    // 작업 저장소 장애가 API 부팅을 막지 않도록 등록 완료를 백그라운드에서 기다린다
    this.schedulerRegistration = runInBackground(
      this.#logger,
      "Schedule watchdog registration",
      async () => this.#jobQueue.registerSchedules(SCHEDULE_WATCHDOG_QUEUE),
    );
  }
}
