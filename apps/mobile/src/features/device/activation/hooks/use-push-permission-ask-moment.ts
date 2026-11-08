import { PushPermissionPolicy } from '@src/features/notification/domains/push-permission.model';
import { useGetPushPermissionQueryOptions } from '@src/features/notification/queries/notification.queries';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { ActivationPolicy } from '../domains/activation.model';
import { useActivationProgress } from './use-activation-progress';

// 기존 사용자는 로그인 직후, 신규 사용자는 활성화하거나 알림을 켰을 때 계정·활성화 시점마다 한 번만 묻는다
export function usePushPermissionAskMoment() {
  const activation = useActivationProgress();
  const { data: permission } = useQuery({
    ...useGetPushPermissionQueryOptions(),
    enabled: activation.isAuthenticated,
  });
  const [completedKey, setCompletedKey] = useState<string | null>(null);

  const shouldAsk =
    activation.hasUserError ||
    (activation.isReady &&
      ActivationPolicy.shouldRegisterPushAutomatically({
        config: activation.config,
        user: activation.user,
        progress: activation.progress,
      }));

  const askKey = useMemo(() => {
    if (!shouldAsk) {
      return null;
    }
    return ActivationPolicy.getPushAskKey(activation.progress, activation.user);
  }, [activation.progress, activation.user, shouldAsk]);

  const isDue =
    askKey != null &&
    askKey !== completedKey &&
    permission != null &&
    PushPermissionPolicy.isNotDetermined(permission);

  const complete = () => {
    setCompletedKey(askKey);
  };

  return [isDue, complete] as const;
}
