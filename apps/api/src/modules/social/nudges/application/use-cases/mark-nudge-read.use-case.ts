import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { NudgeId } from "../../domain/nudge-id.vo.js";
import { nudgeNotFound } from "../nudges.errors.js";
import { NudgeLogEvent } from "../nudges.log-events.js";
import type { NudgeRepositoryPort } from "../ports/nudge.repository.port.js";

export interface MarkNudgeReadCommand {
  readonly userId: string;
  readonly nudgeId: number;
}

export interface MarkNudgeReadDependencies {
  readonly nudgeRepository: Pick<NudgeRepositoryPort, "findById" | "save">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "debug">;
}

export class MarkNudgeReadUseCase {
  readonly #dependencies: MarkNudgeReadDependencies;

  constructor(dependencies: MarkNudgeReadDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: MarkNudgeReadCommand): Promise<void> {
    const { nudgeRepository, clock, logger } = this.#dependencies;
    const nudgeId = NudgeId.reconstitute(command.nudgeId);
    const nudge = await nudgeRepository.findById(nudgeId);
    if (nudge == null || !nudge.isReceivedBy(UserId.reconstitute(command.userId))) {
      throw nudgeNotFound(nudgeId);
    }
    if (!nudge.markRead(clock.now())) {
      return;
    }

    await nudgeRepository.save(nudge);
    logger.debug({ event: NudgeLogEvent.READ, userId: command.userId, nudgeId: command.nudgeId });
  }
}
