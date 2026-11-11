import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantToDate } from "#api/shared/domain/time/instant";

import type { DailySendUsage } from "../../cheers/application/ports/daily-send-usage.reader.port.js";
import { dailySendWindowAt } from "../../shared/domain/daily-send-window.domain-service.js";
import { NudgeUsageReaderPort } from "./ports/nudge-usage.reader.port.js";
import type { NudgeRepositoryPort } from "./ports/nudge.repository.port.js";

export interface NudgeUsageReaderDependencies {
  readonly nudgeRepository: Pick<NudgeRepositoryPort, "countSentBetween">;
  readonly clock: ClockPort;
}

export class NudgeUsageReader extends NudgeUsageReaderPort {
  readonly #dependencies: NudgeUsageReaderDependencies;

  constructor(dependencies: NudgeUsageReaderDependencies) {
    super();
    this.#dependencies = dependencies;
  }

  async readDailyUsage(userId: UserId, timezone: string): Promise<DailySendUsage> {
    const { nudgeRepository, clock } = this.#dependencies;
    const window = dailySendWindowAt({ now: clock.now(), timeZone: timezone });
    const used = await nudgeRepository.countSentBetween(userId, window);
    return { used, resetsAt: instantToDate(window.endsAt) };
  }
}
