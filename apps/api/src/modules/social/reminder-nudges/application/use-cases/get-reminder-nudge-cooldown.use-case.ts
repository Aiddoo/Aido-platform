import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { SendCooldown } from "../../../shared/domain/send-cooldown.domain-service.js";
import { evaluateReminderNudgeCooldown } from "../../domain/reminder-nudge-cooldown.domain-service.js";
import type { ReminderNudgeRepositoryPort } from "../ports/reminder-nudge.repository.port.js";

export interface GetReminderNudgeCooldownQuery {
  readonly senderId: string;
  readonly receiverId: string;
}

export interface GetReminderNudgeCooldownDependencies {
  readonly reminderNudgeRepository: Pick<ReminderNudgeRepositoryPort, "findLastSentTo">;
  readonly clock: ClockPort;
}

export class GetReminderNudgeCooldownUseCase {
  readonly #dependencies: GetReminderNudgeCooldownDependencies;

  constructor(dependencies: GetReminderNudgeCooldownDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetReminderNudgeCooldownQuery): Promise<SendCooldown> {
    const { reminderNudgeRepository, clock } = this.#dependencies;
    const lastReminder = await reminderNudgeRepository.findLastSentTo(
      UserId.reconstitute(query.senderId),
      UserId.reconstitute(query.receiverId),
    );
    return evaluateReminderNudgeCooldown({
      lastSentAt: lastReminder?.createdAt ?? null,
      now: clock.now(),
    });
  }
}
