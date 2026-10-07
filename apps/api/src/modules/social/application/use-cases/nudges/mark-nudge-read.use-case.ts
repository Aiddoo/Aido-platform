import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { now } from "#api/shared/domain/date/utils/core";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { type NudgeRepositoryPort } from "../../ports/nudges/nudge.repository.port.js";

export interface MarkNudgeReadInput {
  userId: string;
  nudgeId: number;
}

/**
 * 콕 찌르기 읽음 처리 use-case.
 * 수신자 소유 검증 후 미읽음 콕 찌르기를 읽음 처리한다(이미 읽음이면 no-op).
 */
interface MarkNudgeReadDependencies {
  readonly nudgeRepository: NudgeRepositoryPort;
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
    if (!nudge?.isReceivedBy(userId)) {
      throw new ApplicationException(ErrorCode.NUDGE_1105, { nudgeId });
    }
    if (!nudge.markRead(now())) {
      return;
    }

    await this.#dependencies.nudgeRepository.saveRead(nudge);
    this.#dependencies.logger.debug(`Nudge 읽음 처리: id=${nudgeId}`);
  }
}
