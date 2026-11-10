import {
  evaluateRemindNudgeCooldown,
  type NudgeCooldown,
} from "../../domain/nudge-cooldown.domain-service.js";
import type { NudgeRepositoryPort } from "../ports/nudge.repository.port.js";

interface GetRemindNudgeCooldownDependencies {
  readonly nudgeRepository: Pick<NudgeRepositoryPort, "findLastRemindNudge">;
}

export class GetRemindNudgeCooldownUseCase {
  readonly #dependencies: GetRemindNudgeCooldownDependencies;

  constructor(dependencies: GetRemindNudgeCooldownDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: {
    readonly senderId: string;
    readonly receiverId: string;
  }): Promise<NudgeCooldown> {
    const last = await this.#dependencies.nudgeRepository.findLastRemindNudge(
      input.senderId,
      input.receiverId,
    );
    return evaluateRemindNudgeCooldown(last?.createdAt ?? null);
  }
}
