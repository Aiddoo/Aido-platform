import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { IdentityLogEvent } from "#api/modules/identity/application/observability/auth/identity-log.events";
import { PurgeDeletedAccounts } from "#api/modules/identity/application/use-cases/auth/purge-deleted-accounts.use-case";
import { JOB_POLLING_SECONDS } from "#api/shared/application/ports/index";
import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";

import { ACCOUNT_PURGE_QUEUE, type AccountPurgeJobData } from "./account-purge-queue.constants.js";

@Injectable()
export class AccountPurgeProcessor implements OnModuleInit {
  readonly #logger = new Logger(AccountPurgeProcessor.name);

  constructor(
    @Inject(PurgeDeletedAccounts)
    private readonly purgeDeletedAccounts: Pick<PurgeDeletedAccounts, "execute">,
    @Inject(JOB_RUNTIME) private readonly runtime: JobRuntimePort,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.runtime.work(ACCOUNT_PURGE_QUEUE, async () => this.process(), {
      teamSize: 1,
      pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND,
    });
  }

  onFailed(job: { readonly id?: string; readonly name?: string } | undefined, error: Error): void {
    this.#logger.error(
      {
        event: IdentityLogEvent.ACCOUNT_PURGE_JOB_FAILED,
        jobId: job?.id,
        jobName: job?.name,
        errorType: error.name,
      },
      error.stack,
    );
  }

  async process(_job?: { readonly data?: AccountPurgeJobData }): Promise<void> {
    this.#logger.debug({ event: IdentityLogEvent.ACCOUNT_PURGE_JOB_STARTED });
    await this.purgeDeletedAccounts.execute();
  }
}
