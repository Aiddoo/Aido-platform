import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useFeatureDiscoveryQueryOptions } from '@src/features/feature-discovery/presentations/queries/get-feature-discovery-query-options';
import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/get-me-query-options';
import { useQuery } from '@tanstack/react-query';

import { ActivationPolicy, type ActivationProgress } from '../../models/activation.model';
import { useGetActivationProgressQueryOptions } from '../queries/get-activation-progress-query-options';

const EMPTY_PROGRESS: ActivationProgress = {
  todoCreatedAt: null,
  activatedAt: null,
  pushRegistrationUnlockedAt: null,
};

export function useActivationProgress() {
  const { status } = useAuth();
  const isAuthenticated = status === 'authenticated';
  const configOptions = useFeatureDiscoveryQueryOptions();
  const userOptions = useGetMeQueryOptions();
  const configQuery = useQuery({ ...configOptions, enabled: isAuthenticated });
  const userQuery = useQuery({ ...userOptions, enabled: isAuthenticated });
  const identity = ActivationPolicy.activationIdentity(configQuery.data, userQuery.data);

  const progressOptions = useGetActivationProgressQueryOptions({
    config: configQuery.data,
    user: userQuery.data,
  });
  const progressQuery = useQuery({
    ...progressOptions,
    enabled: isAuthenticated && progressOptions.enabled,
  });

  // A public rollout-config failure must not disable the legacy push flow for
  // pre-campaign accounts. The bundled campaign date lets policy distinguish
  // those users while still deferring prompts for the new-user cohort.
  const isContextReady = configQuery.isFetched && userQuery.isSuccess;
  const isReady =
    isAuthenticated && isContextReady && (identity === null || progressQuery.isSuccess);

  return {
    config: isAuthenticated ? configQuery.data : undefined,
    user: isAuthenticated ? userQuery.data : undefined,
    progress: isAuthenticated && identity ? (progressQuery.data ?? EMPTY_PROGRESS) : EMPTY_PROGRESS,
    isReady,
    isAuthenticated,
    hasUserError: isAuthenticated && userQuery.isError,
  };
}

export function useActivationChecklist() {
  const activation = useActivationProgress();
  return {
    progress: activation.progress,
    isVisible:
      activation.isReady &&
      ActivationPolicy.isChecklistVisible({
        config: activation.config,
        user: activation.user,
        progress: activation.progress,
        now: new Date(),
      }),
  };
}
