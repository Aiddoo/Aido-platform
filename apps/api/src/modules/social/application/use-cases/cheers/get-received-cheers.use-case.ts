import type { PaginationService } from "#api/shared/application/pagination/index";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import type {
  GetCheersInput,
  ReceivedCheersSnapshot,
} from "../../models/cheers/cheer-read.models.js";
import { CheerLogEvent } from "../../observability/cheers/cheer-log.events.js";
import type { CheerRepositoryPort } from "../../ports/cheers/cheer.repository.port.js";

interface GetReceivedCheersDependencies {
  readonly cheerRepository: Pick<
    CheerRepositoryPort,
    "findReceivedCheers" | "countReceived" | "countUnreadReceived"
  >;
  readonly paginationService: Pick<
    PaginationService,
    "normalizeCursorPagination" | "createCursorPaginatedResponse"
  >;
  readonly logger: ApplicationLogger;
}

export class GetReceivedCheers {
  readonly #dependencies: GetReceivedCheersDependencies;

  constructor(dependencies: GetReceivedCheersDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetCheersInput): Promise<ReceivedCheersSnapshot> {
    const { cursor, size } =
      this.#dependencies.paginationService.normalizeCursorPagination<number>(input);
    const [rows, totalCount, unreadCount] = await Promise.all([
      this.#dependencies.cheerRepository.findReceivedCheers({ userId: input.userId, cursor, size }),
      this.#dependencies.cheerRepository.countReceived(input.userId),
      this.#dependencies.cheerRepository.countUnreadReceived(input.userId),
    ]);
    const page = this.#dependencies.paginationService.createCursorPaginatedResponse({
      items: rows,
      size,
    });
    this.#dependencies.logger.debug({
      event: CheerLogEvent.RECEIVED_LISTED,
      userId: input.userId,
      count: page.items.length,
    });
    return { items: page.items, totalCount, unreadCount, hasMore: page.pagination.hasNext };
  }
}
