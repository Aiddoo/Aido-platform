import { MEMO_LIMITS } from "@aido/api/vocabulary";

import { type MemoRepositoryPort } from "../../ports/memos/memo.repository.port.js";

/** 메모 리소스 제한 정보 조회 입력. */
export interface GetMemoResourceLimitInput {
  userId: string;
}

/** 메모 리소스 제한 조회 결과. */
export interface MemoResourceLimit {
  currentCount: number;
  maxPerUser: number;
}

interface GetMemoResourceLimitDependencies {
  readonly repository: MemoRepositoryPort;
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
