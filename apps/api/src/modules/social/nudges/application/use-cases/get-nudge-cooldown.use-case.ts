import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { SendCooldown } from "../../../shared/domain/send-cooldown.domain-service.js";
import { evaluateNudgeCooldown } from "../../domain/nudge-cooldown.domain-service.js";
import type { NudgeRepositoryPort } from "../ports/nudge.repository.port.js";

export interface GetNudgeCooldownQuery {
  readonly senderId: string;
  readonly receiverId: string;
}

export interface GetNudgeCooldownDependencies {
  readonly nudgeRepository: Pick<NudgeRepositoryPort, "findLastSentTo">;
  readonly clock: ClockPort;
}

// 실제 쿨다운은 할 일 단위지만 이 조회는 그 친구에게 마지막으로 보낸 콕을 기준으로 한다(출시 계약)
export class GetNudgeCooldownUseCase {
  readonly #dependencies: GetNudgeCooldownDependencies;

  constructor(dependencies: GetNudgeCooldownDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetNudgeCooldownQuery): Promise<SendCooldown> {
    const { nudgeRepository, clock } = this.#dependencies;
    const lastNudge = await nudgeRepository.findLastSentTo(
      UserId.reconstitute(query.senderId),
      UserId.reconstitute(query.receiverId),
    );
    return evaluateNudgeCooldown({ lastSentAt: lastNudge?.createdAt ?? null, now: clock.now() });
  }
}
