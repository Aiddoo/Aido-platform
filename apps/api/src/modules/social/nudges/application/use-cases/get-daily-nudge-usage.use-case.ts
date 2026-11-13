import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { DailySendQuotaUsage } from "../../../shared/application/ports/daily-send-usage.reader.port.js";
import { dailySendWindowAt } from "../../../shared/domain/daily-send-window.domain-service.js";
import type { NudgeRepositoryPort } from "../ports/nudge.repository.port.js";

export interface GetDailyNudgeUsageQuery {
  readonly userId: string;
  readonly timezone: string;
}

export interface GetDailyNudgeUsageDependencies {
  readonly nudgeRepository: Pick<NudgeRepositoryPort, "countSentBetween">;
  readonly clock: ClockPort;
}

// 보내기 한도 검사와 같은 요청 시간대 하루에 보낸 콕 수와 다음 현지 자정이다
export class GetDailyNudgeUsageUseCase {
  readonly #dependencies: GetDailyNudgeUsageDependencies;

  constructor(dependencies: GetDailyNudgeUsageDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetDailyNudgeUsageQuery): Promise<DailySendQuotaUsage> {
    const { nudgeRepository, clock } = this.#dependencies;
    const window = dailySendWindowAt({ now: clock.now(), timeZone: query.timezone });
    const used = await nudgeRepository.countSentBetween(UserId.reconstitute(query.userId), window);
    return { used, resetsAt: window.endsAt };
  }
}
