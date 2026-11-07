import { PushPermissionPolicy } from '@src/features/notification/domains/push-permission.model';
import { useGetPushPermissionQueryOptions } from '@src/features/notification/queries/notification.queries';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { ActivationPolicy } from '../domains/activation.model';
import { useActivationProgress } from './use-activation-progress';

/** 사용자 정보를 읽지 못했지만 권한은 한 번 물어야 하는 경우의 계정 자리 */
const UNKNOWN_ACCOUNT_KEY = 'compatibility-fallback';
/** 요청 시점이 따로 없는 기존 사용자의 자리. 활성화와 설정 켜기가 키를 바꾸는 신규 사용자와 구분한다 */
const NO_UNLOCK_MOMENT_KEY = 'existing';

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
    return `${activation.user?.id ?? UNKNOWN_ACCOUNT_KEY}:${unlockedAt ?? NO_UNLOCK_MOMENT_KEY}`;
  }, [activation.progress, activation.user, canAsk]);

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
