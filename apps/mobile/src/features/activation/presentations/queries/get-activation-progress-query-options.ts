import { useActivationService } from '@src/bootstrap/providers/di-context';
import type { FeatureDiscoveryConfig } from '@src/features/feature-discovery/models/feature-discovery.model';
import { queryOptions } from '@tanstack/react-query';

import { ActivationPolicy, type ActivationUser } from '../../models/activation.model';
import type { ActivationService } from '../../services/activation.service';
import { ACTIVATION_QUERY_KEYS } from '../constants/activation-query-keys.constant';

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
      ? ACTIVATION_QUERY_KEYS.progress(identity.accountId, identity.campaignId)
      : [...ACTIVATION_QUERY_KEYS.all, 'inactive'],
    queryFn: () => service.getProgress(config, user),
    enabled: identity !== null,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useGetActivationProgressQueryOptions(dependencies: ActivationProgressDependencies) {
  return getActivationProgressQueryOptions(useActivationService(), dependencies);
}
