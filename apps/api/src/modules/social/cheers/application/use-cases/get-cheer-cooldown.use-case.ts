import {
  evaluateCheerCooldown,
  type CheerCooldown,
} from "../../domain/cheer-cooldown.domain-service.js";
import type { CheerRepositoryPort } from "../ports/cheer.repository.port.js";

interface GetCheerCooldownDependencies {
  readonly cheerRepository: Pick<CheerRepositoryPort, "findLastCheerToUser">;
}

export class GetCheerCooldownUseCase {
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
