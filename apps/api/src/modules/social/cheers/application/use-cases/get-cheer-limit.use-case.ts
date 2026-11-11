import { calculateRemainingLimit } from "#api/modules/access/entitlements/access-entitlements.public";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { dailySendWindowAt } from "../../../shared/domain/daily-send-window.domain-service.js";
import type { CheerLimitReaderPort } from "../ports/cheer-limit.reader.port.js";
import type { CheerRepositoryPort } from "../ports/cheer.repository.port.js";
import type { CheerDailyLimit } from "../read-models/cheer.read-model.js";

export interface GetCheerLimitQuery {
  readonly userId: string;
  readonly timezone: string;
}

export interface GetCheerLimitDependencies {
  readonly cheerRepository: Pick<CheerRepositoryPort, "countSentBetween">;
  readonly limitReader: Pick<CheerLimitReaderPort, "readLimit">;
  readonly clock: ClockPort;
}

export class GetCheerLimitUseCase {
  readonly #dependencies: GetCheerLimitDependencies;

  constructor(dependencies: GetCheerLimitDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetCheerLimitQuery): Promise<CheerDailyLimit> {
    const { cheerRepository, limitReader, clock } = this.#dependencies;
    const userId = UserId.reconstitute(query.userId);
    const window = dailySendWindowAt({ now: clock.now(), timeZone: query.timezone });
    const [dailyLimit, used] = await Promise.all([
      limitReader.readLimit(userId),
      cheerRepository.countSentBetween(userId, window),
    ]);
    return { dailyLimit, used, remaining: calculateRemainingLimit(dailyLimit, used) };
  }
}
