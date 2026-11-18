import { Injectable, type OnModuleInit } from "@nestjs/common";

import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import { PurgeExpiredIdentityRecordsUseCase } from "../../application/use-cases/purge-expired-identity-records.use-case.js";
import { EXPIRED_RECORD_PURGE_QUEUE } from "./expired-record-purge.queue.js";

@Injectable()
export class ExpiredRecordPurgeProcessor implements OnModuleInit {
  readonly #purgeExpiredIdentityRecords: Pick<PurgeExpiredIdentityRecordsUseCase, "execute">;
  readonly #jobQueue: Pick<JobQueuePort, "work">;

  constructor(
    purgeExpiredIdentityRecords: PurgeExpiredIdentityRecordsUseCase,
    jobQueue: JobQueuePort,
  ) {
    this.#purgeExpiredIdentityRecords = purgeExpiredIdentityRecords;
    this.#jobQueue = jobQueue;
  }

  async onModuleInit(): Promise<void> {
    await this.#jobQueue.work(EXPIRED_RECORD_PURGE_QUEUE, async () =>
      this.#purgeExpiredIdentityRecords.execute(),
    );
  }
}
