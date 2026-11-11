import type { ReorderPosition } from "@aido/api/vocabulary";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { MemoId } from "../../domain/memo-id.vo.js";
import {
  type MemoMovePlan,
  planMoveRelativeTo,
  planMoveToEdge,
} from "../../domain/memo-ordering.domain-service.js";
import type { Memo } from "../../domain/memo.aggregate.js";
import { memoNotFound, reorderTargetNotFound } from "../memos.errors.js";
import { MemoLockKeys } from "../memos.lock-keys.js";
import { MemoLogEvent } from "../memos.log-events.js";
import type { MemoRepositoryPort } from "../ports/memo.repository.port.js";

export interface ReorderMemoCommand {
  readonly userId: string;
  readonly memoId: number;
  readonly position: ReorderPosition;
  // 없으면 맨 앞(before)·맨 뒤(after)로 옮긴다
  readonly targetMemoId?: number;
}

export interface ReorderMemoDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly memoRepository: Pick<
    MemoRepositoryPort,
    "findByIdAndUserId" | "findMaxSortOrder" | "shiftSortOrders" | "save"
  >;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

export class ReorderMemoUseCase {
  readonly #dependencies: ReorderMemoDependencies;

  constructor(dependencies: ReorderMemoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: ReorderMemoCommand): Promise<Memo> {
    const { unitOfWork, mutationLock, memoRepository, clock, logger } = this.#dependencies;
    const userId = UserId.reconstitute(command.userId);
    const memoId = MemoId.reconstitute(command.memoId);

    const { memo, isMoved } = await unitOfWork.run(async () => {
      await mutationLock.acquire(MemoLockKeys.existingMemo(memoId, userId));
      // 옮길 메모가 없으면 기준 메모보다 먼저 거절한다(출시 앱이 받는 오류 우선순위)
      const found = await memoRepository.findByIdAndUserId(memoId, userId);
      if (found == null) {
        throw memoNotFound(memoId);
      }
      if (command.targetMemoId === command.memoId) {
        return { memo: found, isMoved: false };
      }

      const plan = await this.#planMove(found, userId, command);
      const now = clock.now();
      await memoRepository.shiftSortOrders(userId, plan.shift, now);
      const hasMoved = found.moveTo(plan.sortOrder, now);
      if (hasMoved) {
        await memoRepository.save(found);
      }
      return { memo: found, isMoved: hasMoved };
    });

    if (isMoved) {
      logger.log({ event: MemoLogEvent.REORDERED, memoId: command.memoId, userId: command.userId });
    }
    return memo;
  }

  async #planMove(memo: Memo, userId: UserId, command: ReorderMemoCommand): Promise<MemoMovePlan> {
    const { memoRepository } = this.#dependencies;
    const currentSortOrder = memo.sortOrder;

    if (command.targetMemoId != null) {
      const targetMemoId = MemoId.reconstitute(command.targetMemoId);
      const target = await memoRepository.findByIdAndUserId(targetMemoId, userId);
      if (target == null) {
        throw reorderTargetNotFound(targetMemoId);
      }
      return planMoveRelativeTo({
        currentSortOrder,
        targetSortOrder: target.sortOrder,
        position: command.position,
      });
    }

    // 맨 뒤 이동만 최대 순서가 필요하다(맨 앞은 0)
    const maxSortOrder =
      command.position === "after" ? ((await memoRepository.findMaxSortOrder(userId)) ?? 0) : 0;
    return planMoveToEdge({ currentSortOrder, position: command.position, maxSortOrder });
  }
}
