import { Inject, Injectable, Logger, type OnModuleInit, Optional } from "@nestjs/common";

import { fromLegacyJob, type NamedJob } from "#api/platform/jobs/named-job";
import {
  JOB_RUNTIME,
  type JobData,
  type JobRuntimePort,
} from "#api/shared/application/ports/job-runtime.port";

import { DispatchRetentionPush } from "../../../application/use-cases/retention/dispatch-retention-push.use-case.js";
import { ProcessRetentionStages } from "../../../application/use-cases/retention/process-retention-stages.use-case.js";
import { RecoverFailedRetentionDelivery } from "../../../application/use-cases/retention/recover-failed-retention-delivery.use-case.js";
import { RelayRetentionOutbox } from "../../../application/use-cases/retention/relay-retention-outbox.use-case.js";
import {
  RETENTION_LEGACY_QUEUE,
  RETENTION_DEAD_LETTER_QUEUE,
  RETENTION_DEAD_LETTER_WORKER_POLICY,
  RETENTION_JOB_POLICY,
  RETENTION_QUEUE,
  RETENTION_WORKER_POLICY,
  type RetentionJobMap,
  RetentionJobName,
  RetentionDeadLetterJobSchema,
  RetentionRuntimeJobSchema,
} from "./retention-queue.constants.js";

type RetentionJob = NamedJob<RetentionJobMap>;
type RetentionJobLike = { readonly name: string; readonly data: JobData };

import { NotificationProviderLogEvent } from "../../observability/delivery/notification-provider-log.events.js";

@Injectable()
export class RetentionQueueProcessor implements OnModuleInit {
  readonly #logger = new Logger(RetentionQueueProcessor.name);

  constructor(
    private readonly processStages: ProcessRetentionStages,
    private readonly relayOutbox: RelayRetentionOutbox,
    private readonly dispatchPush: DispatchRetentionPush,
    private readonly recoverFailedDelivery: RecoverFailedRetentionDelivery,
    @Optional()
    @Inject(JOB_RUNTIME)
    private readonly runtime?: JobRuntimePort,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.runtime) return;
    await this.runtime.work<RetentionJob>(
      RETENTION_QUEUE,
      async (jobs) => {
        for (const job of jobs) await this.process(job.id, job.attempt, job.data);
      },
      RETENTION_WORKER_POLICY,
    );
    await this.runtime.work<JobData>(
      RETENTION_LEGACY_QUEUE,
      async (jobs) => {
        for (const job of jobs) {
          const legacy = fromLegacyJob<RetentionJobMap>(job);
          await this.process(job.id, job.attempt, legacy);
        }
      },
      RETENTION_WORKER_POLICY,
    );
    await this.runtime.work<JobData>(
      RETENTION_DEAD_LETTER_QUEUE,
      async (jobs) => {
        for (const job of jobs) {
          const failed = RetentionDeadLetterJobSchema.parse(job.data);
          await this.recoverFailedDelivery.execute(failed.data);
        }
      },
      RETENTION_DEAD_LETTER_WORKER_POLICY,
    );
  }

  async process(
    processingJobId: string,
    processingJobAttempt: number,
    untrustedJob: RetentionJobLike,
  ): Promise<void> {
    const parsedJob = RetentionRuntimeJobSchema.safeParse(untrustedJob);
    if (!parsedJob.success) {
      this.#logger.warn({ event: NotificationProviderLogEvent.JOB_INVALID });
      return;
    }
    const job = parsedJob.data;
    switch (job.name) {
      case RetentionJobName.STAGE_SWEEP:
        await this.processStages.execute();
        break;
      case RetentionJobName.OUTBOX_RELAY:
        await this.relayOutbox.execute();
        break;
      case RetentionJobName.DISPATCH:
        await this.dispatchPush.execute({
          ...job.data,
          processingJobId,
          processingJobAttempt,
          isFinalAttempt: processingJobAttempt > RETENTION_JOB_POLICY.retryLimit,
        });
        break;
      default: {
        const exhaustive: never = job;
        void exhaustive;
      }
    }
  }

  onFailed(job: { readonly id?: string; readonly name?: string } | undefined, _error: Error): void {
    this.#logger.error({ event: NotificationProviderLogEvent.JOB_FAILED, jobId: job?.id });
  }
}
