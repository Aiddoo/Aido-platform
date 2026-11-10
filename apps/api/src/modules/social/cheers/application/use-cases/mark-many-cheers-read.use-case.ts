import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";

import { CheerLogEvent } from "../cheers.log-events.js";
import { type CheerRepositoryPort } from "../ports/cheer.repository.port.js";

export interface MarkManyCheersReadInput {
  readonly userId: string;
  readonly cheerIds: number[];
}

interface MarkManyCheersReadDependencies {
  readonly cheerRepository: Pick<CheerRepositoryPort, "markManyAsRead">;
  readonly logger: ApplicationLoggerPort;
}

export class MarkManyCheersReadUseCase {
  readonly #dependencies: MarkManyCheersReadDependencies;

  constructor(dependencies: MarkManyCheersReadDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: MarkManyCheersReadInput): Promise<number> {
    const count = await this.#dependencies.cheerRepository.markManyAsRead(
      input.cheerIds,
      input.userId,
    );
    this.#dependencies.logger.debug({
      event: CheerLogEvent.MANY_READ,
      userId: input.userId,
      count,
    });
    return count;
  }
}
