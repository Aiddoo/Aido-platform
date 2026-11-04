import {
  PUSH_DEVICE_PLATFORM,
  PUSH_PERMISSION_STATUS,
  type PushDevicePlatform,
  type PushPermissionStatus,
} from "@aido/api/vocabulary";
import { match, P } from "ts-pattern";

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
