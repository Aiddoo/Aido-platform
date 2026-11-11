import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useNow } from '@src/shared/hooks/use-now';
import { useStoredValue } from '@src/shared/storage/use-stored-value';
import { useQuery } from '@tanstack/react-query';

import { PUSH_ASK_MOMENT } from '../constants/notification.constants';
import { PushPermissionPolicy } from '../domains/push-permission.model';
import { useGetPushPermissionQueryOptions } from '../queries/push-permission.queries';
import { pushPermissionDeferredAtStoredValue } from '../schemas/push-permission-deferred-at-storage.schema';

/**
 * 알면 화면을 열고, 답하면 닫는다. 내 정보나 OS 권한을 아직 모르면 null이라 띄우지 않고 다른 자동 화면도 기다린다.
 * 권한을 읽지 못하면 알림 화면도 띄울 수 없으므로 열 차례가 아닌 것으로 정한다
 */
export function useIsPushOnboardingDue(): boolean | null {
  const isAuthenticated = useAuthStatus() === 'authenticated';
  const { data: me } = useQuery({ ...useGetMeQueryOptions(), enabled: isAuthenticated });
  const { data: permission, isError: isPermissionUnreadable } = useQuery({
    ...useGetPushPermissionQueryOptions(),
    enabled: isAuthenticated,
  });
  const [deferredAt] = useStoredValue(pushPermissionDeferredAtStoredValue, me?.id);
  // 앱 화면 묶음의 guard라 분마다 다시 그리지 않는다. 가입 창이 끝나는 순간에 한 번만 다시 읽는다
  const now = useNow({
    until: me == null ? null : PushPermissionPolicy.getOnboardingWindowEndsAt(me.createdAt),
  });

  if (!isAuthenticated || me == null) {
    return null;
  }
  if (permission == null) {
    return isPermissionUnreadable ? false : null;
  }

  return (
    PushPermissionPolicy.getAskMoment(permission, {
      surface: 'onboarding',
      signedUpAt: me.createdAt,
      prompt: { deferredAt },
      now,
    }) === PUSH_ASK_MOMENT.ONBOARDING_SCREEN
  );
}
