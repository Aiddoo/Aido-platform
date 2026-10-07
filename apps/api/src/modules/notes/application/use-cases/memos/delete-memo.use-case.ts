import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { NotesMemoLogEvent } from "../../observability/memos/notes-memo-log.events.js";
import { type MemoRepositoryPort } from "../../ports/memos/memo.repository.port.js";

export interface DeleteMemoInput {
  readonly userId: string;
  readonly memoId: number;
}

export interface DeleteMemoResult {
  readonly message: string;
}

interface DeleteMemoDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly repository: Pick<MemoRepositoryPort, "findByIdAndUserId" | "delete">;
  readonly mutationLock: MutationLockPort;
  readonly logger: ApplicationLogger;
}

export class DeleteMemo {
  readonly #dependencies: DeleteMemoDependencies;

  constructor(dependencies: DeleteMemoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: DeleteMemoInput): Promise<DeleteMemoResult> {
    await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([
        MutationLockKeys.memo(input.memoId),
        MutationLockKeys.memoSortOrder(input.userId),
      ]);
      const memo = await this.#dependencies.repository.findByIdAndUserId(
        input.memoId,
        input.userId,
      );
      if (memo === null) {
        throw new ApplicationException(ErrorCode.MEMO_2001, {
          memoId: input.memoId,
        });
      }

      await this.#dependencies.repository.delete(input.memoId);
    });

    this.#dependencies.logger.log({
      event: NotesMemoLogEvent.DELETED,
      memoId: input.memoId,
      userId: input.userId,
    });

    return { message: "메모가 삭제되었습니다." };
  }
}
