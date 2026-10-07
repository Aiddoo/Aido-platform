import { Feature, type EntitlementReaderPort } from "#api/modules/access/access-entitlement.public";
import { now } from "#api/shared/domain/date/utils/core";
import { dayWindowInTimezone } from "#api/shared/domain/date/utils/timezone";

import type { CheerLimitSnapshot } from "../../models/cheers/cheer-read.models.js";
import type { CheerRepositoryPort } from "../../ports/cheers/cheer.repository.port.js";

interface GetCheerLimitDependencies {
  readonly cheerRepository: Pick<CheerRepositoryPort, "countSentSince">;
  readonly entitlementReader: Pick<EntitlementReaderPort, "getFeatureLimit" | "calculateRemaining">;
}

export class GetCheerLimit {
  readonly #dependencies: GetCheerLimitDependencies;

  constructor(dependencies: GetCheerLimitDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: {
    readonly userId: string;
    readonly timezone: string;
  }): Promise<CheerLimitSnapshot> {
    const window = dayWindowInTimezone(now(), input.timezone);
    const { dailyLimit } = await this.#dependencies.entitlementReader.getFeatureLimit(
      input.userId,
      Feature.CHEER,
    );
    const used = await this.#dependencies.cheerRepository.countSentSince(
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
