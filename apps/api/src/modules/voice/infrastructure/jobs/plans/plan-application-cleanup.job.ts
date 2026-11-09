import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { runInBackground } from "#api/platform/jobs/non-blocking-init";
import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";

import { VoiceLogEvent } from "../../../application/observability/plans/voice-log.events.js";
import {
  PLAN_APPLICATION_CLEANUP_JOB_NAME,
  PLAN_APPLICATION_CLEANUP_JOB_OPTIONS,
  PLAN_APPLICATION_CLEANUP_QUEUE,
  PLAN_APPLICATION_CLEANUP_SCHEDULE,
} from "./plan-application-cleanup-queue.constants.js";

@Injectable()
export class PlanApplicationCleanupJob implements OnModuleInit {
  readonly #logger = new Logger(PlanApplicationCleanupJob.name);
  schedulerRegistration: Promise<void> = Promise.resolve();

  constructor(@Inject(JOB_RUNTIME) private readonly runtime: JobRuntimePort) {}

  onModuleInit(): void {
    // Queue 장애가 API 부팅을 막지 않도록 등록 완료를 백그라운드에서 기다린다.
    this.schedulerRegistration = runInBackground(
      this.#logger,
      "Plan application cleanup scheduler registration",
      async () => {
        await this.runtime.schedule(
          PLAN_APPLICATION_CLEANUP_SCHEDULE.id,
          PLAN_APPLICATION_CLEANUP_SCHEDULE.cron,
          PLAN_APPLICATION_CLEANUP_QUEUE,
          { name: PLAN_APPLICATION_CLEANUP_JOB_NAME, data: {} },
          PLAN_APPLICATION_CLEANUP_JOB_OPTIONS,
        );
        this.#logger.log({ event: VoiceLogEvent.PLAN_CLEANUP_SCHEDULER_REGISTERED });
      },
    );
  }
}
