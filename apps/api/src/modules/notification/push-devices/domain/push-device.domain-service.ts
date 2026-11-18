import {
  isDeliverablePushPermission,
  PUSH_DEVICE_PLATFORM,
  PUSH_DISPATCH_SKIP_REASON,
  PUSH_PERMISSION_STATUS,
  type PushDevicePlatform,
  type PushPermissionStatus,
} from "@aido/api/vocabulary";
import { match, P } from "ts-pattern";

/** 이 기간 동안 보고가 없던 기기는 지운 앱으로 보고 도달 판정에서 뺀다. */
export const PUSH_DEVICE_STALE_AFTER_DAYS = 90;

/**
 * 이 기간 동안 보고가 없던 기기의 토큰은 끈다. 앱은 열 때마다 보고하므로 9개월 동안 그 기기에서 앱을 열지
 * 않은 것이다. 가장 긴 재방문 알림(30일 쉼)보다 충분히 길고, FCM이 Android 등록을 만료로 보는 270일과 같다.
 * APNs에는 이런 만료가 없어 iOS 토큰은 서버가 끄지 않으면 계속 보낸다
 */
export const PUSH_TOKEN_STALE_AFTER_DAYS = 270;

export type NoActiveTokenSkipReason =
  | typeof PUSH_DISPATCH_SKIP_REASON.PUSH_PERMISSION_NOT_REQUESTED
  | typeof PUSH_DISPATCH_SKIP_REASON.PUSH_PERMISSION_DENIED
  | typeof PUSH_DISPATCH_SKIP_REASON.NO_ACTIVE_TOKEN;

/** 앱은 푸시를 처음 붙인 버전부터 deviceId를 `ios_`·`android_`로 시작한다. */
export function platformFromDeviceId(deviceId: string): PushDevicePlatform | null {
  return match(deviceId)
    .with(P.string.startsWith("ios_"), () => PUSH_DEVICE_PLATFORM.IOS)
    .with(P.string.startsWith("android_"), () => PUSH_DEVICE_PLATFORM.ANDROID)
    .otherwise(() => null);
}

/**
 * 활성 토큰이 없는 사용자에게 왜 푸시가 닿지 않는지 기기들의 권한으로 정한다.
 * 허용된 기기가 있으면 권한이 아니라 토큰이 문제다. 아직 묻지 않은 기기가 있으면 거절보다 먼저 센다.
 * 기기를 보고한 적이 없으면(1.14.1 이하 앱) 권한을 모르므로 NO_ACTIVE_TOKEN이다.
 */
export function noActiveTokenSkipReason(
  permissionStatuses: readonly PushPermissionStatus[],
): NoActiveTokenSkipReason {
  if (permissionStatuses.some(isDeliverablePushPermission)) {
    return PUSH_DISPATCH_SKIP_REASON.NO_ACTIVE_TOKEN;
  }
  if (permissionStatuses.includes(PUSH_PERMISSION_STATUS.NOT_DETERMINED)) {
    return PUSH_DISPATCH_SKIP_REASON.PUSH_PERMISSION_NOT_REQUESTED;
  }
  if (permissionStatuses.includes(PUSH_PERMISSION_STATUS.DENIED)) {
    return PUSH_DISPATCH_SKIP_REASON.PUSH_PERMISSION_DENIED;
  }
  return PUSH_DISPATCH_SKIP_REASON.NO_ACTIVE_TOKEN;
}
