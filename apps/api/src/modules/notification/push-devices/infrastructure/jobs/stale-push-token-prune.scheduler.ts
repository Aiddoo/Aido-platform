import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { runInBackground } from "#api/platform/jobs/non-blocking-init";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import { PushDeviceLogEvent } from "../../application/push-devices.log-events.js";
import { STALE_PUSH_TOKEN_PRUNE_QUEUE } from "./stale-push-token-prune.queue.js";

@Injectable()
export class StalePushTokenPruneScheduler implements OnModuleInit {
  readonly #logger = new Logger(StalePushTokenPruneScheduler.name);
  schedulerRegistration: Promise<void> = Promise.resolve();

  readonly #jobQueue: JobQueuePort;

  constructor(jobQueue: JobQueuePort) {
    this.#jobQueue = jobQueue;
  }

  onModuleInit(): void {
    // Queue 장애가 API 부팅을 막지 않도록 등록 완료를 백그라운드에서 기다린다
    this.schedulerRegistration = runInBackground(
      this.#logger,
      "Stale push token prune scheduler registration",
      async () => {
        await this.#jobQueue.registerSchedules(STALE_PUSH_TOKEN_PRUNE_QUEUE);
        this.#logger.log({ event: PushDeviceLogEvent.STALE_PUSH_TOKEN_PRUNE_SCHEDULER_REGISTERED });
      },
    );
  }
}
