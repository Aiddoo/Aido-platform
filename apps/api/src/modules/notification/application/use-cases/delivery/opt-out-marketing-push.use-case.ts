import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import { type MarketingPushOptOutTokenPort } from "../../ports/delivery/marketing-push-opt-out-token.port.js";
import { type UserNotificationSettingsPort } from "../../ports/delivery/user-notification-settings.port.js";

interface OptOutMarketingPushDependencies {
  readonly tokens: MarketingPushOptOutTokenPort;
  readonly settings: UserNotificationSettingsPort;
  readonly logger: ApplicationLogger;
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
    this.#dependencies.logger.log(`Marketing push opted out: userId=${userId}`);
    return true;
  }
}
