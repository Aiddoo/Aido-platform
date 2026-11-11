import { MEMO_LIMITS } from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { MemoRepositoryPort } from "../ports/memo.repository.port.js";

export interface GetMemoResourceLimitQuery {
  readonly userId: string;
}

export interface MemoResourceLimit {
  readonly currentCount: number;
  readonly maxPerUser: number;
}

export interface GetMemoResourceLimitDependencies {
  readonly memoRepository: Pick<MemoRepositoryPort, "countByUserId">;
}

export class GetMemoResourceLimitUseCase {
  readonly #dependencies: GetMemoResourceLimitDependencies;

  constructor(dependencies: GetMemoResourceLimitDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetMemoResourceLimitQuery): Promise<MemoResourceLimit> {
    const currentCount = await this.#dependencies.memoRepository.countByUserId(
      UserId.reconstitute(query.userId),
    );
    return { currentCount, maxPerUser: MEMO_LIMITS.MAX_PER_USER };
  }
}
