import type {
  FeatureDiscoveryStateIdentity,
  FeatureDiscoveryStateRepository,
} from '../repositories/feature-discovery-state.repository';

export class FeatureDiscoveryStateService {
  readonly #repository: FeatureDiscoveryStateRepository;
  readonly #now: () => Date;

  constructor(repository: FeatureDiscoveryStateRepository, now: () => Date = () => new Date()) {
    this.#repository = repository;
    this.#now = now;
  }

  isSeen = (identity: FeatureDiscoveryStateIdentity): boolean => this.#repository.isSeen(identity);

  claimSeen = (identity: FeatureDiscoveryStateIdentity): boolean =>
    this.#repository.claimSeen({
      ...identity,
      at: this.#now(),
    });

  isReentryVisible = (identity: FeatureDiscoveryStateIdentity): boolean =>
    this.#repository.isReentryVisible({
      ...identity,
      now: this.#now(),
    });
}
