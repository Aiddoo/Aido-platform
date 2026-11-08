import type { FeatureCampaignConfig } from '@src/features/app-config/feature-campaign/domains/feature-campaign.model';
import type { Instant } from '@src/shared/date/instant';

import type { ActivationCompletedEvent } from '../constants/activation.events';
import { ActivationPolicy } from '../domains/activation.model';
import type { ActivationProgress, ActivationUser } from '../domains/activation.model';
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

interface PushRegistrationUnlockResult {
  progress: ActivationProgress;
  didOpenAskMoment: boolean;
}

export class ActivationService {
  readonly #repository: ActivationProgressRepository;

  constructor(repository: ActivationProgressRepository) {
    this.#repository = repository;
  }

  recordTodoCreated = ({ config, user, now }: ActivationActionInput): ActivationProgress | null => {
    const identity = ActivationPolicy.findActivationIdentity(config, user);
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
    const identity = ActivationPolicy.findActivationIdentity(config, user);
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

  /** 요청 시점이 이번 호출로 새로 열렸는지 함께 돌려준다. 이미 열렸거나 활성화됐으면 요청 키가 바뀌지 않아 안내가 다시 뜨지 않는다 */
  unlockPushRegistration = ({
    config,
    user,
    now,
  }: ActivationActionInput): PushRegistrationUnlockResult | null => {
    const identity = ActivationPolicy.findActivationIdentity(config, user);
    if (!identity) {
      return null;
    }
    const before = this.#repository.get(identity);
    const progress = this.#repository.unlockPushRegistration(identity, now);
    return {
      progress,
      didOpenAskMoment:
        before.activatedAt == null &&
        before.pushRegistrationUnlockedAt == null &&
        progress.pushRegistrationUnlockedAt != null,
    };
  };
}
