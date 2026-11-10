import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { SendCooldown } from "../../../shared/domain/send-cooldown.domain-service.js";
import { evaluateCheerCooldown } from "../../domain/cheer-cooldown.domain-service.js";
import type { CheerRepositoryPort } from "../ports/cheer.repository.port.js";

export interface GetCheerCooldownQuery {
  readonly senderId: string;
  readonly receiverId: string;
}

export interface GetCheerCooldownDependencies {
  readonly cheerRepository: Pick<CheerRepositoryPort, "findLastSent">;
  readonly clock: ClockPort;
}

export class GetCheerCooldownUseCase {
  readonly #dependencies: GetCheerCooldownDependencies;

  constructor(dependencies: GetCheerCooldownDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetCheerCooldownQuery): Promise<SendCooldown> {
    const { cheerRepository, clock } = this.#dependencies;
    const lastCheer = await cheerRepository.findLastSent(
      UserId.reconstitute(query.senderId),
      UserId.reconstitute(query.receiverId),
    );
    return evaluateCheerCooldown({ lastSentAt: lastCheer?.createdAt ?? null, now: clock.now() });
  }
}
