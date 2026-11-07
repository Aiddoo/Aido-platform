import { getCachedFeatureCampaignConfig } from '@src/features/app-config/feature-campaign/queries/feature-campaign-cache';
import type { FeatureCampaignConfig } from '@src/features/app-config/feature-campaign/schemas/feature-campaign.schema';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import type { User } from '@src/features/identity/user/schemas/user.schema';
import { type Instant, getNowInstant } from '@src/shared/date/instant';
import type { QueryClient } from '@tanstack/react-query';

import type { ActivationService } from '../apis/activation.service';
import { ACTIVATION_QUERY_KEYS } from '../constants/activation-query-keys';
import type { ActivationCompletedEvent } from '../constants/activation.events';
import { ActivationPolicy } from '../domains/activation.model';
import type { ActivationProgress } from '../schemas/activation.schema';

interface ActivationMutationBridgeInput {
  queryClient: QueryClient;
  service: ActivationService;
  now?: Instant;
}

interface TodoCompletionBridgeInput extends ActivationMutationBridgeInput {
  isCompleted: boolean;
}

function getContext(queryClient: QueryClient) {
  return {
    config: getCachedFeatureCampaignConfig(queryClient),
    user: getCachedMe(queryClient),
  };
}

function updateProgressCache(
  queryClient: QueryClient,
  config: FeatureCampaignConfig | undefined,
  user: User | undefined,
  progress: ActivationProgress,
) {
  const identity = ActivationPolicy.getActivationIdentity(config, user);
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
  now = getNowInstant(),
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
  isCompleted,
  now = getNowInstant(),
}: TodoCompletionBridgeInput): ActivationCompletedEvent | null {
  const { config, user } = getContext(queryClient);
  const result = service.recordTodoCompletion({ config, user, isCompleted, now });
  if (result.progress) {
    updateProgressCache(queryClient, config, user, result.progress);
  }
  return result.event;
}

export function tryUnlockPushRegistration({
  queryClient,
  service,
  now = getNowInstant(),
}: ActivationMutationBridgeInput): boolean {
  const { config, user } = getContext(queryClient);
  const progress = service.unlockPushRegistration({ config, user, now });
  if (progress) {
    updateProgressCache(queryClient, config, user, progress);
  }
  return progress != null && progress.pushRegistrationUnlockedAt != null;
}
