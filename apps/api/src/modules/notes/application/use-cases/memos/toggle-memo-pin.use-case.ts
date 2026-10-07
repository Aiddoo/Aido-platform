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
import { toMemoView } from "../../read-models/memos/memo.read-model.js";
import type { MemoMutationResult } from "./create-memo.use-case.js";

export interface ToggleMemoPinInput {
  readonly userId: string;
  readonly memoId: number;
  readonly isPinned: boolean;
}

interface ToggleMemoPinDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly repository: Pick<MemoRepositoryPort, "findByIdAndUserId" | "updatePinned">;
  readonly mutationLock: MutationLockPort;
  readonly logger: ApplicationLogger;
}

export class ToggleMemoPin {
  readonly #dependencies: ToggleMemoPinDependencies;

  constructor(dependencies: ToggleMemoPinDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ToggleMemoPinInput): Promise<MemoMutationResult> {
    const updated = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([MutationLockKeys.memo(input.memoId)]);
      const memo = await this.#dependencies.repository.findByIdAndUserId(
        input.memoId,
        input.userId,
      );
      if (memo === null) {
        throw new ApplicationException(ErrorCode.MEMO_2001, {
          memoId: input.memoId,
        });
      }

      memo.setPinned(input.isPinned);
      return this.#dependencies.repository.updatePinned(input.memoId, memo.isPinned);
    });

    this.#dependencies.logger.log({
      event: NotesMemoLogEvent.PIN_CHANGED,
      memoId: input.memoId,
      userId: input.userId,
    });

    return {
      message: input.isPinned ? "메모가 고정되었습니다." : "메모 고정이 해제되었습니다.",
      memo: toMemoView(updated),
    };
  }
}
