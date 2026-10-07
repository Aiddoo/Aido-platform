import type { Memo as MemoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { type MemoRepositoryPort } from "../../ports/memos/memo.repository.port.js";
import { toMemoView } from "../../read-models/memos/memo.read-model.js";

export interface GetMemoInput {
  readonly userId: string;
  readonly memoId: number;
}

export interface GetMemoResult {
  memo: MemoResponse;
}

interface GetMemoDependencies {
  readonly repository: Pick<MemoRepositoryPort, "findByIdAndUserId">;
}

export class GetMemo {
  readonly #dependencies: GetMemoDependencies;

  constructor(dependencies: GetMemoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetMemoInput): Promise<GetMemoResult> {
    const memo = await this.#dependencies.repository.findByIdAndUserId(input.memoId, input.userId);
    if (memo === null) {
      throw new ApplicationException(ErrorCode.MEMO_2001, {
        memoId: input.memoId,
      });
    }

    return { memo: toMemoView(memo) };
  }
}
