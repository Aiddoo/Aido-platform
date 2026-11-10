import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { CheerId } from "../../domain/cheer-id.vo.js";
import { CheerLogEvent } from "../cheers.log-events.js";
import type { CheerRepositoryPort } from "../ports/cheer.repository.port.js";

export interface MarkManyCheersReadCommand {
  readonly userId: string;
  readonly cheerIds: readonly number[];
}

export interface MarkManyCheersReadDependencies {
  readonly cheerRepository: Pick<CheerRepositoryPort, "markManyRead">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "debug">;
}

export class MarkManyCheersReadUseCase {
  readonly #dependencies: MarkManyCheersReadDependencies;

  constructor(dependencies: MarkManyCheersReadDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: MarkManyCheersReadCommand): Promise<number> {
    const { cheerRepository, clock, logger } = this.#dependencies;
    const count = await cheerRepository.markManyRead({
      receiverId: UserId.reconstitute(command.userId),
      cheerIds: command.cheerIds.map((cheerId) => CheerId.reconstitute(cheerId)),
      now: clock.now(),
    });
    logger.debug({ event: CheerLogEvent.MANY_READ, userId: command.userId, count });
    return count;
  }
}
