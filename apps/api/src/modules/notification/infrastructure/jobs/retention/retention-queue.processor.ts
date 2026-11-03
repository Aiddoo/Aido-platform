import { Inject, Injectable, Logger, type OnModuleInit, Optional } from "@nestjs/common";
import { match } from "ts-pattern";

import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";

import { ProcessRetentionStages } from "../../../application/use-cases/retention/process-retention-stages.use-case.js";
import { NotificationProviderLogEvent } from "../../observability/delivery/notification-provider-log.events.js";
import {
  RETENTION_QUEUE,
  RETENTION_WORKER_POLICY,
  RetentionJobName,
  RetentionRuntimeJobSchema,
} from "./retention-queue.constants.js";

@Injectable()
export class RetentionQueueProcessor implements OnModuleInit {
  readonly #logger = new Logger(RetentionQueueProcessor.name);

  constructor(
    private readonly processStages: ProcessRetentionStages,
    @Optional()
    @Inject(JOB_RUNTIME)
    private readonly runtime?: JobRuntimePort,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.runtime) {
      return;
    }
    await this.runtime.work(
      RETENTION_QUEUE,
      async (jobs) => {
        for (const job of jobs) {
          await this.process(job.data);
        }
      },
      RETENTION_WORKER_POLICY,
    );
  }

  /** 이전 배포가 남긴 발송·relay 작업은 공용 outbox로 옮겨졌으므로 기록만 하고 완료한다. */
  async process(untrustedJob: unknown): Promise<void> {
    const parsedJob = RetentionRuntimeJobSchema.safeParse(untrustedJob);
    if (!parsedJob.success) {
      this.#logger.warn({ event: NotificationProviderLogEvent.JOB_INVALID });
      return;
    }
    await match(parsedJob.data)
      .with({ name: RetentionJobName.STAGE_SWEEP }, () => this.processStages.execute())
      .exhaustive();
  }
}
