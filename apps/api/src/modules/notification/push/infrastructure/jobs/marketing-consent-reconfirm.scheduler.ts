import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { runInBackground } from "#api/platform/jobs/non-blocking-init";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import { NotificationDeliveryLogEvent } from "../../application/notification-delivery.log-events.js";
import { MARKETING_CONSENT_RECONFIRM_QUEUE } from "./marketing-consent-reconfirm.queue.js";

@Injectable()
export class MarketingConsentReconfirmScheduler implements OnModuleInit {
  readonly #logger = new Logger(MarketingConsentReconfirmScheduler.name);
  schedulerRegistration: Promise<void> = Promise.resolve();

  readonly #jobQueue: JobQueuePort;

  constructor(jobQueue: JobQueuePort) {
    this.#jobQueue = jobQueue;
  }

  onModuleInit(): void {
    this.schedulerRegistration = runInBackground(
      this.#logger,
      "Marketing consent reconfirm scheduler registration",
      async () => {
        await this.#jobQueue.registerSchedules(MARKETING_CONSENT_RECONFIRM_QUEUE);
        this.#logger.log({
          event: NotificationDeliveryLogEvent.MARKETING_CONSENT_RECONFIRM_SCHEDULER_REGISTERED,
        });
      },
    );
  }
}
