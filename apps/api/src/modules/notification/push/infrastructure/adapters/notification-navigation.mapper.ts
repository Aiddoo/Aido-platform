import {
  type NotificationNavigation,
  notificationNavigationSchema,
} from "@aido/api/contracts/notification";

import {
  type NotificationNavigationSource,
  resolveNotificationDestination,
} from "../../domain/notification-navigation.domain-service.js";

/**
 * 푸시 data·알림함의 navigation. 계약을 통과하지 못하는 값(잘못된 날짜·id 등)은 싣지 않아
 * 새 앱도 기존 필드로 이동한다.
 */
export function toNotificationNavigation(
  source: NotificationNavigationSource,
): NotificationNavigation | undefined {
  const parsed = notificationNavigationSchema.safeParse(resolveNotificationDestination(source));
  return parsed.success ? parsed.data : undefined;
}
