import { PushPermissionPolicy } from '@src/features/notification/domains/push-permission.model';
import { useGetPushPermissionQueryOptions } from '@src/features/notification/queries/get-push-permission-query-options';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { ActivationPolicy } from '../domains/activation.model';
import { useActivationProgress } from './use-activation-progress';

/**
 * 아직 알림 권한을 묻지 않은 사용자에게 언제 물을지 정한다. 기존 사용자는 로그인하자마자,
 * 신규 사용자는 활성화하거나 알림 설정을 켰을 때 계정·활성화 시점마다 한 번만 묻는다.
 * 묻는 화면(앱 안 안내 → 시스템 창)과 토큰 보고는 이 훅이 하지 않는다.
 */
export function usePushPermissionAskMoment() {
  const activation = useActivationProgress();
  const { data: permission } = useQuery({
    ...useGetPushPermissionQueryOptions(),
    enabled: activation.isAuthenticated,
  });
  const [completedKey, setCompletedKey] = useState<string | null>(null);

  const canAsk =
    activation.hasUserError ||
    (activation.isReady &&
      ActivationPolicy.shouldRegisterPushAutomatically({
        config: activation.config,
        user: activation.user,
        progress: activation.progress,
      }));

  const askKey = useMemo(() => {
    if (!canAsk) {
      return null;
    }
    const unlockedAt =
      activation.progress.activatedAt ?? activation.progress.pushRegistrationUnlockedAt;
    return `${activation.user?.id ?? 'compatibility-fallback'}:${unlockedAt ?? 'existing'}`;
  }, [activation.progress, activation.user, canAsk]);

  const isDue =
    askKey != null &&
    askKey !== completedKey &&
    permission != null &&
    PushPermissionPolicy.isNotDetermined(permission);

  const complete = () => {
    setCompletedKey(askKey);
  };

  return { isDue, complete };
}
