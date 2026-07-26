import type { AiEventMap } from './ai.events';
import type { AuthEventMap } from './auth.events';
import type { BadgeEventMap } from './badge.events';
import type { FriendEventMap } from './friend.events';
import type { GrowthEventMap } from './growth.events';
import type { LifecycleEventMap } from './lifecycle.events';
import type { MemoEventMap } from './memo.events';
import type { NotificationEventMap } from './notification.events';
import type { SubscriptionEventMap } from './subscription.events';
import type { TodoEventMap } from './todo.events';
import type { UserEventMap } from './user.events';
import type { WidgetEventMap } from './widget.events';

export type {
  AiEventMap,
  AuthEventMap,
  BadgeEventMap,
  FriendEventMap,
  GrowthEventMap,
  LifecycleEventMap,
  MemoEventMap,
  NotificationEventMap,
  SubscriptionEventMap,
  TodoEventMap,
  UserEventMap,
  WidgetEventMap,
};

export type AppEventMap = AuthEventMap &
  TodoEventMap &
  FriendEventMap &
  GrowthEventMap &
  LifecycleEventMap &
  SubscriptionEventMap &
  AiEventMap &
  UserEventMap &
  NotificationEventMap &
  BadgeEventMap &
  MemoEventMap &
  WidgetEventMap;
