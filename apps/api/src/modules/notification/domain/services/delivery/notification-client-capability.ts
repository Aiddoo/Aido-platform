import { isSemanticVersionAtLeast } from "@aido/api";
import { NOTIFICATION_TYPE } from "@aido/api/vocabulary";

import {
  isPersistedNotificationType,
  type NotificationType,
} from "../../types/delivery/notification-type.js";

export type NotificationInboxScope = "legacy" | "all";

export const NUDGE_INTERACTION_MIN_APP_VERSION = "1.11.0";

export function supportsNudgeInteractions(appVersion: string | null | undefined): boolean {
  return isSemanticVersionAtLeast(appVersion, NUDGE_INTERACTION_MIN_APP_VERSION);
}

export function isNudgeInteractionNotification(type: NotificationType): boolean {
  return type === "NUDGE_REPLIED" || type === "NUDGE_THANKED";
}

export function resolveNotificationInboxScope(appVersion?: string): NotificationInboxScope {
  return supportsNudgeInteractions(appVersion) ? "all" : "legacy";
}

export function visibleNotificationTypes(
  appVersion?: string,
  types?: readonly NotificationType[],
): NotificationType[] | undefined {
  if (supportsNudgeInteractions(appVersion)) {
    return types ? [...types] : undefined;
  }
  return (types ?? Object.values(NOTIFICATION_TYPE).filter(isPersistedNotificationType)).filter(
    (type) => !isNudgeInteractionNotification(type),
  );
}
