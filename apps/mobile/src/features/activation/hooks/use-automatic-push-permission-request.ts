import { PushPermissionPolicy } from '@src/features/notification/domains/push-permission.model';
import { useGetPushPermissionQueryOptions } from '@src/features/notification/queries/get-push-permission-query-options';
import { useRequestPushPermissionMutationOptions } from '@src/features/notification/queries/use-request-push-permission-mutation-options';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';

import { ActivationPolicy } from '../domains/activation.model';
import { useActivationProgress } from './use-activation-progress';

/**
 * 아직 알림 권한을 묻지 않은 사용자에게 언제 시스템 창을 띄울지 정한다. 기존 사용자는 로그인하자마자,
 * 신규 사용자는 활성화하거나 알림 설정을 켰을 때 한 번 묻는다. 토큰 보고는 usePushDeviceSync가 맡는다.
 */
export function useAutomaticPushPermissionRequest() {
  const activation = useActivationProgress();
  const { data: permission } = useQuery({
    ...useGetPushPermissionQueryOptions(),
    enabled: activation.isAuthenticated,
  });
  const { mutate: requestPermission } = useMutation(useRequestPushPermissionMutationOptions());
  const attemptedKeyRef = useRef<string | null>(null);

  const canRequest =
    activation.hasUserError ||
    (activation.isReady &&
      ActivationPolicy.shouldRegisterPushAutomatically({
        config: activation.config,
        user: activation.user,
        progress: activation.progress,
      }));

  const requestKey = useMemo(() => {
    if (!canRequest) {
      return null;
    }
    const unlockedAt =
      activation.progress.activatedAt ?? activation.progress.pushRegistrationUnlockedAt;
    return `${activation.user?.id ?? 'compatibility-fallback'}:${
      unlockedAt?.toISOString() ?? 'existing'
    }`;
  }, [activation.progress, activation.user, canRequest]);

  useEffect(() => {
    if (requestKey == null) {
      attemptedKeyRef.current = null;
      return;
    }
    if (permission == null || !PushPermissionPolicy.isNotDetermined(permission)) {
      return;
    }
    if (attemptedKeyRef.current === requestKey) {
      return;
    }

    attemptedKeyRef.current = requestKey;
    requestPermission();
  }, [permission, requestKey, requestPermission]);
}
