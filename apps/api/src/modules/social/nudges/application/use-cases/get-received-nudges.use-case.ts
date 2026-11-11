import { clampPageSize, toCursorPage } from "#api/shared/application/cursor-page";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { NudgeId } from "../../domain/nudge-id.vo.js";
import { NudgeLogEvent } from "../nudges.log-events.js";
import type { NudgeReaderPort } from "../ports/nudge.reader.port.js";
import type { ReceivedNudges } from "../read-models/nudge.read-model.js";

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
  readonly logger: Pick<ApplicationLoggerPort, "debug">;
}

export class GetReceivedNudgesUseCase {
  readonly #dependencies: GetReceivedNudgesDependencies;

  constructor(dependencies: GetReceivedNudgesDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetReceivedNudgesQuery): Promise<ReceivedNudges> {
    const { nudgeReader, logger } = this.#dependencies;
    const userId = UserId.reconstitute(query.userId);
    const size = clampPageSize(query.size);
    const [rows, totalCount, unreadCount] = await Promise.all([
      nudgeReader.listReceived({
        userId,
        afterNudgeId: query.cursor == null ? null : NudgeId.reconstitute(query.cursor),
        limit: size + 1,
      }),
      nudgeReader.countReceived(userId),
      nudgeReader.countUnreadReceived(userId),
    ]);
    const page = toCursorPage({ rows, size, toCursor: (nudge) => nudge.id });
    logger.debug({
      event: NudgeLogEvent.RECEIVED_LISTED,
      userId: query.userId,
      count: page.items.length,
    });
    return { page, totalCount, unreadCount };
  }
}
