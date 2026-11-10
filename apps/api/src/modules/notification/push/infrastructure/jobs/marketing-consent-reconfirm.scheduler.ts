import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { runInBackground } from "#api/platform/jobs/non-blocking-init";
import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";

import { NotificationDeliveryLogEvent } from "../../application/notification-delivery.log-events.js";
import {
  MARKETING_CONSENT_RECONFIRM_JOB_NAME,
  MARKETING_CONSENT_RECONFIRM_JOB_OPTIONS,
  MARKETING_CONSENT_RECONFIRM_QUEUE,
  MARKETING_CONSENT_RECONFIRM_SCHEDULE,
} from "./marketing-consent-reconfirm-queue.constants.js";

@Injectable()
export class MarketingConsentReconfirmJob implements OnModuleInit {
  readonly #logger = new Logger(MarketingConsentReconfirmJob.name);
  schedulerRegistration: Promise<void> = Promise.resolve();

  readonly #runtime: JobRuntimePort;

  constructor(@Inject(JOB_RUNTIME) runtime: JobRuntimePort) {
    this.#runtime = runtime;
  }

  onModuleInit(): void {
    // 놓친 달은 다음 달 실행이 같은 조건(2년 지난 사용자)으로 이어 받으므로 보정 실행은 두지 않는다
    this.schedulerRegistration = runInBackground(
      this.#logger,
      "Marketing consent reconfirm scheduler registration",
      async () => {
        await this.#runtime.schedule(
          MARKETING_CONSENT_RECONFIRM_SCHEDULE.id,
          MARKETING_CONSENT_RECONFIRM_SCHEDULE.cron,
          MARKETING_CONSENT_RECONFIRM_QUEUE,
          { name: MARKETING_CONSENT_RECONFIRM_JOB_NAME, data: {} },
          MARKETING_CONSENT_RECONFIRM_JOB_OPTIONS,
        );
        this.#logger.log({
          event: NotificationDeliveryLogEvent.MARKETING_CONSENT_RECONFIRM_SCHEDULER_REGISTERED,
        });
      },
    );
  }
}
