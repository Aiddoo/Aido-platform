import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { type MemoRepositoryPort } from "../../ports/memos/memo.repository.port.js";

/** 메모 삭제 입력 (소유권 확인 후 영구 삭제). */
export interface DeleteMemoInput {
  userId: string;
  memoId: number;
}

/** 메모 삭제 결과. */
export interface DeleteMemoResult {
  message: string;
}

interface DeleteMemoDependencies {
  readonly repository: MemoRepositoryPort;
  readonly logger: ApplicationLogger;
}

export class DeleteMemo {
  readonly #dependencies: DeleteMemoDependencies;

  constructor(dependencies: DeleteMemoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: DeleteMemoInput): Promise<DeleteMemoResult> {
    const memo = await this.#dependencies.repository.findByIdAndUserId(input.memoId, input.userId);
    if (!memo) {
      throw new ApplicationException(ErrorCode.MEMO_2001, {
        memoId: input.memoId,
      });
    }

    await this.#dependencies.repository.delete(input.memoId);

    this.#dependencies.logger.log(`Memo deleted: ${input.memoId} for user: ${input.userId}`);

    return { message: "메모가 삭제되었습니다." };
  }
}
