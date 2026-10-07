import {
  evaluateCheerCooldown,
  type CheerCooldown,
} from "../../../domain/policies/cheers/cheer-cooldown.policy.js";
import type { CheerRepositoryPort } from "../../ports/cheers/cheer.repository.port.js";

interface GetCheerCooldownDependencies {
  readonly cheerRepository: Pick<CheerRepositoryPort, "findLastCheerToUser">;
}

export class GetCheerCooldown {
  readonly #dependencies: GetCheerCooldownDependencies;

  constructor(dependencies: GetCheerCooldownDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: {
    readonly senderId: string;
    readonly receiverId: string;
  }): Promise<CheerCooldown> {
    const last = await this.#dependencies.cheerRepository.findLastCheerToUser(
      input.senderId,
      input.receiverId,
    );
    return evaluateCheerCooldown(last?.createdAt ?? null);
  }
}
