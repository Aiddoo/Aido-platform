import { useActivationService } from '@src/bootstrap/providers/di-context';
import type { FeatureDiscoveryConfig } from '@src/features/feature-discovery/domains/feature-discovery.model';
import { queryOptions } from '@tanstack/react-query';

import type { ActivationService } from '../apis/activation.service';
import { ACTIVATION_QUERY_KEYS } from '../constants/activation-query-keys';
import { ActivationPolicy, type ActivationUser } from '../domains/activation.model';

type ActivationProgressDependencies = {
  config: FeatureDiscoveryConfig | undefined;
  user: ActivationUser | undefined;
};

export function getActivationProgressQueryOptions(
  service: ActivationService,
  { config, user }: ActivationProgressDependencies,
) {
  const identity = ActivationPolicy.activationIdentity(config, user);

  return queryOptions({
    queryKey: identity
      ? ACTIVATION_QUERY_KEYS.progress({
          accountId: identity.accountId,
          campaignId: identity.campaignId,
        })
      : ACTIVATION_QUERY_KEYS.inactive(),
    queryFn: () => service.getProgress(config, user),
    enabled: identity !== null,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useGetActivationProgressQueryOptions(dependencies: ActivationProgressDependencies) {
  return getActivationProgressQueryOptions(useActivationService(), dependencies);
}
