import { Module } from "@nestjs/common";

import { IdentitySettingsModule } from "#api/modules/identity/identity-settings.public";

import { NotificationCachePort } from "./application/ports/notification-cache.port.js";
import { NotificationHistoryReaderPort } from "./application/ports/notification-history.reader.port.js";
import { NotificationInboxReaderPort } from "./application/ports/notification-inbox.reader.port.js";
import { NotificationRepositoryPort } from "./application/ports/notification.repository.port.js";
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
    DeleteActorNotificationsUseCase,
  ],
})
export class NotificationInboxModule {}
