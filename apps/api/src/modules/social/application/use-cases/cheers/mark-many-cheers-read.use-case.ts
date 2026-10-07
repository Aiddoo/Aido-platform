import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import { CheerLogEvent } from "../../observability/cheers/cheer-log.events.js";
import { type CheerRepositoryPort } from "../../ports/cheers/cheer.repository.port.js";

export interface MarkManyCheersReadInput {
  readonly userId: string;
  readonly cheerIds: number[];
}

interface MarkManyCheersReadDependencies {
  readonly cheerRepository: Pick<CheerRepositoryPort, "markManyAsRead">;
  readonly logger: ApplicationLogger;
}

export class MarkManyCheersRead {
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
