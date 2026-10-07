import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { now } from "#api/shared/domain/date/utils/core";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { CheerLogEvent } from "../../observability/cheers/cheer-log.events.js";
import { type CheerRepositoryPort } from "../../ports/cheers/cheer.repository.port.js";

export interface MarkCheerReadInput {
  readonly userId: string;
  readonly cheerId: number;
}

interface MarkCheerReadDependencies {
  readonly cheerRepository: Pick<CheerRepositoryPort, "findById" | "saveRead">;
  readonly logger: ApplicationLogger;
}

export class MarkCheerRead {
  readonly #dependencies: MarkCheerReadDependencies;

  constructor(dependencies: MarkCheerReadDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: MarkCheerReadInput): Promise<void> {
    const { userId, cheerId } = input;

    const cheer = await this.#dependencies.cheerRepository.findById(cheerId);
    if (cheer === null || !cheer.isReceivedBy(userId)) {
      throw new ApplicationException(ErrorCode.CHEER_1205, { cheerId });
    }
    if (!cheer.markRead(now())) {
      return;
    }

    await this.#dependencies.cheerRepository.saveRead(cheer);
    this.#dependencies.logger.debug({ event: CheerLogEvent.READ, userId, cheerId });
  }
}
