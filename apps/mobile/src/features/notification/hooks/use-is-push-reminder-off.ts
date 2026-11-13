import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { useQuery } from '@tanstack/react-query';

import { PushPermissionPolicy } from '../domains/push-permission.model';
import { useGetPushPermissionQueryOptions } from '../queries/push-permission.queries';

/** OS 권한이나 앱 푸시가 꺼져 할 일 알림이 닿지 않는지. 아직 모르면 꺼졌다고 표시하지 않는다 */
export function useIsPushReminderOff(): boolean {
  const { data: permission } = useQuery(useGetPushPermissionQueryOptions());
  const { data: preference } = useQuery(useGetPreferenceQueryOptions());

  if (permission == null || preference == null) {
    return false;
  }
  return !PushPermissionPolicy.canReceivePush(permission, preference);
}
