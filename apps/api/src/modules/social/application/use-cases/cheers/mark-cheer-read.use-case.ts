import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { type CheerRepositoryPort } from "../../ports/cheers/cheer.repository.port.js";

export interface MarkCheerReadInput {
  userId: string;
  cheerId: number;
}

/**
 * 응원 읽음 처리 use-case.
 * 수신자 소유 검증 후 미읽음 응원을 읽음 처리한다(이미 읽음이면 no-op).
 */
interface MarkCheerReadDependencies {
  readonly cheerRepository: CheerRepositoryPort;
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
    if (!cheer?.isReceivedBy(userId)) {
      throw new ApplicationException(ErrorCode.CHEER_1205, { cheerId });
    }
    if (cheer.isRead()) {
      return;
    }

    await this.#dependencies.cheerRepository.markAsRead(cheerId);
    this.#dependencies.logger.debug(`Cheer 읽음 처리: id=${cheerId}`);
  }
}
