import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { JOB_POLLING_SECONDS } from "#api/shared/application/ports/index";
import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { PurgePlanApplicationsUseCase } from "../../application/use-cases/purge-plan-applications.use-case.js";
import { VoiceLogEvent } from "../../application/voice.log-events.js";
import { PLAN_APPLICATION_CLEANUP_QUEUE } from "./plan-application-cleanup.queue.js";

@Injectable()
export class PlanApplicationCleanupProcessor implements OnModuleInit {
  readonly #logger = new Logger(PlanApplicationCleanupProcessor.name);

  readonly #purgePlanApplications: Pick<PurgePlanApplicationsUseCase, "execute">;
  readonly #runtime: JobRuntimePort;

  constructor(
    @Inject(PurgePlanApplicationsUseCase)
    purgePlanApplications: Pick<PurgePlanApplicationsUseCase, "execute">,
    @Inject(JOB_RUNTIME) runtime: JobRuntimePort,
  ) {
    this.#purgePlanApplications = purgePlanApplications;
    this.#runtime = runtime;
  }

  async onModuleInit(): Promise<void> {
    await this.#runtime.work(PLAN_APPLICATION_CLEANUP_QUEUE, async () => this.process(), {
      teamSize: 1,
      pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND,
    });
  }

  async process(): Promise<void> {
    try {
      await this.#purgePlanApplications.execute();
    } catch (error) {
      this.#logger.error({
        event: VoiceLogEvent.PLAN_APPLICATION_PURGE_FAILED,
        errorType: toErrorType(error),
      });
      throw error;
    }
  }
}
