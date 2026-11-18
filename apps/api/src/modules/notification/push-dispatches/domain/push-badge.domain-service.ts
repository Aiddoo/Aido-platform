import { isSemanticVersionAtLeast } from "@aido/api/vocabulary";

/**
 * 이 버전부터 앱이 안 읽은 수를 받을 때마다 같은 수여도 아이콘 배지를 다시 쓴다. 그 전 앱은 수가 바뀔 때만 써서
 * 다른 기기에서 읽은 뒤 서버가 실은 배지가 남는다. 기기가 보고하는 버전은 네이티브 버전이라 OTA로 오르지 않아,
 * 1.16.0 다음 앱 버전(1.17.0)부터 싣는다
 */
const PUSH_BADGE_MIN_APP_VERSION = "1.17.0";

export function carriesUnreadBadge(appVersion: string | null): boolean {
  return isSemanticVersionAtLeast(appVersion, PUSH_BADGE_MIN_APP_VERSION);
}

// 기기에 실을 아이콘 배지. 배지를 다시 맞추지 못하는 앱에는 싣지 않는다(null)
export function pushBadgeFor(device: {
  readonly appVersion: string | null;
  readonly unreadCount: number;
}): number | null {
  return carriesUnreadBadge(device.appVersion) ? device.unreadCount : null;
}
