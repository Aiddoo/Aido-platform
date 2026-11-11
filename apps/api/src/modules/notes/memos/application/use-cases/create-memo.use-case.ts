import { MEMO_LIMITS } from "@aido/api/vocabulary";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { MemoContent } from "../../domain/memo-content.vo.js";
import { Memo } from "../../domain/memo.aggregate.js";
import { memoLimitReached } from "../memos.errors.js";
import { MemoLockKeys } from "../memos.lock-keys.js";
import { MemoLogEvent } from "../memos.log-events.js";
import type { MemoRepositoryPort } from "../ports/memo.repository.port.js";

export interface CreateMemoCommand {
  readonly userId: string;
  readonly content: string;
}

export interface CreateMemoDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly memoRepository: Pick<
    MemoRepositoryPort,
    "nextId" | "countByUserId" | "findMaxSortOrder" | "save"
  >;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

export class CreateMemoUseCase {
  readonly #dependencies: CreateMemoDependencies;

  constructor(dependencies: CreateMemoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: CreateMemoCommand): Promise<Memo> {
    const { unitOfWork, mutationLock, memoRepository, clock, logger } = this.#dependencies;
    const userId = UserId.reconstitute(command.userId);

    const memo = await unitOfWork.run(async () => {
      await mutationLock.acquire([MemoLockKeys.sortOrder(userId)]);
      // 한도를 내용 검증보다 먼저 본다(출시 앱이 받는 오류 우선순위)
      const memoCount = await memoRepository.countByUserId(userId);
      if (memoCount >= MEMO_LIMITS.MAX_PER_USER) {
        throw memoLimitReached(memoCount);
      }

      const content = MemoContent.create(command.content);
      const maxSortOrder = await memoRepository.findMaxSortOrder(userId);
      const created = Memo.create({
        id: await memoRepository.nextId(),
        userId,
        content,
        sortOrder: maxSortOrder == null ? 0 : maxSortOrder + 1,
        now: clock.now(),
      });
      await memoRepository.save(created);
      return created;
    });

    logger.log({ event: MemoLogEvent.CREATED, memoId: memo.id.value, userId: command.userId });
    return memo;
  }
}
