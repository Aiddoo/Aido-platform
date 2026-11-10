import type { PaginationService } from "#api/shared/application/pagination/index";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";

import { NudgeLogEvent } from "../nudges.log-events.js";
import type { NudgeRepositoryPort } from "../ports/nudge.repository.port.js";
import type { GetNudgesInput, SentNudgesSnapshot } from "../read-models/nudge.read-model.js";

interface GetSentNudgesDependencies {
  readonly nudgeRepository: Pick<NudgeRepositoryPort, "findSentNudges" | "countSent">;
  readonly paginationService: Pick<
    PaginationService,
    "normalizeCursorPagination" | "createCursorPaginatedResponse"
  >;
  readonly logger: ApplicationLoggerPort;
}

export class GetSentNudgesUseCase {
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
