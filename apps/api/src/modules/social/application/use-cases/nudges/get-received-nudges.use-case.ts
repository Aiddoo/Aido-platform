import type { PaginationService } from "#api/shared/application/pagination/index";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import type {
  GetNudgesInput,
  ReceivedNudgesSnapshot,
} from "../../models/nudges/nudge-read.models.js";
import { NudgeLogEvent } from "../../observability/nudges/nudge-log.events.js";
import type { NudgeRepositoryPort } from "../../ports/nudges/nudge.repository.port.js";

interface GetReceivedNudgesDependencies {
  readonly nudgeRepository: Pick<
    NudgeRepositoryPort,
    "findReceivedNudges" | "countReceived" | "countUnreadReceived"
  >;
  readonly paginationService: Pick<
    PaginationService,
    "normalizeCursorPagination" | "createCursorPaginatedResponse"
  >;
  readonly logger: ApplicationLogger;
}

export class GetReceivedNudges {
  readonly #dependencies: GetReceivedNudgesDependencies;

  constructor(dependencies: GetReceivedNudgesDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetNudgesInput): Promise<ReceivedNudgesSnapshot> {
    const { cursor, size } =
      this.#dependencies.paginationService.normalizeCursorPagination<number>(input);
    const [rows, totalCount, unreadCount] = await Promise.all([
      this.#dependencies.nudgeRepository.findReceivedNudges({ userId: input.userId, cursor, size }),
      this.#dependencies.nudgeRepository.countReceived(input.userId),
      this.#dependencies.nudgeRepository.countUnreadReceived(input.userId),
    ]);
    const page = this.#dependencies.paginationService.createCursorPaginatedResponse({
      items: rows,
      size,
    });
    this.#dependencies.logger.debug({
      event: NudgeLogEvent.RECEIVED_LISTED,
      userId: input.userId,
      count: page.items.length,
    });
    return { items: page.items, totalCount, unreadCount, hasMore: page.pagination.hasNext };
  }
}
