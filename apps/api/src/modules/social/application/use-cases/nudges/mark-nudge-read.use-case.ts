import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { now } from "#api/shared/domain/date/utils/core";

import { NudgeLogEvent } from "../../observability/nudges/nudge-log.events.js";
import { type NudgeRepositoryPort } from "../../ports/nudges/nudge.repository.port.js";

export interface MarkNudgeReadInput {
  readonly userId: string;
  readonly nudgeId: number;
}

interface MarkNudgeReadDependencies {
  readonly nudgeRepository: Pick<NudgeRepositoryPort, "findById" | "saveRead">;
  readonly logger: ApplicationLoggerPort;
}

export class MarkNudgeRead {
  readonly #dependencies: MarkNudgeReadDependencies;

  constructor(dependencies: MarkNudgeReadDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: MarkNudgeReadInput): Promise<void> {
    const { userId, nudgeId } = input;

    const nudge = await this.#dependencies.nudgeRepository.findById(nudgeId);
    if (nudge == null || !nudge.isReceivedBy(userId)) {
      throw new ApplicationException(ErrorCode.NUDGE_1105, { nudgeId });
    }
    if (!nudge.markRead(now())) {
      return;
    }

    await this.#dependencies.nudgeRepository.saveRead(nudge);
    this.#dependencies.logger.debug({ event: NudgeLogEvent.READ, userId, nudgeId });
  }
}
