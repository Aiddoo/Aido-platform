import type { FriendStripHintRepository } from './friend-strip-hint.repository';

export class FriendStripHintService {
  readonly #repository: FriendStripHintRepository;

  constructor(repository: FriendStripHintRepository) {
    this.#repository = repository;
  }

  isDismissed = (userId: string): boolean => this.#repository.isDismissed(userId);

  dismiss = (userId: string): void => {
    this.#repository.dismiss(userId);
  };

  subscribe = (userId: string, listener: () => void): (() => void) =>
    this.#repository.subscribe(userId, listener);
}
