import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { MemoId } from "../../domain/memo-id.vo.js";
import { memoNotFound } from "../memos.errors.js";
import { MemoLockKeys } from "../memos.lock-keys.js";
import { MemoLogEvent } from "../memos.log-events.js";
import type { MemoRepositoryPort } from "../ports/memo.repository.port.js";

export interface DeleteMemoCommand {
  readonly userId: string;
  readonly memoId: number;
}

export interface DeleteMemoDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly memoRepository: Pick<MemoRepositoryPort, "findByIdAndUserId" | "delete">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

export class DeleteMemoUseCase {
  readonly #dependencies: DeleteMemoDependencies;

  constructor(dependencies: DeleteMemoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: DeleteMemoCommand): Promise<void> {
    const { unitOfWork, mutationLock, memoRepository, logger } = this.#dependencies;
    const userId = UserId.reconstitute(command.userId);
    const memoId = MemoId.reconstitute(command.memoId);

    await unitOfWork.run(async () => {
      await mutationLock.acquire(MemoLockKeys.existingMemo(memoId, userId));
      const memo = await memoRepository.findByIdAndUserId(memoId, userId);
      if (memo == null) {
        throw memoNotFound(memoId);
      }
      await memoRepository.delete(memo);
    });

    logger.log({ event: MemoLogEvent.DELETED, memoId: command.memoId, userId: command.userId });
  }
}
