import { clampPageSize, type CursorPage, toCursorPage } from "#api/shared/application/cursor-page";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { MemoId } from "../../domain/memo-id.vo.js";
import type { Memo } from "../../domain/memo.aggregate.js";
import type { MemoRepositoryPort } from "../ports/memo.repository.port.js";

export interface ListMemosQuery {
  readonly userId: string;
  readonly cursor?: number;
  readonly size?: number;
}

export interface ListMemosDependencies {
  readonly memoRepository: Pick<MemoRepositoryPort, "listByUserId">;
}

export class ListMemosUseCase {
  readonly #dependencies: ListMemosDependencies;

  constructor(dependencies: ListMemosDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: ListMemosQuery): Promise<CursorPage<Memo, number>> {
    const size = clampPageSize(query.size);
    const memos = await this.#dependencies.memoRepository.listByUserId({
      userId: UserId.reconstitute(query.userId),
      afterMemoId: query.cursor == null ? null : MemoId.reconstitute(query.cursor),
      limit: size + 1,
    });
    return toCursorPage({ rows: memos, size, toCursor: (memo) => memo.id.value });
  }
}
