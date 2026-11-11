import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { MemoId } from "../../domain/memo-id.vo.js";
import type { Memo } from "../../domain/memo.aggregate.js";
import { memoNotFound } from "../memos.errors.js";
import type { MemoRepositoryPort } from "../ports/memo.repository.port.js";

export interface GetMemoQuery {
  readonly userId: string;
  readonly memoId: number;
}

export interface GetMemoDependencies {
  readonly memoRepository: Pick<MemoRepositoryPort, "findByIdAndUserId">;
}

export class GetMemoUseCase {
  readonly #dependencies: GetMemoDependencies;

  constructor(dependencies: GetMemoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetMemoQuery): Promise<Memo> {
    const memoId = MemoId.reconstitute(query.memoId);
    const memo = await this.#dependencies.memoRepository.findByIdAndUserId(
      memoId,
      UserId.reconstitute(query.userId),
    );
    if (memo == null) {
      throw memoNotFound(memoId);
    }
    return memo;
  }
}
