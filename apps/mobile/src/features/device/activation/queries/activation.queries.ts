import { useActivationService } from '@src/bootstrap/providers/di-context';
import type { FeatureCampaignConfig } from '@src/features/app-config/feature-campaign/schemas/feature-campaign.schema';
import { queryOptions } from '@tanstack/react-query';

import { ACTIVATION_QUERY_KEYS } from '../constants/activation-query-keys';
import { ActivationPolicy } from '../domains/activation.model';
import type { ActivationUser } from '../schemas/activation.schema';

interface ActivationProgressDependencies {
  config: FeatureCampaignConfig | undefined;
  user: ActivationUser | undefined;
}

export function useGetActivationProgressQueryOptions({
  config,
  user,
}: ActivationProgressDependencies) {
  const activationService = useActivationService();
  const identity = ActivationPolicy.getActivationIdentity(config, user);

  return queryOptions({
    queryKey: identity
      ? ACTIVATION_QUERY_KEYS.progress({
          accountId: identity.accountId,
          campaignId: identity.campaignId,
        })
      : ACTIVATION_QUERY_KEYS.inactive(),
    queryFn: () => activationService.getProgress(config, user),
    enabled: identity != null,
    staleTime: Number.POSITIVE_INFINITY,
  });
}
