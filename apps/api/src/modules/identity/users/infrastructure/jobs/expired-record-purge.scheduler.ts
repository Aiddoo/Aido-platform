import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { runInBackground } from "#api/platform/jobs/non-blocking-init";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import { UserLogEvent } from "../../application/users.log-events.js";
import { EXPIRED_RECORD_PURGE_QUEUE } from "./expired-record-purge.queue.js";

@Injectable()
export class ExpiredRecordPurgeScheduler implements OnModuleInit {
  readonly #logger = new Logger(ExpiredRecordPurgeScheduler.name);
  schedulerRegistration: Promise<void> = Promise.resolve();

  readonly #jobQueue: Pick<JobQueuePort, "registerSchedules">;

  constructor(jobQueue: JobQueuePort) {
    this.#jobQueue = jobQueue;
  }

  onModuleInit(): void {
    // Queue 장애가 API 부팅을 막지 않도록 등록 완료를 백그라운드에서 기다린다.
    this.schedulerRegistration = runInBackground(
      this.#logger,
      "Expired identity record purge scheduler registration",
      async () => {
        await this.#jobQueue.registerSchedules(EXPIRED_RECORD_PURGE_QUEUE);
        this.#logger.log({ event: UserLogEvent.EXPIRED_RECORD_PURGE_SCHEDULER_REGISTERED });
      },
    );
  }
}
