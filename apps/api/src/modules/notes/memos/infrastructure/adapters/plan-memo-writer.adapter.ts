import { Injectable } from "@nestjs/common";
import { omit } from "es-toolkit";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { MemoRepositoryPort } from "../../application/ports/memo.repository.port.js";
import { PlanMemoWriterPort } from "../../application/ports/plan-memo-writer.port.js";
import type { PlanMemoReadModel } from "../../application/read-models/plan-memo.read-model.js";
import { CreateMemoUseCase } from "../../application/use-cases/create-memo.use-case.js";
import type { MemoId } from "../../domain/memo-id.vo.js";
import type { Memo } from "../../domain/memo.aggregate.js";

function toPlanMemo(memo: Memo): PlanMemoReadModel {
  return omit(memo.toPrimitives(), ["idempotencyKey", "requestHash"]);
}

@Injectable()
export class PlanMemoWriterAdapter implements PlanMemoWriterPort {
  readonly #createMemo: CreateMemoUseCase;
  readonly #memoRepository: MemoRepositoryPort;

  constructor(createMemo: CreateMemoUseCase, memoRepository: MemoRepositoryPort) {
    this.#createMemo = createMemo;
    this.#memoRepository = memoRepository;
  }

  async create(input: {
    readonly userId: UserId;
    readonly content: string;
  }): Promise<PlanMemoReadModel> {
    return toPlanMemo(
      await this.#createMemo.execute({
        userId: input.userId.value,
        content: input.content,
        idempotencyKey: null,
      }),
    );
  }

  async findById(memoId: MemoId, userId: UserId): Promise<PlanMemoReadModel | null> {
    const memo = await this.#memoRepository.findByIdAndUserId(memoId, userId);
    return memo == null ? null : toPlanMemo(memo);
  }

  async delete(memoId: MemoId, userId: UserId): Promise<void> {
    const memo = await this.#memoRepository.findByIdAndUserId(memoId, userId);
    if (memo != null) {
      await this.#memoRepository.delete(memo);
    }
  }
}
