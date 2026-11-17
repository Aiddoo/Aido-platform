import { Module } from "@nestjs/common";

import { IdentitySettingsModule } from "#api/modules/identity/identity-settings.public";

import { NotificationPushDevicesModule } from "../push-devices/notification-push-devices.public.js";
import { NotificationPushDispatchesModule } from "../push-dispatches/notification-push-dispatches.public.js";
import { NotificationHistoryReader } from "./application/notification-history.reader.js";
import { NotificationRepositoryPort } from "./application/ports/notification.repository.port.js";
import { DeleteActorNotificationsUseCase } from "./application/use-cases/delete-actor-notifications.use-case.js";
import { PublishNotificationBatchUseCase } from "./application/use-cases/publish-notification-batch.use-case.js";
import { PublishNotificationUseCase } from "./application/use-cases/publish-notification.use-case.js";
import { MarketingConsentReconfirmProcessor } from "./infrastructure/jobs/marketing-consent-reconfirm.processor.js";
import { MarketingConsentReconfirmScheduler } from "./infrastructure/jobs/marketing-consent-reconfirm.scheduler.js";
import { NotificationQueueModule } from "./infrastructure/jobs/notification-queue.module.js";
import { NotificationQueueProcessor } from "./infrastructure/jobs/notification-queue.processor.js";
import { NOTIFICATION_NOTIFICATIONS_PROVIDERS } from "./notification-notifications.providers.js";
import { NotificationInboxController } from "./presentation/http/v1/notification-inbox.controller.js";
import { NotificationController } from "./presentation/http/v1/notification.controller.js";

@Module({
  // 알림 작업 큐는 identity 설정이 이 Module 없이 넣을 수 있도록 따로 둔 jobs Module이다
  imports: [
    NotificationQueueModule,
    IdentitySettingsModule,
    NotificationPushDevicesModule,
    NotificationPushDispatchesModule,
  ],
  controllers: [NotificationController, NotificationInboxController],
  providers: [
    ...NOTIFICATION_NOTIFICATIONS_PROVIDERS,
    NotificationQueueProcessor,
    MarketingConsentReconfirmScheduler,
    MarketingConsentReconfirmProcessor,
  ],
  exports: [
    PublishNotificationUseCase,
    PublishNotificationBatchUseCase,
    NotificationHistoryReader,
    NotificationRepositoryPort,
    DeleteActorNotificationsUseCase,
    NotificationQueueModule,
  ],
})
export class NotificationNotificationsModule {}
