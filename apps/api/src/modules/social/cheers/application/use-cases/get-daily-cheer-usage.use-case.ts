import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantToDate } from "#api/shared/domain/time/instant";

import type { DailySendUsage } from "../../../shared/application/ports/daily-send-usage.reader.port.js";
import { dailySendWindowAt } from "../../../shared/domain/daily-send-window.domain-service.js";
import type { CheerRepositoryPort } from "../ports/cheer.repository.port.js";

export interface GetDailyCheerUsageQuery {
  readonly userId: string;
  readonly timezone: string;
}

export interface GetDailyCheerUsageDependencies {
  readonly cheerRepository: Pick<CheerRepositoryPort, "countSentBetween">;
  readonly clock: ClockPort;
}

// 보내기 한도 검사와 같은 요청 시간대 하루를 센다. identity가 읽는 공개 모양이라 resetsAt은 Date다
export class GetDailyCheerUsageUseCase {
  readonly #dependencies: GetDailyCheerUsageDependencies;

  constructor(dependencies: GetDailyCheerUsageDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetDailyCheerUsageQuery): Promise<DailySendUsage> {
    const { cheerRepository, clock } = this.#dependencies;
    const window = dailySendWindowAt({ now: clock.now(), timeZone: query.timezone });
    const used = await cheerRepository.countSentBetween(UserId.reconstitute(query.userId), window);
    return { used, resetsAt: instantToDate(window.endsAt) };
  }
}
