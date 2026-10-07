import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { type MemoRepositoryPort } from "../../ports/memos/memo.repository.port.js";
import type { MemoMutationResult } from "./create-memo.use-case.js";

/** 메모 내용 수정 입력. */
export interface UpdateMemoInput {
  userId: string;
  memoId: number;
  content: string;
}

interface UpdateMemoDependencies {
  readonly repository: MemoRepositoryPort;
  readonly logger: ApplicationLogger;
}

export class UpdateMemo {
  readonly #dependencies: UpdateMemoDependencies;

  constructor(dependencies: UpdateMemoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpdateMemoInput): Promise<MemoMutationResult> {
    const memo = await this.#dependencies.repository.findByIdAndUserId(input.memoId, input.userId);
    if (!memo) {
      throw new ApplicationException(ErrorCode.MEMO_2001, {
        memoId: input.memoId,
      });
    }

    memo.rename(input.content);
    const updated = await this.#dependencies.repository.updateContent(
      input.memoId,
      memo.content.value,
    );

    this.#dependencies.logger.log(`Memo updated: ${input.memoId} for user: ${input.userId}`);

    return { message: "메모가 수정되었습니다.", memo: updated.toView() };
  }
}
