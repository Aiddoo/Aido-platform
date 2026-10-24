import type { FeatureDiscoveryConfig } from '@src/features/feature-discovery/domains/feature-discovery.model';
import type { GrowthEventMap } from '@src/shared/analytics';

import {
  ActivationPolicy,
  type ActivationProgress,
  type ActivationUser,
} from '../domains/activation.model';
import type { ActivationProgressRepository } from './activation-progress.repository';

interface ActivationActionInput {
  config: FeatureDiscoveryConfig | undefined;
  user: ActivationUser | undefined;
  now: Date;
}

interface TodoCompletionInput extends ActivationActionInput {
  completed: boolean;
}

interface TodoCompletionResult {
  progress: ActivationProgress | null;
  event: GrowthEventMap['activation_completed'] | null;
}

export class ActivationService {
  readonly #repository: ActivationProgressRepository;

  constructor(repository: ActivationProgressRepository) {
    this.#repository = repository;
  }

  getProgress = (
    config: FeatureDiscoveryConfig | undefined,
    user: ActivationUser | undefined,
  ): ActivationProgress => {
    const identity = ActivationPolicy.activationIdentity(config, user);
    return identity
      ? this.#repository.get(identity)
      : { todoCreatedAt: null, activatedAt: null, pushRegistrationUnlockedAt: null };
  };

  recordTodoCreated = ({ config, user, now }: ActivationActionInput): ActivationProgress | null => {
    const identity = ActivationPolicy.activationIdentity(config, user);
    if (!identity) {
      return null;
    }
    return this.#repository.markTodoCreated(identity, now);
  };

  recordTodoCompletion = ({
    config,
    user,
    completed,
    now,
  }: TodoCompletionInput): TodoCompletionResult => {
    const identity = ActivationPolicy.activationIdentity(config, user);
    if (!completed || !identity || !user) {
      return { progress: null, event: null };
    }

    const result = this.#repository.claimActivated(identity, now);
    return {
      progress: result.progress,
      event: result.isClaimed
        ? {
            campaign_id: identity.campaignId,
            days_since_signup: ActivationPolicy.daysSinceSignup(user, now),
          }
        : null,
    };
  };

  unlockPushRegistration = ({
    config,
    user,
    now,
  }: ActivationActionInput): ActivationProgress | null => {
    const identity = ActivationPolicy.activationIdentity(config, user);
    if (!identity) {
      return null;
    }
    return this.#repository.unlockPushRegistration(identity, now);
  };
}
