import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { AuthLogEvent } from "#api/modules/identity/auth/application/auth.log-events";
import { PurgeDeletedAccountsUseCase } from "#api/modules/identity/users/application/use-cases/purge-deleted-accounts.use-case";
import { JOB_POLLING_SECONDS } from "#api/shared/application/ports/index";
import { JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";

import { ACCOUNT_PURGE_QUEUE, type AccountPurgeJobData } from "./account-purge.queue.js";

@Injectable()
export class AccountPurgeProcessor implements OnModuleInit {
  readonly #logger = new Logger(AccountPurgeProcessor.name);

  readonly #purgeDeletedAccounts: Pick<PurgeDeletedAccountsUseCase, "execute">;
  readonly #runtime: JobRuntimePort;

  constructor(
    @Inject(PurgeDeletedAccountsUseCase)
    purgeDeletedAccounts: Pick<PurgeDeletedAccountsUseCase, "execute">,
    runtime: JobRuntimePort,
  ) {
    this.#purgeDeletedAccounts = purgeDeletedAccounts;
    this.#runtime = runtime;
  }

  async onModuleInit(): Promise<void> {
    await this.#runtime.work(ACCOUNT_PURGE_QUEUE, async () => this.process(), {
      teamSize: 1,
      pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND,
    });
  }

  onFailed(job: { readonly id?: string; readonly name?: string } | undefined, error: Error): void {
    this.#logger.error(
      {
        event: AuthLogEvent.ACCOUNT_PURGE_JOB_FAILED,
        jobId: job?.id,
        jobName: job?.name,
        errorType: error.name,
      },
      error.stack,
    );
  }

  async process(_job?: { readonly data?: AccountPurgeJobData }): Promise<void> {
    this.#logger.debug({ event: AuthLogEvent.ACCOUNT_PURGE_JOB_STARTED });
    await this.#purgeDeletedAccounts.execute();
  }
}
