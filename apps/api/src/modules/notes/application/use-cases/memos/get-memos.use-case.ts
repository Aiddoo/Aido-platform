import type { Memo as MemoResponse } from "@aido/api";

import type { CursorPaginatedResponse } from "#api/shared/application/pagination/index";
import type { PaginationService } from "#api/shared/application/pagination/index";

import { type MemoRepositoryPort } from "../../ports/memos/memo.repository.port.js";
import { toMemoView } from "../../read-models/memos/memo.read-model.js";

export interface GetMemosInput {
  readonly userId: string;
  readonly cursor?: number;
  readonly size?: number;
}

interface GetMemosDependencies {
  readonly repository: Pick<MemoRepositoryPort, "findManyByUserId">;
  readonly paginationService: PaginationService;
}

export class GetMemos {
  readonly #dependencies: GetMemosDependencies;

  constructor(dependencies: GetMemosDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetMemosInput): Promise<CursorPaginatedResponse<MemoResponse, number>> {
    const { cursor, size } = this.#dependencies.paginationService.normalizeCursorPagination<number>(
      {
        cursor: input.cursor,
        size: input.size,
      },
    );

    const memos = await this.#dependencies.repository.findManyByUserId({
      userId: input.userId,
      cursor,
      size,
    });

    return this.#dependencies.paginationService.createCursorPaginatedResponse<MemoResponse, number>(
      {
        items: memos.map((memo) => toMemoView(memo)),
        size,
      },
    );
  }
}
