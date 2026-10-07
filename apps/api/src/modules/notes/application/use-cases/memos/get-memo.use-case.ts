import type { Memo as MemoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { type MemoRepositoryPort } from "../../ports/memos/memo.repository.port.js";

/** 메모 단건 조회 입력. */
export interface GetMemoInput {
  userId: string;
  memoId: number;
}

/** 메모 단건 조회 결과. */
export interface GetMemoResult {
  memo: MemoResponse;
}

interface GetMemoDependencies {
  readonly repository: MemoRepositoryPort;
}

export class GetMemo {
  readonly #dependencies: GetMemoDependencies;

  constructor(dependencies: GetMemoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetMemoInput): Promise<GetMemoResult> {
    const memo = await this.#dependencies.repository.findByIdAndUserId(input.memoId, input.userId);
    if (!memo) {
      throw new ApplicationException(ErrorCode.MEMO_2001, {
        memoId: input.memoId,
      });
    }

    return { memo: memo.toView() };
  }
}
