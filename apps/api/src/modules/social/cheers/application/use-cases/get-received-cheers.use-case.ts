import { clampPageSize, toCursorPage } from "#api/shared/application/cursor-page";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { CheerId } from "../../domain/cheer-id.vo.js";
import { CheerLogEvent } from "../cheers.log-events.js";
import type { CheerCountCachePort } from "../ports/cheer-count-cache.port.js";
import type { CheerReaderPort } from "../ports/cheer.reader.port.js";
import type { ReceivedCheersReadModel } from "../read-models/cheer.read-model.js";

export interface GetReceivedCheersQuery {
  readonly userId: string;
  readonly cursor?: number;
  readonly size?: number;
}

export interface GetReceivedCheersDependencies {
  readonly cheerReader: Pick<
    CheerReaderPort,
    "listReceived" | "countReceived" | "countUnreadReceived"
  >;
  readonly countCache: Pick<CheerCountCachePort, "wrapReceivedCounts">;
  readonly logger: Pick<ApplicationLoggerPort, "debug">;
}

export class GetReceivedCheersUseCase {
  readonly #dependencies: GetReceivedCheersDependencies;

  constructor(dependencies: GetReceivedCheersDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetReceivedCheersQuery): Promise<ReceivedCheersReadModel> {
    const { cheerReader, countCache, logger } = this.#dependencies;
    const userId = UserId.reconstitute(query.userId);
    const size = clampPageSize(query.size);
    const [rows, counts] = await Promise.all([
      cheerReader.listReceived({
        userId,
        afterCheerId: query.cursor == null ? null : CheerId.reconstitute(query.cursor),
        limit: size + 1,
      }),
      // 수는 쪽마다 같아서 짧게 담아 둔다. 트랜잭션 밖 독립 읽기다
      countCache.wrapReceivedCounts(userId, async () => {
        const [total, unread] = await Promise.all([
          cheerReader.countReceived(userId),
          cheerReader.countUnreadReceived(userId),
        ]);
        return { total, unread };
      }),
    ]);
    const page = toCursorPage({ rows, size, toCursor: (cheer) => cheer.id });
    logger.debug({
      event: CheerLogEvent.RECEIVED_LISTED,
      userId: query.userId,
      count: page.items.length,
    });
    return { page, totalCount: counts.total, unreadCount: counts.unread };
  }
}
