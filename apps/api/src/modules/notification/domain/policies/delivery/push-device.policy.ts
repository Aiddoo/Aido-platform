import {
  PUSH_DEVICE_PLATFORM,
  PUSH_DISPATCH_SKIP_REASON,
  PUSH_PERMISSION_STATUS,
  type PushDevicePlatform,
  type PushPermissionStatus,
} from "@aido/api/vocabulary";
import { match, P } from "ts-pattern";

/** 이 기간 동안 보고가 없던 기기는 지운 앱으로 보고 도달 판정에서 뺀다. */
export const PUSH_DEVICE_STALE_AFTER_DAYS = 90;

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

/** iOS 임시 허용(PROVISIONAL)도 알림이 알림 센터에 조용히 도착하므로 발송한다. */
export function permissionAllowsDelivery(status: PushPermissionStatus): boolean {
  return status === PUSH_PERMISSION_STATUS.GRANTED || status === PUSH_PERMISSION_STATUS.PROVISIONAL;
}

/**
 * 활성 토큰이 없는 사용자에게 왜 푸시가 닿지 않는지 기기들의 권한으로 정한다.
 * 허용된 기기가 있으면 권한이 아니라 토큰이 문제다. 아직 묻지 않은 기기가 있으면 거절보다 먼저 센다.
 * 기기를 보고한 적이 없으면(1.14.1 이하 앱) 권한을 모르므로 NO_ACTIVE_TOKEN이다.
 */
export function noActiveTokenSkipReason(
  permissionStatuses: readonly PushPermissionStatus[],
): NoActiveTokenSkipReason {
  if (permissionStatuses.some(permissionAllowsDelivery)) {
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
