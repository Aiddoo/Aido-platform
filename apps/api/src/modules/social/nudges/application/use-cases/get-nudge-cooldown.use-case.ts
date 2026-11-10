import {
  evaluateNudgeCooldown,
  type NudgeCooldown,
} from "../../domain/nudge-cooldown.domain-service.js";
import type { NudgeRepositoryPort } from "../ports/nudge.repository.port.js";

interface GetNudgeCooldownDependencies {
  readonly nudgeRepository: Pick<NudgeRepositoryPort, "findLastNudgeToUser">;
}

export class GetNudgeCooldown {
  readonly #dependencies: GetNudgeCooldownDependencies;

  constructor(dependencies: GetNudgeCooldownDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: {
    readonly senderId: string;
    readonly receiverId: string;
  }): Promise<NudgeCooldown> {
    const last = await this.#dependencies.nudgeRepository.findLastNudgeToUser(
      input.senderId,
      input.receiverId,
    );
    return evaluateNudgeCooldown(last?.createdAt ?? null);
  }
}
