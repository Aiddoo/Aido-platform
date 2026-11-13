import { MEMO_LIMITS } from "@aido/api/vocabulary";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { MemoContent } from "../../domain/memo-content.vo.js";
import { fingerprintMemoCreation } from "../../domain/memo-creation-request.domain-service.js";
import { Memo, type MemoCreationRequest } from "../../domain/memo.aggregate.js";
import {
  MemoIdempotencyKeyTakenError,
  memoLimitReached,
  memoRequestMismatch,
} from "../memos.errors.js";
import { MemoLockKeys } from "../memos.lock-keys.js";
import { MemoLogEvent } from "../memos.log-events.js";
import type { MemoRepositoryPort } from "../ports/memo.repository.port.js";

export interface CreateMemoCommand {
  readonly userId: string;
  readonly content: string;
  // 앱이 저장 한 번마다 만들어 재시도에 다시 보내는 키. 보내지 않으면(출시 앱·음성 계획) 요청마다 만든다
  readonly idempotencyKey: string | null;
}

export interface CreateMemoDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly memoRepository: Pick<
    MemoRepositoryPort,
    "nextId" | "findByIdempotencyKey" | "countByUserId" | "findMaxSortOrder" | "save"
  >;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

interface CreateMemoResult {
  readonly memo: Memo;
  readonly isReplayed: boolean;
}

export class CreateMemoUseCase {
  readonly #dependencies: CreateMemoDependencies;

  constructor(dependencies: CreateMemoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: CreateMemoCommand): Promise<Memo> {
    const { unitOfWork, logger } = this.#dependencies;
    const userId = UserId.reconstitute(command.userId);
    const creationRequest =
      command.idempotencyKey == null
        ? null
        : {
            idempotencyKey: command.idempotencyKey,
            requestHash: fingerprintMemoCreation(userId, command.content),
          };

    const { memo, isReplayed } = await this.#createOrReplay(
      userId,
      command.content,
      creationRequest,
    ).catch(async (error: unknown): Promise<CreateMemoResult> => {
      if (creationRequest == null || !(error instanceof MemoIdempotencyKeyTakenError)) {
        throw error;
      }
      // 잠금을 지나 같은 키 생성이 겹치면 unique 제약이 막고 트랜잭션은 되돌아간다. 새 트랜잭션에서 먼저 저장된 메모를 읽는다
      const replayed = await unitOfWork.run(() => this.#findReplayed(userId, creationRequest));
      if (replayed == null) {
        throw error;
      }
      return { memo: replayed, isReplayed: true };
    });

    logger.log({
      event: isReplayed ? MemoLogEvent.CREATE_REPLAYED : MemoLogEvent.CREATED,
      memoId: memo.id.value,
      userId: command.userId,
    });
    return memo;
  }

  #createOrReplay(
    userId: UserId,
    content: string,
    creationRequest: MemoCreationRequest | null,
  ): Promise<CreateMemoResult> {
    const { unitOfWork, mutationLock, memoRepository, clock } = this.#dependencies;

    return unitOfWork.run(async () => {
      await mutationLock.acquire([MemoLockKeys.sortOrder(userId)]);
      // 응답을 받지 못해 다시 보낸 저장은 처음 만든 메모를 돌려준다. 같은 사용자의 생성은 위 잠금으로 줄을 서서
      // 늦게 닿은 첫 요청과 재시도가 겹쳐도 하나만 만들고, 그 메모로 한도가 찼어도 막지 않는다
      const replayed =
        creationRequest == null ? null : await this.#findReplayed(userId, creationRequest);
      if (replayed != null) {
        return { memo: replayed, isReplayed: true };
      }
      // 한도를 내용 검증보다 먼저 본다(출시 앱이 받는 오류 우선순위)
      const memoCount = await memoRepository.countByUserId(userId);
      if (memoCount >= MEMO_LIMITS.MAX_PER_USER) {
        throw memoLimitReached(memoCount);
      }

      const memoContent = MemoContent.create(content);
      const maxSortOrder = await memoRepository.findMaxSortOrder(userId);
      const created = Memo.create({
        id: await memoRepository.nextId(),
        userId,
        content: memoContent,
        sortOrder: maxSortOrder == null ? 0 : maxSortOrder + 1,
        now: clock.now(),
        creationRequest,
      });
      await memoRepository.save(created);
      return { memo: created, isReplayed: false };
    });
  }

  /** 그 키로 만든 메모. 같은 키로 글이 다르면 다른 저장이라 MEMO_2004로 거절한다 */
  async #findReplayed(userId: UserId, creationRequest: MemoCreationRequest): Promise<Memo | null> {
    const replayed = await this.#dependencies.memoRepository.findByIdempotencyKey(
      userId,
      creationRequest.idempotencyKey,
    );
    if (replayed != null && !replayed.isSameCreationRequest(creationRequest.requestHash)) {
      throw memoRequestMismatch();
    }
    return replayed;
  }
}
