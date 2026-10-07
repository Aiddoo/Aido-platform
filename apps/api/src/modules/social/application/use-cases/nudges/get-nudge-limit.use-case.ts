import { Feature, type EntitlementReaderPort } from "#api/modules/access/access-entitlement.public";
import { now } from "#api/shared/domain/date/utils/core";
import { dayWindowInTimezone } from "#api/shared/domain/date/utils/timezone";

import type { NudgeLimitSnapshot } from "../../models/nudges/nudge-read.models.js";
import type { NudgeRepositoryPort } from "../../ports/nudges/nudge.repository.port.js";

interface GetNudgeLimitDependencies {
  readonly nudgeRepository: Pick<NudgeRepositoryPort, "countSentSince">;
  readonly entitlementReader: Pick<EntitlementReaderPort, "getFeatureLimit" | "calculateRemaining">;
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
    const { dailyLimit } = await this.#dependencies.entitlementReader.getFeatureLimit(
      input.userId,
      Feature.NUDGE,
    );
    const used = await this.#dependencies.nudgeRepository.countSentSince(
      input.userId,
      window.startsAt,
      window.endsAt,
    );
    return {
      dailyLimit,
      used,
      remaining: this.#dependencies.entitlementReader.calculateRemaining(dailyLimit, used),
    };
  }
}
