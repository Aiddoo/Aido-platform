import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { SendCooldown } from "../../../shared/domain/send-cooldown.domain-service.js";
import { evaluateRemindNudgeCooldown } from "../../domain/nudge-cooldown.domain-service.js";
import type { NudgeRepositoryPort } from "../ports/nudge.repository.port.js";

export interface GetRemindNudgeCooldownQuery {
  readonly senderId: string;
  readonly receiverId: string;
}

export interface GetRemindNudgeCooldownDependencies {
  readonly nudgeRepository: Pick<NudgeRepositoryPort, "findLastReminderSentTo">;
  readonly clock: ClockPort;
}

export class GetRemindNudgeCooldownUseCase {
  readonly #dependencies: GetRemindNudgeCooldownDependencies;

  constructor(dependencies: GetRemindNudgeCooldownDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetRemindNudgeCooldownQuery): Promise<SendCooldown> {
    const { nudgeRepository, clock } = this.#dependencies;
    const lastReminder = await nudgeRepository.findLastReminderSentTo(
      UserId.reconstitute(query.senderId),
      UserId.reconstitute(query.receiverId),
    );
    return evaluateRemindNudgeCooldown({
      lastSentAt: lastReminder?.createdAt ?? null,
      now: clock.now(),
    });
  }
}
