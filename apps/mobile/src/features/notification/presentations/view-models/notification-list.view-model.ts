import { getDateSectionKey } from '@src/shared/utils/date';
import { groupBy } from 'es-toolkit';

import type { Notification } from '../../models/notification.model';

type DateSectionKey = ReturnType<typeof getDateSectionKey>;
export type NotificationListItem =
  | { type: 'header'; section: DateSectionKey }
  | { type: 'item'; notification: Notification };

export function toNotificationListItems(
  notifications: readonly Notification[],
  referenceDate: Date,
): NotificationListItem[] {
  const sections = groupBy(notifications, (notification) =>
    getDateSectionKey(notification.createdAt, referenceDate),
  );
  return Object.values(sections).flatMap((items): NotificationListItem[] => {
    const first = items[0];
    if (first === undefined) return [];
    return [
      { type: 'header', section: getDateSectionKey(first.createdAt, referenceDate) },
      ...items.map((notification) => ({ type: 'item' as const, notification })),
    ];
  });
}
