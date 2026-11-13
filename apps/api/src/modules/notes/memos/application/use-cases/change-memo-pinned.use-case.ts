import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { MemoId } from "../../domain/memo-id.vo.js";
import type { Memo } from "../../domain/memo.aggregate.js";
import { memoNotFound } from "../memos.errors.js";
import { MemoLockKeys } from "../memos.lock-keys.js";
import { MemoLogEvent } from "../memos.log-events.js";
import type { MemoRepositoryPort } from "../ports/memo.repository.port.js";

export interface ChangeMemoPinnedCommand {
  readonly userId: string;
  readonly memoId: number;
  readonly isPinned: boolean;
}

export interface ChangeMemoPinnedDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly memoRepository: Pick<MemoRepositoryPort, "findByIdAndUserId" | "save">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

export class ChangeMemoPinnedUseCase {
  readonly #dependencies: ChangeMemoPinnedDependencies;

  constructor(dependencies: ChangeMemoPinnedDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: ChangeMemoPinnedCommand): Promise<Memo> {
    const { unitOfWork, mutationLock, memoRepository, clock, logger } = this.#dependencies;
    const userId = UserId.reconstitute(command.userId);
    const memoId = MemoId.reconstitute(command.memoId);

    const { memo, isChanged } = await unitOfWork.run(async () => {
      await mutationLock.acquire(MemoLockKeys.existingMemo(memoId, userId));
      const found = await memoRepository.findByIdAndUserId(memoId, userId);
      if (found == null) {
        throw memoNotFound(memoId);
      }
      const isPinChanged = found.changePinned(command.isPinned, clock.now());
      if (isPinChanged) {
        await memoRepository.save(found);
      }
      return { memo: found, isChanged: isPinChanged };
    });

    if (isChanged) {
      logger.log({
        event: MemoLogEvent.PIN_CHANGED,
        memoId: command.memoId,
        userId: command.userId,
      });
    }
    return memo;
  }
}
