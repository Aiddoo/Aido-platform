import { type PushPermission, PushPermissionPolicy } from '../domains/push-permission.model';

export type PushSummary = 'on' | 'off' | 'deviceOff';

/**
 * 알림 설정 값. 앱에서 켰는데 기기에서 거절해 닿지 않으면 그 이유를 따로 보인다.
 * 아직 묻지 않은 기기는 거절한 것이 아니라 꺼짐으로 둔다
 */
export function toPushSummary(
  permission: PushPermission,
  { pushEnabled }: { pushEnabled: boolean },
): PushSummary {
  if (PushPermissionPolicy.isPushDeliverable(permission)) {
    return pushEnabled ? 'on' : 'off';
  }
  return pushEnabled && !PushPermissionPolicy.isNotDetermined(permission) ? 'deviceOff' : 'off';
}

export function getPushSummaryLabelKey(summary: PushSummary) {
  const labelKeyBySummary = {
    on: 'settings.on',
    off: 'settings.off',
    deviceOff: 'settings.deviceOff',
  } as const satisfies Record<PushSummary, string>;

  return labelKeyBySummary[summary];
}
