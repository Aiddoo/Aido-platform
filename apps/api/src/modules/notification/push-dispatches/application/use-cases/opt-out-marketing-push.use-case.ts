import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { instantToDate } from "#api/shared/domain/time/instant";

import type { UserNotificationSettingsPort } from "../../../shared/application/ports/user-notification-settings.port.js";
import type { MarketingPushOptOutTokenPort } from "../ports/marketing-push-opt-out-token.port.js";
import { PushDispatchLogEvent } from "../push-dispatches.log-events.js";

interface OptOutMarketingPushDependencies {
  readonly tokens: Pick<MarketingPushOptOutTokenPort, "verify">;
  readonly settings: Pick<UserNotificationSettingsPort, "updateMarketingPushConsent">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

export interface OptOutMarketingPushResult {
  // 토큰이 맞아 철회했는지. 응답에는 싣지 않는다
  readonly isOptedOut: boolean;
  // 결과 안내에 쓰는 처리 시각. 토큰 유효 여부와 상관없이 준다
  readonly processedAt: Date;
}

export class OptOutMarketingPushUseCase {
  readonly #dependencies: OptOutMarketingPushDependencies;

  constructor(dependencies: OptOutMarketingPushDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(token: string): Promise<OptOutMarketingPushResult> {
    const processedAt = instantToDate(this.#dependencies.clock.now());
    const userId = this.#dependencies.tokens.verify(token);
    if (userId == null) {
      return { isOptedOut: false, processedAt };
    }
    await this.#dependencies.settings.updateMarketingPushConsent(userId, false);
    this.#dependencies.logger.log({
      event: PushDispatchLogEvent.OPT_OUT_MARKETING_PUSH_OPTED_OUT,
      userId: userId.value,
    });
    return { isOptedOut: true, processedAt };
  }
}
