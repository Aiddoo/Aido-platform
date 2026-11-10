import {
  calculateRemainingLimit,
  type EntitlementReaderPort,
} from "#api/modules/access/access-entitlement.public";
import { now } from "#api/shared/domain/date/utils/core";
import { dayWindowInTimezone } from "#api/shared/domain/date/utils/timezone";

import type { NudgeRepositoryPort } from "../ports/nudge.repository.port.js";
import type { NudgeLimitSnapshot } from "../read-models/nudge.read-model.js";

interface GetNudgeLimitDependencies {
  readonly nudgeRepository: Pick<NudgeRepositoryPort, "countSentSince">;
  readonly entitlementReader: Pick<EntitlementReaderPort, "getLimit">;
}

export class GetNudgeLimit {
  readonly #dependencies: GetNudgeLimitDependencies;

  constructor(dependencies: GetNudgeLimitDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: {
    readonly userId: string;
    readonly timezone: string;
  }): Promise<NudgeLimitSnapshot> {
    const window = dayWindowInTimezone(now(), input.timezone);
    const [dailyLimit, used] = await Promise.all([
      this.#dependencies.entitlementReader.getLimit(input.userId, "NUDGE"),
      this.#dependencies.nudgeRepository.countSentSince(
        input.userId,
        window.startsAt,
        window.endsAt,
      ),
    ]);
    return {
      dailyLimit,
      used,
      remaining: calculateRemainingLimit(dailyLimit, used),
    };
  }
}
