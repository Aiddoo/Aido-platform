import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { JOB_POLLING_SECONDS } from "#api/shared/application/ports/index";
import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { now } from "#api/shared/domain/date/utils/core";

import { NotificationDeliveryLogEvent } from "../../../application/observability/delivery/notification-delivery-log.events.js";
import { ReconfirmMarketingConsents } from "../../../application/use-cases/delivery/reconfirm-marketing-consents.use-case.js";
import {
  MARKETING_CONSENT_RECONFIRM_JOB_OPTIONS,
  MARKETING_CONSENT_RECONFIRM_QUEUE,
} from "./marketing-consent-reconfirm-queue.constants.js";

@Injectable()
export class MarketingConsentReconfirmProcessor implements OnModuleInit {
  readonly #logger = new Logger(MarketingConsentReconfirmProcessor.name);

  constructor(
    @Inject(ReconfirmMarketingConsents)
    private readonly reconfirmMarketingConsents: Pick<ReconfirmMarketingConsents, "execute">,
    @Inject(JOB_RUNTIME) private readonly runtime: JobRuntimePort,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.runtime.work(MARKETING_CONSENT_RECONFIRM_QUEUE, async () => this.process(), {
      teamSize: 1,
      pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND,
      queuePolicy: MARKETING_CONSENT_RECONFIRM_JOB_OPTIONS,
    });
  }

  async process(): Promise<void> {
    try {
      await this.reconfirmMarketingConsents.execute({ now: now() });
    } catch (error) {
      this.#logger.error({
        event: NotificationDeliveryLogEvent.MARKETING_CONSENT_RECONFIRM_JOB_FAILED,
        errorType: toErrorType(error),
      });
      throw error;
    }
  }
}
