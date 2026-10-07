import type { PaginationService } from "#api/shared/application/pagination/index";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import type { GetCheersInput, SentCheersSnapshot } from "../../models/cheers/cheer-read.models.js";
import { CheerLogEvent } from "../../observability/cheers/cheer-log.events.js";
import type { CheerRepositoryPort } from "../../ports/cheers/cheer.repository.port.js";

interface GetSentCheersDependencies {
  readonly cheerRepository: Pick<CheerRepositoryPort, "findSentCheers" | "countSent">;
  readonly paginationService: Pick<
    PaginationService,
    "normalizeCursorPagination" | "createCursorPaginatedResponse"
  >;
  readonly logger: ApplicationLogger;
}

export class GetSentCheers {
  readonly #dependencies: GetSentCheersDependencies;

  constructor(dependencies: GetSentCheersDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetCheersInput): Promise<SentCheersSnapshot> {
    const { cursor, size } =
      this.#dependencies.paginationService.normalizeCursorPagination<number>(input);
    const [rows, totalCount] = await Promise.all([
      this.#dependencies.cheerRepository.findSentCheers({ userId: input.userId, cursor, size }),
      this.#dependencies.cheerRepository.countSent(input.userId),
    ]);
    const page = this.#dependencies.paginationService.createCursorPaginatedResponse({
      items: rows,
      size,
    });
    this.#dependencies.logger.debug({
      event: CheerLogEvent.SENT_LISTED,
      userId: input.userId,
      count: page.items.length,
    });
    return { items: page.items, totalCount, hasMore: page.pagination.hasNext };
  }
}
