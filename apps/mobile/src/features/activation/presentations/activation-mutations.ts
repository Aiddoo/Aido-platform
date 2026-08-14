import type { FeatureDiscoveryConfig } from '@src/features/feature-discovery/models/feature-discovery.model';
import { FEATURE_DISCOVERY_QUERY_KEYS } from '@src/features/feature-discovery/presentations/constants/feature-discovery-query-keys.constant';
import type { User } from '@src/features/user/models/user.model';
import { USER_QUERY_KEYS } from '@src/features/user/presentations/constants/user-query-keys.constant';
import type { GrowthEventMap } from '@src/shared/analytics';
import type { QueryClient } from '@tanstack/react-query';

import { ActivationPolicy } from '../models/activation.model';
import type { ActivationService } from '../services/activation.service';
import { ACTIVATION_QUERY_KEYS } from './constants/activation-query-keys.constant';

interface ActivationMutationBridgeInput {
  queryClient: QueryClient;
  service: ActivationService;
  now?: Date;
}

interface TodoCompletionBridgeInput extends ActivationMutationBridgeInput {
  completed: boolean;
}

function getContext(queryClient: QueryClient) {
  return {
    config: queryClient.getQueryData<FeatureDiscoveryConfig>(FEATURE_DISCOVERY_QUERY_KEYS.config()),
    user: queryClient.getQueryData<User>(USER_QUERY_KEYS.me()),
  };
}

function updateProgressCache(
  queryClient: QueryClient,
  config: FeatureDiscoveryConfig | undefined,
  user: User | undefined,
  progress: ReturnType<ActivationService['getProgress']>,
) {
  const identity = ActivationPolicy.activationIdentity(config, user);
  if (!identity) {
    return;
  }
  queryClient.setQueryData(
    ACTIVATION_QUERY_KEYS.progress(identity.accountId, identity.campaignId),
    progress,
  );
}

export function recordTodoCreatedForActivation({
  queryClient,
  service,
  now = new Date(),
}: ActivationMutationBridgeInput): void {
  const { config, user } = getContext(queryClient);
  const progress = service.recordTodoCreated({ config, user, now });
  if (progress) {
    updateProgressCache(queryClient, config, user, progress);
  }
}

export function recordTodoCompletionForActivation({
  queryClient,
  service,
  completed,
  now = new Date(),
}: TodoCompletionBridgeInput): GrowthEventMap['activation_completed'] | null {
  const { config, user } = getContext(queryClient);
  const result = service.recordTodoCompletion({ config, user, completed, now });
  if (result.progress) {
    updateProgressCache(queryClient, config, user, result.progress);
  }
  return result.event;
}

export function unlockPushRegistrationForActivation({
  queryClient,
  service,
  now = new Date(),
}: ActivationMutationBridgeInput): boolean {
  const { config, user } = getContext(queryClient);
  const progress = service.unlockPushRegistration({ config, user, now });
  if (progress) {
    updateProgressCache(queryClient, config, user, progress);
  }
  return progress !== null && progress.pushRegistrationUnlockedAt !== null;
}
