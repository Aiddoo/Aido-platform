import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { CheerId } from "../../domain/cheer-id.vo.js";
import { cheerNotFound } from "../cheers.errors.js";
import { CheerLogEvent } from "../cheers.log-events.js";
import type { CheerCountCachePort } from "../ports/cheer-count-cache.port.js";
import type { CheerRepositoryPort } from "../ports/cheer.repository.port.js";

export interface MarkCheerReadCommand {
  readonly userId: string;
  readonly cheerId: number;
}

export interface MarkCheerReadDependencies {
  readonly cheerRepository: Pick<CheerRepositoryPort, "findById" | "save">;
  readonly countCache: Pick<CheerCountCachePort, "invalidate">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "debug">;
}

export class MarkCheerReadUseCase {
  readonly #dependencies: MarkCheerReadDependencies;

  constructor(dependencies: MarkCheerReadDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: MarkCheerReadCommand): Promise<void> {
    const { cheerRepository, clock, logger } = this.#dependencies;
    const cheerId = CheerId.reconstitute(command.cheerId);
    const cheer = await cheerRepository.findById(cheerId);
    if (cheer == null || !cheer.isReceivedBy(UserId.reconstitute(command.userId))) {
      throw cheerNotFound(cheerId);
    }
    if (!cheer.markRead(clock.now())) {
      return;
    }

    await cheerRepository.save(cheer);
    await this.#dependencies.countCache.invalidate([cheer.receiverId]);
    logger.debug({ event: CheerLogEvent.READ, userId: command.userId, cheerId: command.cheerId });
  }
}
