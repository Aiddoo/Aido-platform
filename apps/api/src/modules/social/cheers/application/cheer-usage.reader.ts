import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantToDate } from "#api/shared/domain/time/instant";

import { dailySendWindowAt } from "../../shared/domain/daily-send-window.domain-service.js";
import { CheerUsageReaderPort } from "./ports/cheer-usage.reader.port.js";
import type { CheerRepositoryPort } from "./ports/cheer.repository.port.js";
import type { DailySendUsage } from "./ports/daily-send-usage.reader.port.js";

export interface CheerUsageReaderDependencies {
  readonly cheerRepository: Pick<CheerRepositoryPort, "countSentBetween">;
  readonly clock: ClockPort;
}

export class CheerUsageReader extends CheerUsageReaderPort {
  readonly #dependencies: CheerUsageReaderDependencies;

  constructor(dependencies: CheerUsageReaderDependencies) {
    super();
    this.#dependencies = dependencies;
  }

  async readDailyUsage(userId: UserId, timezone: string): Promise<DailySendUsage> {
    const { cheerRepository, clock } = this.#dependencies;
    const window = dailySendWindowAt({ now: clock.now(), timeZone: timezone });
    const used = await cheerRepository.countSentBetween(userId, window);
    return { used, resetsAt: instantToDate(window.endsAt) };
  }
}
