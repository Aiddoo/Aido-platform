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

export interface UpdateMemoInput {
  readonly userId: string;
  readonly memoId: number;
  readonly content: string;
}

interface UpdateMemoDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly repository: Pick<MemoRepositoryPort, "findByIdAndUserId" | "updateContent">;
  readonly mutationLock: MutationLockPort;
  readonly logger: ApplicationLogger;
}

export class UpdateMemo {
  readonly #dependencies: UpdateMemoDependencies;

  constructor(dependencies: UpdateMemoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpdateMemoInput): Promise<MemoMutationResult> {
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

      memo.rename(input.content);
      return this.#dependencies.repository.updateContent(input.memoId, memo.content.value);
    });

    this.#dependencies.logger.log({
      event: NotesMemoLogEvent.UPDATED,
      memoId: input.memoId,
      userId: input.userId,
    });

    return { message: "메모가 수정되었습니다.", memo: toMemoView(updated) };
  }
}
