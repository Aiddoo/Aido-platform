import type { Provider } from "@nestjs/common";

import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";

import {
  NOTIFICATION_CACHE,
  NotificationCachePort,
} from "./application/ports/notification-cache.port.js";
import {
  NOTIFICATION_HISTORY_READER,
  NotificationHistoryReaderPort,
} from "./application/ports/notification-history.reader.port.js";
import {
  NOTIFICATION_INBOX_READER,
  NotificationInboxReaderPort,
} from "./application/ports/notification-inbox.reader.port.js";
import {
  NOTIFICATION_REPOSITORY,
  NotificationRepositoryPort,
} from "./application/ports/notification.repository.port.js";
import { DeleteActorNotificationsUseCase } from "./application/use-cases/delete-actor-notifications.use-case.js";
import { GetUnreadNotificationCountUseCase } from "./application/use-cases/get-unread-notification-count.use-case.js";
import { ListNotificationsUseCase } from "./application/use-cases/list-notifications.use-case.js";
import { MarkAllNotificationsReadUseCase } from "./application/use-cases/mark-all-notifications-read.use-case.js";
import { MarkNotificationOpenedUseCase } from "./application/use-cases/mark-notification-opened.use-case.js";
import { MarkNotificationReadUseCase } from "./application/use-cases/mark-notification-read.use-case.js";
import { NotificationCacheAdapter } from "./infrastructure/cache/notification-cache.adapter.js";
import { DrizzleNotificationReader } from "./infrastructure/persistence/drizzle-notification.reader.js";
import { DrizzleNotificationRepository } from "./infrastructure/persistence/drizzle-notification.repository.js";

// 옛 Symbol 토큰은 아직 Symbol로 주입하는 push·reminders·테스트를 위해 같은 인스턴스로 묶는다
export const NOTIFICATION_INBOX_LEGACY_TOKEN_PROVIDERS = [
  { provide: NOTIFICATION_REPOSITORY, useExisting: NotificationRepositoryPort },
  { provide: NOTIFICATION_INBOX_READER, useExisting: NotificationInboxReaderPort },
  { provide: NOTIFICATION_HISTORY_READER, useExisting: NotificationHistoryReaderPort },
  { provide: NOTIFICATION_CACHE, useExisting: NotificationCachePort },
] satisfies Provider[];

export const NOTIFICATION_INBOX_PROVIDERS = [
  { provide: NotificationRepositoryPort, useClass: DrizzleNotificationRepository },
  DrizzleNotificationReader,
  { provide: NotificationInboxReaderPort, useExisting: DrizzleNotificationReader },
  { provide: NotificationHistoryReaderPort, useExisting: DrizzleNotificationReader },
  { provide: NotificationCachePort, useClass: NotificationCacheAdapter },
  ...NOTIFICATION_INBOX_LEGACY_TOKEN_PROVIDERS,
  provideUseCase(ListNotificationsUseCase, {
    notificationInboxReader: NotificationInboxReaderPort,
    logger: loggerFor(ListNotificationsUseCase),
  }),
  provideUseCase(GetUnreadNotificationCountUseCase, {
    notificationInboxReader: NotificationInboxReaderPort,
    cache: NotificationCachePort,
  }),
  provideUseCase(MarkNotificationReadUseCase, {
    notificationRepository: NotificationRepositoryPort,
    cache: NotificationCachePort,
    clock: ClockPort,
    logger: loggerFor(MarkNotificationReadUseCase),
  }),
  provideUseCase(MarkNotificationOpenedUseCase, {
    notificationRepository: NotificationRepositoryPort,
    cache: NotificationCachePort,
    clock: ClockPort,
    logger: loggerFor(MarkNotificationOpenedUseCase),
  }),
  provideUseCase(MarkAllNotificationsReadUseCase, {
    notificationRepository: NotificationRepositoryPort,
    cache: NotificationCachePort,
    clock: ClockPort,
    logger: loggerFor(MarkAllNotificationsReadUseCase),
  }),
  provideUseCase(DeleteActorNotificationsUseCase, {
    repository: NotificationRepositoryPort,
    cache: NotificationCachePort,
    logger: loggerFor(DeleteActorNotificationsUseCase),
  }),
] satisfies Provider[];
