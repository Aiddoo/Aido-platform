import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { runInBackground } from "#api/platform/jobs/non-blocking-init";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import { ActionPlanLogEvent } from "../../application/action-plans.log-events.js";
import { PLAN_APPLICATION_CLEANUP_QUEUE } from "./plan-application-cleanup.queue.js";

@Injectable()
export class PlanApplicationCleanupScheduler implements OnModuleInit {
  readonly #logger = new Logger(PlanApplicationCleanupScheduler.name);
  schedulerRegistration: Promise<void> = Promise.resolve();

  readonly #jobQueue: JobQueuePort;

  constructor(jobQueue: JobQueuePort) {
    this.#jobQueue = jobQueue;
  }

  onModuleInit(): void {
    // Queue 장애가 API 부팅을 막지 않도록 등록 완료를 백그라운드에서 기다린다.
    this.schedulerRegistration = runInBackground(
      this.#logger,
      "Plan application cleanup scheduler registration",
      async () => {
        await this.#jobQueue.registerSchedules(PLAN_APPLICATION_CLEANUP_QUEUE);
        this.#logger.log({ event: ActionPlanLogEvent.PLAN_CLEANUP_SCHEDULER_REGISTERED });
      },
    );
  }
}
