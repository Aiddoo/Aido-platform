import { useGetFeatureCampaignConfigQueryOptions } from '@src/features/app-config/feature-campaign/queries/feature-campaign.queries';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useGetTodoExistenceQueryOptions } from '@src/features/planning/todo/queries/todo.queries';
import { toInstant } from '@src/shared/date/instant';
import { useToday } from '@src/shared/hooks/use-today';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { ActivationPolicy } from '../domains/activation.model';
import { useGetActivationProgressQueryOptions } from '../queries/activation.queries';
import type { ActivationProgress } from '../schemas/activation.schema';

const EMPTY_PROGRESS: ActivationProgress = {
  todoCreatedAt: null,
  activatedAt: null,
  pushRegistrationUnlockedAt: null,
};

export function useActivationProgress() {
  const status = useAuthStatus();
  const isAuthenticated = status === 'authenticated';
  const configQuery = useQuery({
    ...useGetFeatureCampaignConfigQueryOptions(),
    enabled: isAuthenticated,
  });
  const userQuery = useQuery({ ...useGetMeQueryOptions(), enabled: isAuthenticated });
  const identity = ActivationPolicy.getActivationIdentity(configQuery.data, userQuery.data);

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
    isAuthenticated && isContextReady && (identity == null || progressQuery.isSuccess);

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
  // React Compiler가 인자 없는 new Date()를 렌더 사이에 붙잡아 두므로, 날짜가 바뀔 때 다시 읽는다
  const today = useToday();
  const now = useMemo(() => toInstant(new Date().toISOString()), [today]);
  const isEligible =
    activation.isReady &&
    ActivationPolicy.isChecklistEligible({
      config: activation.config,
      user: activation.user,
      progress: activation.progress,
      now,
    });
  // 재설치·다른 기기에서도 같은 진행을 보이도록 서버의 할 일 기록을 함께 본다. 대상 사용자에게만 부른다
  const todoExistenceQuery = useQuery({
    ...useGetTodoExistenceQueryOptions(),
    enabled: isEligible,
    throwOnError: false,
  });
  const steps = ActivationPolicy.getChecklistSteps(activation.progress, todoExistenceQuery.data);
  // 서버 기록을 읽기 전에는 띄우지 않아, 이미 끝낸 사용자에게 카드가 잠깐 보였다 사라지지 않게 한다.
  // 읽기에 실패하면 이 기기 기록만으로 판단한다
  const hasSettledTodoExistence = todoExistenceQuery.isSuccess || todoExistenceQuery.isError;

  return {
    steps,
    isVisible:
      isEligible &&
      hasSettledTodoExistence &&
      ActivationPolicy.isChecklistVisible({
        config: activation.config,
        user: activation.user,
        progress: activation.progress,
        now,
        steps,
      }),
  };
}
