import { clampPageSize, toCursorPage } from "#api/shared/application/cursor-page";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { CheerId } from "../../domain/cheer-id.vo.js";
import { CheerLogEvent } from "../cheers.log-events.js";
import type { CheerCountCachePort } from "../ports/cheer-count-cache.port.js";
import type { CheerReaderPort } from "../ports/cheer.reader.port.js";
import type { SentCheers } from "../read-models/cheer.read-model.js";

export interface GetSentCheersQuery {
  readonly userId: string;
  readonly cursor?: number;
  readonly size?: number;
}

export interface GetSentCheersDependencies {
  readonly cheerReader: Pick<CheerReaderPort, "listSent" | "countSent">;
  readonly countCache: Pick<CheerCountCachePort, "wrapSentCount">;
  readonly logger: Pick<ApplicationLoggerPort, "debug">;
}

export class GetSentCheersUseCase {
  readonly #dependencies: GetSentCheersDependencies;

  constructor(dependencies: GetSentCheersDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetSentCheersQuery): Promise<SentCheers> {
    const { cheerReader, countCache, logger } = this.#dependencies;
    const userId = UserId.reconstitute(query.userId);
    const size = clampPageSize(query.size);
    const [rows, totalCount] = await Promise.all([
      cheerReader.listSent({
        userId,
        afterCheerId: query.cursor == null ? null : CheerId.reconstitute(query.cursor),
        limit: size + 1,
      }),
      countCache.wrapSentCount(userId, () => cheerReader.countSent(userId)),
    ]);
    const page = toCursorPage({ rows, size, toCursor: (cheer) => cheer.id });
    logger.debug({
      event: CheerLogEvent.SENT_LISTED,
      userId: query.userId,
      count: page.items.length,
    });
    return { page, totalCount };
  }
}
