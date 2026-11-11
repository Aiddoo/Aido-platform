import {
  CATEGORY_TYPE_MAP,
  isSemanticVersionAtLeast,
  NOTIFICATION_TYPE,
  type NotificationCategory,
  type NotificationType as WireNotificationType,
} from "@aido/api/vocabulary";

import type { NotificationType } from "../../inbox/domain/notification-type.constants.js";

/**
 * 앱 계약(@aido/api NOTIFICATION_TYPE)에 없는 서버 전용 타입과 앱에 보낼 타입. 저장·중복 방지·분석은
 * 서버 타입으로 하고, 푸시 type과 알림함은 모든 앱 버전이 아는 타입으로 보낸다(이동은 action url·navigation).
 */
const WIRE_NOTIFICATION_TYPE = {
  PREMIUM_TRIAL_ENDING: NOTIFICATION_TYPE.SYSTEM_NOTICE,
  PREMIUM_RENEWAL_UPCOMING: NOTIFICATION_TYPE.SYSTEM_NOTICE,
} as const satisfies Partial<Record<NotificationType, WireNotificationType>>;

/** 알림함 조회에서 계약 타입과 함께 고를 서버 전용 타입과 그 카테고리 */
const SERVER_ONLY_NOTIFICATIONS: readonly {
  readonly type: NotificationType;
  readonly category: Exclude<NotificationCategory, "ALL">;
}[] = [
  { type: "PREMIUM_TRIAL_ENDING", category: "NOTICE" },
  { type: "PREMIUM_RENEWAL_UPCOMING", category: "NOTICE" },
];

const SERVER_ONLY_NOTIFICATION_TYPES = SERVER_ONLY_NOTIFICATIONS.map(({ type }) => type);

/** 카테고리 필터의 저장 타입. 계약 표(CATEGORY_TYPE_MAP)에 서버 전용 타입을 더한다. */
export function notificationTypesOfCategory(
  category: Exclude<NotificationCategory, "ALL">,
): NotificationType[] {
  return [
    ...CATEGORY_TYPE_MAP[category],
    ...SERVER_ONLY_NOTIFICATIONS.filter((item) => item.category === category).map(
      ({ type }) => type,
    ),
  ];
}

function isWireNotificationType(type: NotificationType): type is WireNotificationType {
  return Object.hasOwn(NOTIFICATION_TYPE, type);
}

/** 푸시 data와 알림함 응답에 실을 타입 */
export function toWireNotificationType(type: NotificationType): WireNotificationType {
  return isWireNotificationType(type) ? type : WIRE_NOTIFICATION_TYPE[type];
}

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
  if (supported == null) {
    return "legacy";
  }
  if (supported === GATE_VERSIONS[0]) {
    return "all";
  }
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
  return (types ?? [...Object.values(NOTIFICATION_TYPE), ...SERVER_ONLY_NOTIFICATION_TYPES]).filter(
    (type) => supportsNotificationType(type, appVersion),
  );
}
