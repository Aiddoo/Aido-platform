import { clampPageSize, toCursorPage } from "#api/shared/application/cursor-page";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { CheerId } from "../../domain/cheer-id.vo.js";
import { CheerLogEvent } from "../cheers.log-events.js";
import type { CheerReaderPort } from "../ports/cheer.reader.port.js";
import type { ReceivedCheers } from "../read-models/cheer.read-model.js";

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
  readonly logger: Pick<ApplicationLoggerPort, "debug">;
}

export class GetReceivedCheersUseCase {
  readonly #dependencies: GetReceivedCheersDependencies;

  constructor(dependencies: GetReceivedCheersDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetReceivedCheersQuery): Promise<ReceivedCheers> {
    const { cheerReader, logger } = this.#dependencies;
    const userId = UserId.reconstitute(query.userId);
    const size = clampPageSize(query.size);
    const [rows, totalCount, unreadCount] = await Promise.all([
      cheerReader.listReceived({
        userId,
        afterCheerId: query.cursor == null ? null : CheerId.reconstitute(query.cursor),
        limit: size + 1,
      }),
      cheerReader.countReceived(userId),
      cheerReader.countUnreadReceived(userId),
    ]);
    const page = toCursorPage({ rows, size, toCursor: (cheer) => cheer.id });
    logger.debug({
      event: CheerLogEvent.RECEIVED_LISTED,
      userId: query.userId,
      count: page.items.length,
    });
    return { page, totalCount, unreadCount };
  }
}
