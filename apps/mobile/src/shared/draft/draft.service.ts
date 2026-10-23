import {
  type DraftKey,
  type DraftRestoreResult,
  isDraftExpired,
  isDraftOwnedBy,
  resolveDraftRestore,
} from './draft.model';
import type { DraftRepository } from './draft.repository';

interface DraftSourceOptions {
  /** 편집 대상의 서버 수정 시각(epoch ms) */
  sourceUpdatedAt?: number;
}

export class DraftService {
  readonly #repository: DraftRepository;
  readonly #now: () => number;

  constructor(repository: DraftRepository, now: () => number = Date.now) {
    this.#repository = repository;
    this.#now = now;
  }

  restore = <TValue>(
    draftKey: DraftKey<TValue>,
    { sourceUpdatedAt }: DraftSourceOptions = {},
  ): DraftRestoreResult<TValue> =>
    resolveDraftRestore(this.#repository.find(draftKey.id), {
      schema: draftKey.schema,
      now: this.#now(),
      sourceUpdatedAt,
    });

  save = <TValue>(
    draftKey: DraftKey<TValue>,
    value: TValue,
    { sourceUpdatedAt }: DraftSourceOptions = {},
  ): void => {
    this.#repository.save(draftKey.id, {
      value,
      savedAt: this.#now(),
      sourceUpdatedAt: sourceUpdatedAt ?? null,
    });
  };

  remove = <TValue>(draftKey: DraftKey<TValue>): void => {
    this.#repository.remove(draftKey.id);
  };

  removeExpired = (): void => {
    const now = this.#now();

    for (const id of this.#repository.findAllIds()) {
      const entry = this.#repository.find(id);
      if (entry === undefined || isDraftExpired(entry, now)) {
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
}
