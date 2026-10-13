import { FEATURE_DISCOVERY_QUERY_KEYS } from '@src/features/feature-discovery/constants/feature-discovery-query-keys';
import type { FeatureDiscoveryConfig } from '@src/features/feature-discovery/domains/feature-discovery.model';
import type { User } from '@src/features/user/domains/user.model';
import { getCachedMe } from '@src/features/user/queries/user-cache';
import type { GrowthEventMap } from '@src/shared/analytics';
import type { QueryClient } from '@tanstack/react-query';

import type { ActivationService } from '../apis/activation.service';
import { ACTIVATION_QUERY_KEYS } from '../constants/activation-query-keys';
import { ActivationPolicy } from '../domains/activation.model';

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
    user: getCachedMe(queryClient),
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
    ACTIVATION_QUERY_KEYS.progress({
      accountId: identity.accountId,
      campaignId: identity.campaignId,
    }),
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
