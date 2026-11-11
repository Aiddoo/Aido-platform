import { type Instant } from '@src/shared/date/instant';

import type { ActivationCompletedEvent } from '../constants/activation.events';
import { ActivationPolicy } from '../domains/activation.model';
import type { ActivationProgress, ActivationUser } from '../domains/activation.model';
import type { ActivationProgressRepository } from './activation-progress.repository';

interface ActivationActionInput {
  user: ActivationUser | undefined;
  now: Instant;
}

interface TodoCompletionInput extends ActivationActionInput {
  isCompleted: boolean;
}

interface TodoCompletionResult {
  progress: ActivationProgress | null;
  event: ActivationCompletedEvent | null;
}

/** 가입 7일 안의 계정만 기록한다. 오래된 계정이 할 일을 끝낼 때마다 활성화로 세지 않는다 */
export class ActivationService {
  readonly #repository: ActivationProgressRepository;

  constructor(repository: ActivationProgressRepository) {
    this.#repository = repository;
  }

  recordTodoCreated = ({ user, now }: ActivationActionInput): ActivationProgress | null => {
    if (user == null || !ActivationPolicy.isInChecklistWindow(user, now)) {
      return null;
    }
    return this.#repository.markTodoCreated(user.id, now);
  };

  recordTodoCompletion = ({
    user,
    isCompleted,
    now,
  }: TodoCompletionInput): TodoCompletionResult => {
    if (!isCompleted || user == null || !ActivationPolicy.isInChecklistWindow(user, now)) {
      return { progress: null, event: null };
    }

    const result = this.#repository.claimActivated(user.id, now);
    return {
      progress: result.progress,
      event: result.isClaimed
        ? { days_since_signup: ActivationPolicy.getDaysSinceSignup(user, now) }
        : null,
    };
  };
}
