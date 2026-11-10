import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { ActionPlanLogEvent } from "../../application/action-plans.log-events.js";
import { PurgePlanApplicationsUseCase } from "../../application/use-cases/purge-plan-applications.use-case.js";
import { PLAN_APPLICATION_CLEANUP_QUEUE } from "./plan-application-cleanup.queue.js";

@Injectable()
export class PlanApplicationCleanupProcessor implements OnModuleInit {
  readonly #logger = new Logger(PlanApplicationCleanupProcessor.name);

  readonly #purgePlanApplications: Pick<PurgePlanApplicationsUseCase, "execute">;
  readonly #jobQueue: JobQueuePort;

  constructor(purgePlanApplications: PurgePlanApplicationsUseCase, jobQueue: JobQueuePort) {
    this.#purgePlanApplications = purgePlanApplications;
    this.#jobQueue = jobQueue;
  }

  async onModuleInit(): Promise<void> {
    await this.#jobQueue.work(PLAN_APPLICATION_CLEANUP_QUEUE, async () => this.process());
  }

  async process(): Promise<void> {
    try {
      await this.#purgePlanApplications.execute();
    } catch (error) {
      this.#logger.error({
        event: ActionPlanLogEvent.PLAN_APPLICATION_PURGE_FAILED,
        errorType: toErrorType(error),
      });
      throw error;
    }
  }
}
