import type { Memo as MemoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { MEMO_LIMITS } from "@aido/api/vocabulary";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { MemoContent } from "../../../domain/value-objects/memos/memo-content.vo.js";
import { NotesMemoLogEvent } from "../../observability/memos/notes-memo-log.events.js";
import { type MemoRepositoryPort } from "../../ports/memos/memo.repository.port.js";
import { toMemoView } from "../../read-models/memos/memo.read-model.js";

export interface MemoMutationResult {
  readonly message: string;
  readonly memo: MemoResponse;
}

export interface CreateMemoInput {
  readonly userId: string;
  readonly content: string;
}

interface CreateMemoDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly repository: Pick<MemoRepositoryPort, "countByUserId" | "getMaxSortOrder" | "create">;
  readonly mutationLock: MutationLockPort;
  readonly logger: ApplicationLogger;
}

export class CreateMemo {
  readonly #dependencies: CreateMemoDependencies;

  constructor(dependencies: CreateMemoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: CreateMemoInput): Promise<MemoMutationResult> {
    const memo = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([MutationLockKeys.memoSortOrder(input.userId)]);
      const count = await this.#dependencies.repository.countByUserId(input.userId);
      if (count >= MEMO_LIMITS.MAX_PER_USER) {
        throw new ApplicationException(ErrorCode.MEMO_2003, {
          current: count,
          limit: MEMO_LIMITS.MAX_PER_USER,
        });
      }

      const content = MemoContent.of(input.content);
      const maxSortOrder = await this.#dependencies.repository.getMaxSortOrder(input.userId);

      return this.#dependencies.repository.create(input.userId, content.value, maxSortOrder + 1);
    });

    this.#dependencies.logger.log({
      event: NotesMemoLogEvent.CREATED,
      memoId: memo.id,
      userId: input.userId,
    });

    return { message: "메모가 생성되었습니다.", memo: toMemoView(memo) };
  }
}
