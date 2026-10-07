import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import {
  planReorderRelativeTo,
  planReorderToEdge,
  type ReorderPlan,
} from "../../../domain/policies/memos/memo-reorder.policy.js";
import { NotesMemoLogEvent } from "../../observability/memos/notes-memo-log.events.js";
import { type MemoRepositoryPort } from "../../ports/memos/memo.repository.port.js";
import { toMemoView } from "../../read-models/memos/memo.read-model.js";
import type { MemoMutationResult } from "./create-memo.use-case.js";

export interface ReorderMemoInput {
  readonly userId: string;
  readonly memoId: number;
  readonly position: "before" | "after";
  readonly targetMemoId?: number;
}

interface ReorderMemoDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly repository: Pick<
    MemoRepositoryPort,
    "findByIdAndUserId" | "getMaxSortOrder" | "shiftSortOrders" | "updateSortOrder"
  >;
  readonly mutationLock: MutationLockPort;
  readonly logger: ApplicationLogger;
}

export class ReorderMemo {
  readonly #dependencies: ReorderMemoDependencies;

  constructor(dependencies: ReorderMemoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ReorderMemoInput): Promise<MemoMutationResult> {
    const { userId, memoId, targetMemoId } = input;

    return this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([MutationLockKeys.memoSortOrder(input.userId)]);
      const memo = await this.#dependencies.repository.findByIdAndUserId(memoId, userId);
      if (memo === null) {
        throw new ApplicationException(ErrorCode.MEMO_2001, { memoId });
      }

      if (targetMemoId === memoId) {
        return { message: "메모 순서가 변경되었습니다.", memo: toMemoView(memo) };
      }

      const plan = await this.#planReorder(memo.sortOrder, input);

      await this.#dependencies.repository.shiftSortOrders(
        userId,
        plan.shift.from,
        plan.shift.to,
        plan.shift.delta,
      );
      const updated = await this.#dependencies.repository.updateSortOrder(
        memoId,
        plan.newSortOrder,
      );

      this.#dependencies.logger.log({
        event: NotesMemoLogEvent.REORDERED,
        memoId: input.memoId,
        userId: input.userId,
      });

      return { message: "메모 순서가 변경되었습니다.", memo: toMemoView(updated) };
    });
  }

  async #planReorder(currentSortOrder: number, input: ReorderMemoInput): Promise<ReorderPlan> {
    const { userId, targetMemoId, position } = input;

    if (targetMemoId !== undefined) {
      const target = await this.#dependencies.repository.findByIdAndUserId(targetMemoId, userId);
      if (target === null) {
        throw new ApplicationException(ErrorCode.MEMO_2002, { targetMemoId });
      }
      return planReorderRelativeTo(currentSortOrder, target.sortOrder, position);
    }

    // 맨 뒤 이동만 maxSortOrder가 필요하다 (맨 앞은 0 고정).
    const maxSortOrder =
      position === "after" ? await this.#dependencies.repository.getMaxSortOrder(userId) : 0;
    return planReorderToEdge(currentSortOrder, position, maxSortOrder);
  }
}
