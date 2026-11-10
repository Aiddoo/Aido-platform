import {
  calculateRemainingLimit,
  type EntitlementReaderPort,
} from "#api/modules/access/access-entitlement.public";
import { now } from "#api/shared/domain/date/utils/core";
import { dayWindowInTimezone } from "#api/shared/domain/date/utils/timezone";

import type { CheerRepositoryPort } from "../ports/cheer.repository.port.js";
import type { CheerLimitSnapshot } from "../read-models/cheer.read-model.js";

interface GetCheerLimitDependencies {
  readonly cheerRepository: Pick<CheerRepositoryPort, "countSentSince">;
  readonly entitlementReader: Pick<EntitlementReaderPort, "getLimit">;
}

export class GetCheerLimitUseCase {
  readonly #dependencies: GetCheerLimitDependencies;

  constructor(dependencies: GetCheerLimitDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: {
    readonly userId: string;
    readonly timezone: string;
  }): Promise<CheerLimitSnapshot> {
    const window = dayWindowInTimezone(now(), input.timezone);
    const [dailyLimit, used] = await Promise.all([
      this.#dependencies.entitlementReader.getLimit(input.userId, "CHEER"),
      this.#dependencies.cheerRepository.countSentSince(
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
