import { calculateRemainingLimit } from "#api/modules/access/entitlements/access-entitlements.public";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { dailySendWindowAt } from "../../../shared/domain/daily-send-window.domain-service.js";
import type { NudgeLimitReaderPort } from "../ports/nudge-limit.reader.port.js";
import type { NudgeRepositoryPort } from "../ports/nudge.repository.port.js";
import type { NudgeDailyLimitReadModel } from "../read-models/nudge.read-model.js";

export interface GetNudgeLimitQuery {
  readonly userId: string;
  readonly timezone: string;
}

export interface GetNudgeLimitDependencies {
  readonly nudgeRepository: Pick<NudgeRepositoryPort, "countSentBetween">;
  readonly limitReader: Pick<NudgeLimitReaderPort, "readLimit">;
  readonly clock: ClockPort;
}

export class GetNudgeLimitUseCase {
  readonly #dependencies: GetNudgeLimitDependencies;

  constructor(dependencies: GetNudgeLimitDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetNudgeLimitQuery): Promise<NudgeDailyLimitReadModel> {
    const { nudgeRepository, limitReader, clock } = this.#dependencies;
    const userId = UserId.reconstitute(query.userId);
    const window = dailySendWindowAt({ now: clock.now(), timeZone: query.timezone });
    const [dailyLimit, used] = await Promise.all([
      limitReader.readLimit(userId),
      nudgeRepository.countSentBetween(userId, window),
    ]);
    return { dailyLimit, used, remaining: calculateRemainingLimit(dailyLimit, used) };
  }
}
