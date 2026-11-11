import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { ClockPort } from "#api/shared/application/ports/clock.port";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { NotificationDeliveryLogEvent } from "../../application/notification-delivery.log-events.js";
import { ReconfirmMarketingConsentsUseCase } from "../../application/use-cases/reconfirm-marketing-consents.use-case.js";
import { MARKETING_CONSENT_RECONFIRM_QUEUE } from "./marketing-consent-reconfirm.queue.js";

@Injectable()
export class MarketingConsentReconfirmProcessor implements OnModuleInit {
  readonly #logger = new Logger(MarketingConsentReconfirmProcessor.name);

  readonly #reconfirmMarketingConsents: Pick<ReconfirmMarketingConsentsUseCase, "execute">;
  readonly #jobQueue: JobQueuePort;
  readonly #clock: ClockPort;

  constructor(
    @Inject(ReconfirmMarketingConsentsUseCase)
    reconfirmMarketingConsents: Pick<ReconfirmMarketingConsentsUseCase, "execute">,
    jobQueue: JobQueuePort,
    clock: ClockPort,
  ) {
    this.#reconfirmMarketingConsents = reconfirmMarketingConsents;
    this.#jobQueue = jobQueue;
    this.#clock = clock;
  }

  async onModuleInit(): Promise<void> {
    await this.#jobQueue.work(MARKETING_CONSENT_RECONFIRM_QUEUE, async () => this.process());
  }

  async process(): Promise<void> {
    try {
      await this.#reconfirmMarketingConsents.execute({ now: this.#clock.now() });
    } catch (error) {
      this.#logger.error({
        event: NotificationDeliveryLogEvent.MARKETING_CONSENT_RECONFIRM_JOB_FAILED,
        errorType: toErrorType(error),
      });
      throw error;
    }
  }
}
