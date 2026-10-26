import { isSemanticVersionAtLeast } from "@aido/api";
import { NOTIFICATION_TYPE } from "@aido/api/vocabulary";

import type { NotificationType } from "../../types/delivery/notification-type.js";

/** 이 버전보다 낮은 앱은 해당 알림을 해석하지 못해 알림함과 푸시에서 뺀다. */
const NOTIFICATION_MIN_APP_VERSION = {
  NUDGE_REPLIED: "1.11.0",
  NUDGE_THANKED: "1.11.0",
  INVITE_JOINED: "1.13.0",
  INVITE_REWARDED: "1.13.0",
  INVITE_PROGRESS: "1.13.0",
  INVITE_QUALIFY_REMINDER: "1.13.0",
  PREMIUM_GRANT_ENDING: "1.13.0",
} as const satisfies Partial<Record<NotificationType, string>>;

type VersionGatedNotificationType = keyof typeof NOTIFICATION_MIN_APP_VERSION;
type NotificationMinAppVersion =
  (typeof NOTIFICATION_MIN_APP_VERSION)[VersionGatedNotificationType];

const MIN_APP_VERSIONS: ReadonlyMap<NotificationType, NotificationMinAppVersion> = new Map(
  Object.entries(NOTIFICATION_MIN_APP_VERSION).flatMap(([type, version]) =>
    isVersionGatedNotificationType(type) ? [[type, version] as const] : [],
  ),
);

// 높은 버전부터 비교해 앱이 지원하는 가장 높은 단계를 알림 수 캐시 범위로 쓴다
const GATE_VERSIONS: readonly NotificationMinAppVersion[] = [
  ...new Set(MIN_APP_VERSIONS.values()),
].sort((left, right) => (isSemanticVersionAtLeast(left, right) ? -1 : 1));

/** 앱이 지원하는 알림 버전 단계. 캐시 키에 들어가므로 기존 "legacy"·"all" 값을 유지한다. */
export type NotificationInboxScope = "legacy" | "all" | `since-${NotificationMinAppVersion}`;

function isVersionGatedNotificationType(type: string): type is VersionGatedNotificationType {
  return Object.hasOwn(NOTIFICATION_MIN_APP_VERSION, type);
}

export function notificationMinAppVersion(type: NotificationType): string | null {
  return MIN_APP_VERSIONS.get(type) ?? null;
}

export function supportsNotificationType(
  type: NotificationType,
  appVersion: string | null | undefined,
): boolean {
  const minAppVersion = MIN_APP_VERSIONS.get(type);
  return minAppVersion == null || isSemanticVersionAtLeast(appVersion, minAppVersion);
}

export function resolveNotificationInboxScope(
  appVersion: string | null | undefined,
): NotificationInboxScope {
  const supported = GATE_VERSIONS.find((version) => isSemanticVersionAtLeast(appVersion, version));
  if (supported == null) return "legacy";
  if (supported === GATE_VERSIONS[0]) return "all";
  return `since-${supported}`;
}

export function notificationInboxScopes(): readonly NotificationInboxScope[] {
  return ["all", "legacy", ...GATE_VERSIONS.slice(1).map((version) => `since-${version}` as const)];
}

export function visibleNotificationTypes(
  appVersion?: string,
  types?: readonly NotificationType[],
): NotificationType[] | undefined {
  if (resolveNotificationInboxScope(appVersion) === "all") {
    return types ? [...types] : undefined;
  }
  return (types ?? Object.values(NOTIFICATION_TYPE)).filter((type) =>
    supportsNotificationType(type, appVersion),
  );
}
