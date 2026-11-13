import { clampPageSize, toCursorPage } from "#api/shared/application/cursor-page";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { NudgeId } from "../../domain/nudge-id.vo.js";
import { NudgeLogEvent } from "../nudges.log-events.js";
import type { NudgeCountCachePort } from "../ports/nudge-count-cache.port.js";
import type { NudgeReaderPort } from "../ports/nudge.reader.port.js";
import type { SentNudgesReadModel } from "../read-models/nudge.read-model.js";

export interface GetSentNudgesQuery {
  readonly userId: string;
  readonly cursor?: number;
  readonly size?: number;
}

export interface GetSentNudgesDependencies {
  readonly nudgeReader: Pick<NudgeReaderPort, "listSent" | "countSent">;
  readonly countCache: Pick<NudgeCountCachePort, "wrapSentCount">;
  readonly logger: Pick<ApplicationLoggerPort, "debug">;
}

export class GetSentNudgesUseCase {
  readonly #dependencies: GetSentNudgesDependencies;

  constructor(dependencies: GetSentNudgesDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetSentNudgesQuery): Promise<SentNudgesReadModel> {
    const { nudgeReader, countCache, logger } = this.#dependencies;
    const userId = UserId.reconstitute(query.userId);
    const size = clampPageSize(query.size);
    const [rows, totalCount] = await Promise.all([
      nudgeReader.listSent({
        userId,
        afterNudgeId: query.cursor == null ? null : NudgeId.reconstitute(query.cursor),
        limit: size + 1,
      }),
      countCache.wrapSentCount(userId, () => nudgeReader.countSent(userId)),
    ]);
    const page = toCursorPage({ rows, size, toCursor: (nudge) => nudge.id });
    logger.debug({
      event: NudgeLogEvent.SENT_LISTED,
      userId: query.userId,
      count: page.items.length,
    });
    return { page, totalCount };
  }
}
