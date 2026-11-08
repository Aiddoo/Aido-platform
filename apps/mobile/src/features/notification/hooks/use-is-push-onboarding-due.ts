import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useQuery } from '@tanstack/react-query';

import { PUSH_ASK_MOMENT } from '../constants/notification.constants';
import { PushPermissionPolicy } from '../domains/push-permission.model';
import { useGetPushPermissionQueryOptions } from '../queries/notification.queries';
import { usePushPermissionPrompt } from './use-push-permission-prompt';

/** 내 정보나 OS 권한을 아직 모르면 띄우지 않는다. 알면 화면을 열고, 답하면 닫는다 */
export function useIsPushOnboardingDue(): boolean {
  const isAuthenticated = useAuthStatus() === 'authenticated';
  const { data: me } = useQuery({ ...useGetMeQueryOptions(), enabled: isAuthenticated });
  const { data: permission } = useQuery({
    ...useGetPushPermissionQueryOptions(),
    enabled: isAuthenticated,
  });
  const [prompt] = usePushPermissionPrompt(me?.id);
  const now = useMinuteNow();

  if (!isAuthenticated || me == null || permission == null) {
    return false;
  }

  return (
    PushPermissionPolicy.getAskMoment(permission, {
      surface: 'onboarding',
      signedUpAt: me.createdAt,
      prompt,
      now,
    }) === PUSH_ASK_MOMENT.ONBOARDING_SCREEN
  );
}
