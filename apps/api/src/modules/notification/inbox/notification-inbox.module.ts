import { Module } from "@nestjs/common";

import { IdentitySettingsModule } from "#api/modules/identity/identity-settings.public";

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
import { NOTIFICATION_INBOX_PROVIDERS } from "./notification-inbox.providers.js";
import { NotificationInboxController } from "./presentation/http/v1/notification-inbox.controller.js";
import { NotificationController } from "./presentation/http/v1/notification.controller.js";

@Module({
  // 미읽음 캐시 어댑터가 사용자 설정 캐시도 함께 비운다
  imports: [IdentitySettingsModule],
  controllers: [NotificationController, NotificationInboxController],
  providers: [...NOTIFICATION_INBOX_PROVIDERS],
  exports: [
    NotificationRepositoryPort,
    NotificationInboxReaderPort,
    NotificationHistoryReaderPort,
    NotificationCachePort,
    NOTIFICATION_REPOSITORY,
    NOTIFICATION_INBOX_READER,
    NOTIFICATION_HISTORY_READER,
    NOTIFICATION_CACHE,
    DeleteActorNotificationsUseCase,
  ],
})
export class NotificationInboxModule {}
