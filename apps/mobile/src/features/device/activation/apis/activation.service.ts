import type { FeatureCampaignConfig } from '@src/features/app-config/feature-campaign/schemas/feature-campaign.schema';
import type { Instant } from '@src/shared/date/instant';

import type { ActivationCompletedEvent } from '../constants/activation.events';
import { ActivationPolicy } from '../domains/activation.model';
import type { ActivationProgress, ActivationUser } from '../schemas/activation.schema';
import type { ActivationProgressRepository } from './activation-progress.repository';

interface ActivationActionInput {
  config: FeatureCampaignConfig | undefined;
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

export class ActivationService {
  readonly #repository: ActivationProgressRepository;

  constructor(repository: ActivationProgressRepository) {
    this.#repository = repository;
  }

  getProgress = (
    config: FeatureCampaignConfig | undefined,
    user: ActivationUser | undefined,
  ): ActivationProgress => {
    const identity = ActivationPolicy.getActivationIdentity(config, user);
    return identity
      ? this.#repository.get(identity)
      : { todoCreatedAt: null, activatedAt: null, pushRegistrationUnlockedAt: null };
  };

  recordTodoCreated = ({ config, user, now }: ActivationActionInput): ActivationProgress | null => {
    const identity = ActivationPolicy.getActivationIdentity(config, user);
    if (!identity) {
      return null;
    }
    return this.#repository.markTodoCreated(identity, now);
  };

  recordTodoCompletion = ({
    config,
    user,
    isCompleted,
    now,
  }: TodoCompletionInput): TodoCompletionResult => {
    const identity = ActivationPolicy.getActivationIdentity(config, user);
    if (!isCompleted || !identity || !user) {
      return { progress: null, event: null };
    }

    const result = this.#repository.claimActivated(identity, now);
    return {
      progress: result.progress,
      event: result.isClaimed
        ? {
            campaign_id: identity.campaignId,
            days_since_signup: ActivationPolicy.getDaysSinceSignup(user, now),
          }
        : null,
    };
  };

  unlockPushRegistration = ({
    config,
    user,
    now,
  }: ActivationActionInput): ActivationProgress | null => {
    const identity = ActivationPolicy.getActivationIdentity(config, user);
    if (!identity) {
      return null;
    }
    return this.#repository.unlockPushRegistration(identity, now);
  };
}
