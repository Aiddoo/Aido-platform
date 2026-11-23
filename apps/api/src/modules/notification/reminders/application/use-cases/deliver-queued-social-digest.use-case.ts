import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";

import { timezoneContextAt } from "../../domain/local-clock.domain-service.js";
import { ReminderLogEvent } from "../reminders.log-events.js";
import type { SendSocialDigestUseCase } from "./send-social-digest.use-case.js";

export interface DeliverQueuedSocialDigestCommand {
  readonly timezone: string;
  readonly recipientUserIds: readonly string[];
}

interface DeliverQueuedSocialDigestDependencies {
  readonly clock: Pick<ClockPort, "now">;
  readonly socialDigest: Pick<SendSocialDigestUseCase, "execute">;
  readonly logger: Pick<ApplicationLoggerPort, "error">;
}

// 저녁 리마인더 90분 뒤 큐가 깨운 소셜 다이제스트를 그 리마인더를 받은 사람에게만 보낸다
export class DeliverQueuedSocialDigestUseCase {
  readonly #dependencies: DeliverQueuedSocialDigestDependencies;

  constructor(dependencies: DeliverQueuedSocialDigestDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(payload: DeliverQueuedSocialDigestCommand): Promise<void> {
    try {
      const timezoneContext = {
        ...timezoneContextAt(this.#dependencies.clock.now(), payload.timezone),
        localHour: 0,
        localMinute: 0,
      };
      await this.#dependencies.socialDigest.execute(timezoneContext, payload.recipientUserIds);
    } catch {
      this.#dependencies.logger.error({
        event: ReminderLogEvent.TIMEZONE_AWARE_REMINDER_DIGEST_FAILED,
        timezone: payload.timezone,
        errorType: "digest-execution",
      });
    }
  }
}
