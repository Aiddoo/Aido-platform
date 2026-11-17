import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import { match, P } from "ts-pattern";
import type { z } from "zod";

import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import { ProcessRetentionStagesUseCase } from "../../application/use-cases/process-retention-stages.use-case.js";
import {
  RETENTION_QUEUE,
  RETIRED_RETENTION_JOB_NAMES,
  RetentionJobName,
} from "./retention.queue.js";

type RetentionJob = z.output<typeof RETENTION_QUEUE.payloadSchema>;

@Injectable()
export class RetentionQueueProcessor implements OnModuleInit {
  readonly #processStages: Pick<ProcessRetentionStagesUseCase, "execute">;
  readonly #jobQueue: JobQueuePort;

  constructor(
    @Inject(ProcessRetentionStagesUseCase)
    processStages: Pick<ProcessRetentionStagesUseCase, "execute">,
    jobQueue: JobQueuePort,
  ) {
    this.#processStages = processStages;
    this.#jobQueue = jobQueue;
  }

  async onModuleInit(): Promise<void> {
    await this.#jobQueue.work(RETENTION_QUEUE, async (jobs) => {
      for (const job of jobs) {
        await this.process(job.data);
      }
    });
  }

  async process(job: RetentionJob): Promise<void> {
    await match(job)
      .with({ name: RetentionJobName.STAGE_SWEEP }, () => this.#processStages.execute())
      .with({ name: P.union(...RETIRED_RETENTION_JOB_NAMES) }, async () => undefined)
      .exhaustive();
  }
}
