import {
  type MarkReadResponse as MarkReadResponseDto,
  type NotificationInboxItem as NotificationInboxItemDto,
  type NotificationInboxResponse as NotificationInboxResponseDto,
  type NotificationNavigation as NotificationNavigationDto,
  notificationRoutingSchema,
} from '@aido/api';
import { NOTIFICATION_TYPE } from '@aido/api/vocabulary';
import { dateKeySchema } from '@src/shared/date/date-key';
import { type Instant, toInstant } from '@src/shared/date/instant';
import { match } from 'ts-pattern';

import type {
  Notification,
  NotificationPage,
  NotificationTarget,
} from '../domains/notification.model';
import { type MarketingPushOptOutEnvelope } from '../schemas/marketing-push-opt-out-response.schema';

export function toMarketingPushOptOutResult(dto: MarketingPushOptOutEnvelope): {
  withdrawnAt: Instant;
} {
  return { withdrawnAt: toInstant(dto.marketingPushWithdrawnAt) };
}

export function toNotification(dto: NotificationInboxItemDto): Notification {
  return {
    id: dto.id,
    type: dto.type,
    title: dto.title,
    body: dto.body,
    isRead: dto.isRead,
    target: toNotificationTarget(dto.navigation),
    receivedCheer: toReceivedCheer(dto),
    createdAt: toInstant(dto.createdAt),
  };
}

/** 응원 ID·보낸 사람은 context에, 보낸 사람 이름은 metadata에 실린다 */
function toReceivedCheer({
  type,
  context,
  metadata,
}: NotificationInboxItemDto): Notification['receivedCheer'] {
  const cheerId = context?.cheerId;
  const senderId = context?.friendId;
  if (type !== NOTIFICATION_TYPE.CHEER_RECEIVED || cheerId == null || senderId == null) {
    return null;
  }
  const routing = notificationRoutingSchema.safeParse(metadata);
  return {
    cheerId,
    senderId,
    senderName: routing.success ? (routing.data.senderName ?? null) : null,
  };
}

/** 서버 navigation이 바뀌면 여기만 고친다. 서버가 싣지 못했거나 버린 navigation은 알림함으로 연다 */
export function toNotificationTarget(
  navigation: NotificationNavigationDto | undefined,
): NotificationTarget {
  if (navigation == null) {
    return { kind: 'NOTIFICATIONS' };
  }
  return match(navigation)
    .returnType<NotificationTarget>()
    .with({ kind: 'NONE' }, () => ({ kind: 'NONE' }))
    .with({ kind: 'EXTERNAL_URL' }, ({ url, presentation }) => ({
      kind: 'EXTERNAL_URL',
      url,
      opensIn: presentation,
    }))
    .with({ kind: 'FEED' }, () => ({ kind: 'FEED' }))
    .with({ kind: 'FRIEND_FEED' }, ({ friendId }) => ({ kind: 'FRIEND_FEED', friendId }))
    .with({ kind: 'FRIENDS' }, () => ({ kind: 'FRIENDS' }))
    .with({ kind: 'FRIEND_REQUESTS' }, () => ({ kind: 'FRIEND_REQUESTS' }))
    .with({ kind: 'TODO' }, ({ todoId, todoOwnerId, todoDate }) => ({
      kind: 'TODO',
      todoId,
      ownerId: todoOwnerId ?? null,
      dateKey: todoDate == null ? null : dateKeySchema.parse(todoDate),
    }))
    .with({ kind: 'TODO_COMMENT' }, ({ todoId, todoOwnerId, todoDate, commentId }) => ({
      kind: 'TODO_COMMENT',
      todoId,
      ownerId: todoOwnerId ?? null,
      dateKey: todoDate == null ? null : dateKeySchema.parse(todoDate),
      commentId,
    }))
    .with({ kind: 'NUDGE' }, ({ nudgeId }) => ({ kind: 'NUDGE', nudgeId }))
    .with({ kind: 'CHEER' }, ({ friendId }) => ({ kind: 'CHEER', friendId }))
    .with({ kind: 'WEATHER' }, () => ({ kind: 'WEATHER' }))
    .with({ kind: 'WEATHER_RESCHEDULE' }, ({ todoIds, reason }) => ({
      kind: 'WEATHER_RESCHEDULE',
      todoIds,
      reason,
    }))
    .with({ kind: 'ACHIEVEMENTS' }, () => ({ kind: 'ACHIEVEMENTS' }))
    .with({ kind: 'REPORTS' }, () => ({ kind: 'REPORTS' }))
    .with({ kind: 'SUGGESTIONS' }, () => ({ kind: 'SUGGESTIONS' }))
    .with({ kind: 'INVITE' }, () => ({ kind: 'INVITE' }))
    .with({ kind: 'SUBSCRIPTION' }, () => ({ kind: 'SUBSCRIPTION' }))
    .with({ kind: 'NOTIFICATIONS' }, () => ({ kind: 'NOTIFICATIONS' }))
    .with({ kind: 'NOTIFICATION_SETTINGS' }, () => ({ kind: 'NOTIFICATION_SETTINGS' }))
    .exhaustive();
}

export function toNotificationPage(dto: NotificationInboxResponseDto): NotificationPage {
  return {
    items: dto.notifications.map(toNotification),
    nextCursor: dto.hasMore ? dto.nextCursor : null,
  };
}

export function toReadCount(dto: MarkReadResponseDto): number {
  return dto.readCount;
}
