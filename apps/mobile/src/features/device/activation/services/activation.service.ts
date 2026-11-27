import type { SyncStorage } from '@src/core/ports/sync-storage';
import { type Instant } from '@src/shared/date/instant';
import { readStoredValue, writeStoredValue } from '@src/shared/storage/define-stored-value';

import {
  ActivationPolicy,
  calculateDaysSinceSignup,
  isInChecklistWindow,
} from '../domains/activation.model';
import { activationProgressStoredValue } from '../schemas/activation-progress-storage.schema';

/** 진행을 남길 계정. 아직 받지 않았으면 비어 있고 기록하지 않는다 */
interface ActivationAccount {
  id: string;
  createdAt: Instant;
}

interface ActivationActionInput {
  user: ActivationAccount | undefined;
  now: Instant;
}

interface TodoCompletionInput extends ActivationActionInput {
  isCompleted: boolean;
}

type TodoCompletionResult =
  | { status: 'activated'; daysSinceSignup: number }
  | { status: 'skipped' };

/** 가입 7일 안의 계정만 기록한다. 오래된 계정이 할 일을 끝낼 때마다 활성화로 세지 않는다 */
export class ActivationService {
  readonly #storage: SyncStorage;

  constructor(storage: SyncStorage) {
    this.#storage = storage;
  }

  recordTodoCreated = ({ user, now }: ActivationActionInput): void => {
    if (user == null || !isInChecklistWindow(user.createdAt, now)) {
      return;
    }
    const progress = readStoredValue(this.#storage, activationProgressStoredValue, user.id);
    const next = ActivationPolicy.withTodoCreated(progress, now);
    if (next !== progress) {
      writeStoredValue(this.#storage, activationProgressStoredValue, next, user.id);
    }
  };

  recordTodoCompletion = ({
    user,
    isCompleted,
    now,
  }: TodoCompletionInput): TodoCompletionResult => {
    if (!isCompleted || user == null || !isInChecklistWindow(user.createdAt, now)) {
      return { status: 'skipped' };
    }
    const progress = readStoredValue(this.#storage, activationProgressStoredValue, user.id);
    if (!ActivationPolicy.canActivate(progress)) {
      return { status: 'skipped' };
    }
    writeStoredValue(
      this.#storage,
      activationProgressStoredValue,
      ActivationPolicy.withActivated(progress, now),
      user.id,
    );
    // 남기지 못했으면 다음 완료에서 다시 세므로 이번에는 세지 않는다
    if (
      readStoredValue(this.#storage, activationProgressStoredValue, user.id).activatedAt == null
    ) {
      return { status: 'skipped' };
    }
    return { status: 'activated', daysSinceSignup: calculateDaysSinceSignup(user.createdAt, now) };
  };
}
