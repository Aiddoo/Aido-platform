import { now } from "#api/shared/domain/date/utils/core";
import { dayWindowInTimezone } from "#api/shared/domain/date/utils/timezone";

import type {
  DailySendUsage,
  DailySendUsageReaderPort,
} from "../../ports/quotas/daily-send-usage-reader.port.js";

interface DailySendUsageReaderDependencies {
  readonly sentCounter: {
    countSentSince(senderId: string, since: Date, untilExclusive: Date): Promise<number>;
  };
}

export class DailySendUsageReader implements DailySendUsageReaderPort {
  readonly #dependencies: DailySendUsageReaderDependencies;

  constructor(dependencies: DailySendUsageReaderDependencies) {
    this.#dependencies = dependencies;
  }

  async readDailyUsage(userId: string, timezone: string): Promise<DailySendUsage> {
    const window = dayWindowInTimezone(now(), timezone);
    const used = await this.#dependencies.sentCounter.countSentSince(
      userId,
      window.startsAt,
      window.endsAt,
    );
    return { used, resetsAt: window.endsAt };
  }
}
