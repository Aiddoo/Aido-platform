import type { WhatsNewStateIdentity, WhatsNewStateRepository } from './whats-new-state.repository';

export class WhatsNewStateService {
  readonly #repository: WhatsNewStateRepository;
  readonly #now: () => Date;

  constructor(repository: WhatsNewStateRepository, now: () => Date = () => new Date()) {
    this.#repository = repository;
    this.#now = now;
  }

  isSeen = (identity: WhatsNewStateIdentity): boolean => this.#repository.isSeen(identity);

  claimSeen = (identity: WhatsNewStateIdentity): boolean =>
    this.#repository.claimSeen({
      ...identity,
      at: this.#now(),
    });

  isReentryVisible = (identity: WhatsNewStateIdentity): boolean =>
    this.#repository.isReentryVisible({
      ...identity,
      now: this.#now(),
    });

  dismissReentry = (identity: WhatsNewStateIdentity): void =>
    this.#repository.dismissReentry(identity);
}
