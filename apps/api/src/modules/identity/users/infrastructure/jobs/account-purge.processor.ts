import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { AuthLogEvent } from "#api/modules/identity/auth/application/auth.log-events";
import { PurgeDeletedAccountsUseCase } from "#api/modules/identity/users/application/use-cases/purge-deleted-accounts.use-case";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import { ACCOUNT_PURGE_QUEUE } from "./account-purge.queue.js";

@Injectable()
export class AccountPurgeProcessor implements OnModuleInit {
  readonly #logger = new Logger(AccountPurgeProcessor.name);

  readonly #purgeDeletedAccounts: Pick<PurgeDeletedAccountsUseCase, "execute">;
  readonly #jobQueue: Pick<JobQueuePort, "work">;

  constructor(
    @Inject(PurgeDeletedAccountsUseCase)
    purgeDeletedAccounts: Pick<PurgeDeletedAccountsUseCase, "execute">,
    jobQueue: JobQueuePort,
  ) {
    this.#purgeDeletedAccounts = purgeDeletedAccounts;
    this.#jobQueue = jobQueue;
  }

  async onModuleInit(): Promise<void> {
    await this.#jobQueue.work(ACCOUNT_PURGE_QUEUE, async () => this.process());
  }

  async process(): Promise<void> {
    this.#logger.debug({ event: AuthLogEvent.ACCOUNT_PURGE_JOB_STARTED });
    await this.#purgeDeletedAccounts.execute();
  }
}
