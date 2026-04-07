import type { AiEventMap } from './ai.events';
import type { AuthEventMap } from './auth.events';
import type { BadgeEventMap } from './badge.events';
import type { FriendEventMap } from './friend.events';
import type { MemoEventMap } from './memo.events';
import type { NotificationEventMap } from './notification.events';
import type { SubscriptionEventMap } from './subscription.events';
import type { TodoEventMap } from './todo.events';
import type { UserEventMap } from './user.events';

export type {
  AiEventMap,
  AuthEventMap,
  BadgeEventMap,
  FriendEventMap,
  MemoEventMap,
  NotificationEventMap,
  SubscriptionEventMap,
  TodoEventMap,
  UserEventMap,
};

export type AppEventMap = AuthEventMap &
  TodoEventMap &
  FriendEventMap &
  SubscriptionEventMap &
  AiEventMap &
  UserEventMap &
  NotificationEventMap &
  BadgeEventMap &
  MemoEventMap;
