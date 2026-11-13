import { clampPageSize, toCursorPage } from "#api/shared/application/cursor-page";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { NudgeId } from "../../domain/nudge-id.vo.js";
import { NudgeLogEvent } from "../nudges.log-events.js";
import type { NudgeCountCachePort } from "../ports/nudge-count-cache.port.js";
import type { NudgeReaderPort } from "../ports/nudge.reader.port.js";
import type { ReceivedNudgesReadModel } from "../read-models/nudge.read-model.js";

export interface GetReceivedNudgesQuery {
  readonly userId: string;
  readonly cursor?: number;
  readonly size?: number;
}

export interface GetReceivedNudgesDependencies {
  readonly nudgeReader: Pick<
    NudgeReaderPort,
    "listReceived" | "countReceived" | "countUnreadReceived"
  >;
  readonly countCache: Pick<NudgeCountCachePort, "wrapReceivedCounts">;
  readonly logger: Pick<ApplicationLoggerPort, "debug">;
}

export class GetReceivedNudgesUseCase {
  readonly #dependencies: GetReceivedNudgesDependencies;

  constructor(dependencies: GetReceivedNudgesDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetReceivedNudgesQuery): Promise<ReceivedNudgesReadModel> {
    const { nudgeReader, countCache, logger } = this.#dependencies;
    const userId = UserId.reconstitute(query.userId);
    const size = clampPageSize(query.size);
    const [rows, counts] = await Promise.all([
      nudgeReader.listReceived({
        userId,
        afterNudgeId: query.cursor == null ? null : NudgeId.reconstitute(query.cursor),
        limit: size + 1,
      }),
      // 수는 쪽마다 같아서 짧게 담아 둔다. 트랜잭션 밖 독립 읽기다
      countCache.wrapReceivedCounts(userId, async () => {
        const [total, unread] = await Promise.all([
          nudgeReader.countReceived(userId),
          nudgeReader.countUnreadReceived(userId),
        ]);
        return { total, unread };
      }),
    ]);
    const page = toCursorPage({ rows, size, toCursor: (nudge) => nudge.id });
    logger.debug({
      event: NudgeLogEvent.RECEIVED_LISTED,
      userId: query.userId,
      count: page.items.length,
    });
    return { page, totalCount: counts.total, unreadCount: counts.unread };
  }
}
