import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { type MemoRepositoryPort } from "../../ports/memos/memo.repository.port.js";
import type { MemoMutationResult } from "./create-memo.use-case.js";

/** 메모 고정/해제 입력. */
export interface ToggleMemoPinInput {
  userId: string;
  memoId: number;
  isPinned: boolean;
}

interface ToggleMemoPinDependencies {
  readonly repository: MemoRepositoryPort;
  readonly logger: ApplicationLogger;
}

export class ToggleMemoPin {
  readonly #dependencies: ToggleMemoPinDependencies;

  constructor(dependencies: ToggleMemoPinDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ToggleMemoPinInput): Promise<MemoMutationResult> {
    const memo = await this.#dependencies.repository.findByIdAndUserId(input.memoId, input.userId);
    if (!memo) {
      throw new ApplicationException(ErrorCode.MEMO_2001, {
        memoId: input.memoId,
      });
    }

    memo.setPinned(input.isPinned);
    const updated = await this.#dependencies.repository.updatePinned(input.memoId, memo.isPinned);

    this.#dependencies.logger.log(
      `Memo ${input.isPinned ? "pinned" : "unpinned"}: ${input.memoId} for user: ${input.userId}`,
    );

    return {
      message: input.isPinned ? "메모가 고정되었습니다." : "메모 고정이 해제되었습니다.",
      memo: updated.toView(),
    };
  }
}
