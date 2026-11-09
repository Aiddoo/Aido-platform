import { type PushPermission, PushPermissionPolicy } from '../domains/push-permission.model';

type PushSummary = 'on' | 'off' | 'deviceOff';

/** 알림 설정 목록의 푸시 값. 앱에서 켰는데 기기 알림이 꺼져 닿지 않으면 그 이유를 따로 보인다 */
export function toPushSummary(
  permission: PushPermission,
  { pushEnabled }: { pushEnabled: boolean },
): PushSummary {
  if (!pushEnabled) {
    return 'off';
  }
  return PushPermissionPolicy.isPushDeliverable(permission) ? 'on' : 'deviceOff';
}
