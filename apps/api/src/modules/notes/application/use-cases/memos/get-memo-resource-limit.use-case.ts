import { MEMO_LIMITS } from "@aido/api/vocabulary";

import { type MemoRepositoryPort } from "../../ports/memos/memo.repository.port.js";

export interface GetMemoResourceLimitInput {
  readonly userId: string;
}

export interface MemoResourceLimit {
  currentCount: number;
  maxPerUser: number;
}

interface GetMemoResourceLimitDependencies {
  readonly repository: Pick<MemoRepositoryPort, "countByUserId">;
}

export class GetMemoResourceLimit {
  readonly #dependencies: GetMemoResourceLimitDependencies;

  constructor(dependencies: GetMemoResourceLimitDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetMemoResourceLimitInput): Promise<MemoResourceLimit> {
    const currentCount = await this.#dependencies.repository.countByUserId(input.userId);
    return { currentCount, maxPerUser: MEMO_LIMITS.MAX_PER_USER };
  }
}
