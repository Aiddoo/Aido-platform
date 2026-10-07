import type { PaginationService } from "#api/shared/application/pagination/index";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import type { GetNudgesInput, SentNudgesSnapshot } from "../../models/nudges/nudge-read.models.js";
import { NudgeLogEvent } from "../../observability/nudges/nudge-log.events.js";
import type { NudgeRepositoryPort } from "../../ports/nudges/nudge.repository.port.js";

interface GetSentNudgesDependencies {
  readonly nudgeRepository: Pick<NudgeRepositoryPort, "findSentNudges" | "countSent">;
  readonly paginationService: Pick<
    PaginationService,
    "normalizeCursorPagination" | "createCursorPaginatedResponse"
  >;
  readonly logger: ApplicationLogger;
}

export class GetSentNudges {
  readonly #dependencies: GetSentNudgesDependencies;

  constructor(dependencies: GetSentNudgesDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetNudgesInput): Promise<SentNudgesSnapshot> {
    const { cursor, size } =
      this.#dependencies.paginationService.normalizeCursorPagination<number>(input);
    const [rows, totalCount] = await Promise.all([
      this.#dependencies.nudgeRepository.findSentNudges({ userId: input.userId, cursor, size }),
      this.#dependencies.nudgeRepository.countSent(input.userId),
    ]);
    const page = this.#dependencies.paginationService.createCursorPaginatedResponse({
      items: rows,
      size,
    });
    this.#dependencies.logger.debug({
      event: NudgeLogEvent.SENT_LISTED,
      userId: input.userId,
      count: page.items.length,
    });
    return { items: page.items, totalCount, hasMore: page.pagination.hasNext };
  }
}
