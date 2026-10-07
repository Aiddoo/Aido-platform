import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { now } from "#api/shared/domain/date/utils/core";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { NudgeLogEvent } from "../../observability/nudges/nudge-log.events.js";
import { type NudgeRepositoryPort } from "../../ports/nudges/nudge.repository.port.js";

export interface MarkNudgeReadInput {
  readonly userId: string;
  readonly nudgeId: number;
}

interface MarkNudgeReadDependencies {
  readonly nudgeRepository: Pick<NudgeRepositoryPort, "findById" | "saveRead">;
  readonly logger: ApplicationLogger;
}

export class MarkNudgeRead {
  readonly #dependencies: MarkNudgeReadDependencies;

  constructor(dependencies: MarkNudgeReadDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: MarkNudgeReadInput): Promise<void> {
    const { userId, nudgeId } = input;

    const nudge = await this.#dependencies.nudgeRepository.findById(nudgeId);
    if (nudge === null || !nudge.isReceivedBy(userId)) {
      throw new ApplicationException(ErrorCode.NUDGE_1105, { nudgeId });
    }
    if (!nudge.markRead(now())) {
      return;
    }

    await this.#dependencies.nudgeRepository.saveRead(nudge);
    this.#dependencies.logger.debug({ event: NudgeLogEvent.READ, userId, nudgeId });
  }
}
