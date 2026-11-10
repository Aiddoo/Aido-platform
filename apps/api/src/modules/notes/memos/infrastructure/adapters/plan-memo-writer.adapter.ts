import { Injectable } from "@nestjs/common";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { toIsoString } from "#api/shared/domain/time/instant";

import { MemoRepositoryPort } from "../../application/ports/memo.repository.port.js";
import {
  type PlanMemo,
  PlanMemoWriterPort,
} from "../../application/ports/plan-memo-writer.port.js";
import { CreateMemoUseCase } from "../../application/use-cases/create-memo.use-case.js";
import { MemoId } from "../../domain/memo-id.vo.js";
import type { Memo } from "../../domain/memo.aggregate.js";

function toPlanMemo(memo: Memo): PlanMemo {
  const primitives = memo.toPrimitives();
  return {
    ...primitives,
    createdAt: toIsoString(primitives.createdAt),
    updatedAt: toIsoString(primitives.updatedAt),
  };
}

@Injectable()
export class PlanMemoWriterAdapter implements PlanMemoWriterPort {
  readonly #createMemo: CreateMemoUseCase;
  readonly #memoRepository: MemoRepositoryPort;

  constructor(createMemo: CreateMemoUseCase, memoRepository: MemoRepositoryPort) {
    this.#createMemo = createMemo;
    this.#memoRepository = memoRepository;
  }

  async create(input: { readonly userId: string; readonly content: string }): Promise<PlanMemo> {
    return toPlanMemo(await this.#createMemo.execute(input));
  }

  async findById(memoId: number, userId: string): Promise<PlanMemo | null> {
    const memo = await this.#memoRepository.findByIdAndUserId(
      MemoId.reconstitute(memoId),
      UserId.reconstitute(userId),
    );
    return memo == null ? null : toPlanMemo(memo);
  }

  async delete(memoId: number, userId: string): Promise<void> {
    const memo = await this.#memoRepository.findByIdAndUserId(
      MemoId.reconstitute(memoId),
      UserId.reconstitute(userId),
    );
    if (memo != null) {
      await this.#memoRepository.delete(memo);
    }
  }
}
