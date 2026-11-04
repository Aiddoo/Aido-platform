import { PushPermissionPolicy } from '../domains/push-permission.model';
import type { PushPromptRepository } from './push-prompt.repository';

export class PushPromptService {
  readonly #repository: PushPromptRepository;

  constructor(repository: PushPromptRepository) {
    this.#repository = repository;
  }

  isSnoozed = (userId: string, now: Date): boolean =>
    PushPermissionPolicy.isPromptSnoozed(this.#repository.getDismissedAt(userId), now);

  snooze = (userId: string, now: Date): void => {
    this.#repository.dismiss(userId, now);
  };

  subscribe = (userId: string, listener: () => void): (() => void) =>
    this.#repository.subscribe(userId, listener);
}
