import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import { type CheerRepositoryPort } from "../../ports/cheers/cheer.repository.port.js";

export interface MarkManyCheersReadInput {
  userId: string;
  cheerIds: number[];
}

/**
 * 여러 응원 읽음 처리 use-case.
 * 수신자 소유 + 미읽음 조건으로 일괄 갱신하고 처리된 개수를 반환한다.
 */
interface MarkManyCheersReadDependencies {
  readonly cheerRepository: CheerRepositoryPort;
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
    this.#dependencies.logger.debug(`${count}건 응원 읽음 처리: user=${input.userId}`);
    return count;
  }
}
