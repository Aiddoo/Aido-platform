import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { AuthLogEvent } from "#api/modules/identity/auth/application/auth.log-events";
import { runInBackground } from "#api/platform/jobs/non-blocking-init";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";

import {
  ACCOUNT_PURGE_JOB_NAME,
  ACCOUNT_PURGE_JOB_OPTIONS,
  ACCOUNT_PURGE_QUEUE,
  ACCOUNT_PURGE_SCHEDULE,
  AccountPurgeJobKey,
} from "./account-purge.queue.js";

@Injectable()
export class AccountPurgeScheduler implements OnModuleInit {
  readonly #logger = new Logger(AccountPurgeScheduler.name);
  schedulerRegistration: Promise<void> = Promise.resolve();

  readonly #runtime: JobRuntimePort;
  readonly #clock: ClockPort;

  constructor(runtime: JobRuntimePort, clock: ClockPort) {
    this.#runtime = runtime;
    this.#clock = clock;
  }

  onModuleInit(): void {
    // Queue 장애가 API 부팅을 막지 않도록 등록 완료를 백그라운드에서 기다린다.
    this.schedulerRegistration = runInBackground(
      this.#logger,
      "Account purge scheduler registration",
      async () => {
        await this.#runtime.schedule(
          ACCOUNT_PURGE_SCHEDULE.id,
          ACCOUNT_PURGE_SCHEDULE.cron,
          ACCOUNT_PURGE_QUEUE,
          { name: ACCOUNT_PURGE_JOB_NAME, data: {} },
          ACCOUNT_PURGE_JOB_OPTIONS,
        );
        this.#logger.log({ event: AuthLogEvent.ACCOUNT_PURGE_SCHEDULER_REGISTERED });
        await this.#catchUpIfNeeded();
      },
    );
  }

  async #catchUpIfNeeded(): Promise<void> {
    const currentTime = this.#clock.now().toZonedDateTimeISO(ACCOUNT_PURGE_SCHEDULE.timezone);
    if (currentTime.hour < ACCOUNT_PURGE_SCHEDULE.catchUpHour) {
      return;
    }

    const localDate = currentTime.toPlainDate().toString();
    await this.#runtime.enqueue(
      ACCOUNT_PURGE_QUEUE,
      { name: ACCOUNT_PURGE_JOB_NAME, data: {} },
      { ...ACCOUNT_PURGE_JOB_OPTIONS, idempotencyKey: AccountPurgeJobKey.catchUp(localDate) },
    );
    this.#logger.log({ event: AuthLogEvent.ACCOUNT_PURGE_CATCH_UP_DISPATCHED, localDate });
  }
}
