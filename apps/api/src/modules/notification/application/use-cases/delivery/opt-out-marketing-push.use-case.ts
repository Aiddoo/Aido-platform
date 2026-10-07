import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import { NotificationDeliveryLogEvent } from "../../observability/delivery/notification-delivery-log.events.js";
import { type MarketingPushOptOutTokenPort } from "../../ports/delivery/marketing-push-opt-out-token.port.js";
import { type UserNotificationSettingsPort } from "../../ports/delivery/user-notification-settings.port.js";

interface OptOutMarketingPushDependencies {
  readonly tokens: Pick<MarketingPushOptOutTokenPort, "verify">;
  readonly settings: Pick<UserNotificationSettingsPort, "updateMarketingPushConsent">;
  readonly logger: Pick<ApplicationLogger, "log">;
}

export class OptOutMarketingPush {
  readonly #dependencies: OptOutMarketingPushDependencies;

  constructor(dependencies: OptOutMarketingPushDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(token: string): Promise<boolean> {
    const userId = this.#dependencies.tokens.verify(token);
    if (!userId) return false;
    await this.#dependencies.settings.updateMarketingPushConsent(userId, false);
    this.#dependencies.logger.log({
      event: NotificationDeliveryLogEvent.OPT_OUT_MARKETING_PUSH_OPTED_OUT,
      userId,
    });
    return true;
  }
}
