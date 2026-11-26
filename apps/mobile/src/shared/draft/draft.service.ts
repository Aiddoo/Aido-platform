import { type Instant, toEpochMs } from '@src/shared/date/instant';

import {
  type DraftKey,
  type DraftRestoreResult,
  isDraftExpired,
  isDraftOwnedBy,
  resolveDraftRestore,
} from './draft.model';
import type { DraftRepository } from './draft.repository';

type ReadSignOutEpoch = () => number;

interface DraftSourceOptions {
  /** 편집 대상의 서버 수정 시각(epoch ms) */
  sourceUpdatedAt?: number;
}

export class DraftService {
  readonly #repository: DraftRepository;
  readonly #now: () => Instant;
  readonly #readSignOutEpoch: ReadSignOutEpoch;

  constructor(repository: DraftRepository, now: () => Instant, readSignOutEpoch: ReadSignOutEpoch) {
    this.#repository = repository;
    this.#now = now;
    this.#readSignOutEpoch = readSignOutEpoch;
  }

  restore = <TValue>(
    draftKey: DraftKey<TValue>,
    { sourceUpdatedAt }: DraftSourceOptions = {},
  ): DraftRestoreResult<TValue> =>
    resolveDraftRestore(this.#repository.find(draftKey.id), {
      schema: draftKey.schema,
      now: this.#nowMs(),
      sourceUpdatedAt,
    });

  save = <TValue>(
    draftKey: DraftKey<TValue>,
    value: TValue,
    { sourceUpdatedAt }: DraftSourceOptions = {},
  ): void => {
    this.#repository.save(draftKey.id, {
      value,
      savedAt: this.#nowMs(),
      sourceUpdatedAt: sourceUpdatedAt ?? null,
    });
  };

  /** 로그아웃·탈퇴로 세대가 오른 뒤에는 쓰지 않아 내려가는 화면의 저장이 지운 초안을 되살리지 않는다 */
  createSessionSave = <TValue>(draftKey: DraftKey<TValue>) => {
    const startedEpoch = this.#readSignOutEpoch();

    return (value: TValue, options?: DraftSourceOptions): void => {
      if (this.#readSignOutEpoch() !== startedEpoch) {
        return;
      }
      this.save(draftKey, value, options);
    };
  };

  remove = <TValue>(draftKey: DraftKey<TValue>): void => {
    this.#repository.remove(draftKey.id);
  };

  removeExpired = (): void => {
    const now = this.#nowMs();

    for (const id of this.#repository.findAllIds()) {
      const entry = this.#repository.find(id);
      if (entry == null || isDraftExpired(entry, now)) {
        this.#repository.remove(id);
      }
    }
  };

  removeAllExceptOwner = (ownerId: string): void => {
    for (const id of this.#repository.findAllIds()) {
      if (!isDraftOwnedBy(id, ownerId)) {
        this.#repository.remove(id);
      }
    }
  };

  removeAll = (): void => {
    this.#repository.removeAll();
  };

  // 저장 형식(savedAt·만료 비교)은 epoch ms 그대로다
  #nowMs = (): number => toEpochMs(this.#now());
}
