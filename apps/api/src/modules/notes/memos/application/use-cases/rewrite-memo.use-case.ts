import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { MemoContent } from "../../domain/memo-content.vo.js";
import { MemoId } from "../../domain/memo-id.vo.js";
import type { Memo } from "../../domain/memo.aggregate.js";
import { memoNotFound } from "../memos.errors.js";
import { MemoLockKeys } from "../memos.lock-keys.js";
import { MemoLogEvent } from "../memos.log-events.js";
import type { MemoRepositoryPort } from "../ports/memo.repository.port.js";

export interface RewriteMemoCommand {
  readonly userId: string;
  readonly memoId: number;
  readonly content: string;
}

export interface RewriteMemoDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly memoRepository: Pick<MemoRepositoryPort, "findByIdAndUserId" | "save">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

export class RewriteMemoUseCase {
  readonly #dependencies: RewriteMemoDependencies;

  constructor(dependencies: RewriteMemoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: RewriteMemoCommand): Promise<Memo> {
    const { unitOfWork, mutationLock, memoRepository, clock, logger } = this.#dependencies;
    const userId = UserId.reconstitute(command.userId);
    const memoId = MemoId.reconstitute(command.memoId);

    const { memo, isRewritten } = await unitOfWork.run(async () => {
      await mutationLock.acquire(MemoLockKeys.existingMemo(memoId, userId));
      // 없는 메모를 내용 검증보다 먼저 거절한다(출시 앱이 받는 오류 우선순위)
      const found = await memoRepository.findByIdAndUserId(memoId, userId);
      if (found == null) {
        throw memoNotFound(memoId);
      }
      const isChanged = found.rewrite(MemoContent.create(command.content), clock.now());
      if (isChanged) {
        await memoRepository.save(found);
      }
      return { memo: found, isRewritten: isChanged };
    });

    if (isRewritten) {
      logger.log({ event: MemoLogEvent.UPDATED, memoId: command.memoId, userId: command.userId });
    }
    return memo;
  }
}
