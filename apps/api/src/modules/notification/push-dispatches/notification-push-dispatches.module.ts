import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { IdentityUserPreferencesModule } from "#api/modules/identity/user-preferences/identity-user-preferences.public";

import { NotificationNotificationsQueriesModule } from "../notifications/notification-notifications-queries.public.js";
import { NotificationPushDevicesModule } from "../push-devices/notification-push-devices.public.js";
import { NotificationRecipientLocaleReaderPort } from "./application/ports/notification-recipient-locale.reader.port.js";
import { NotificationRecipientTimezoneReaderPort } from "./application/ports/notification-recipient-timezone.reader.port.js";
import { PushCampaignOutcomeReaderPort } from "./application/ports/push-campaign-outcome.reader.port.js";
import { PushDispatchRepositoryPort } from "./application/ports/push-dispatch.repository.port.js";
import { PushQuietHoursReaderPort } from "./application/ports/push-quiet-hours.reader.port.js";
import { PublishPushDeliveryAfterCommitUseCase } from "./application/use-cases/publish-push-delivery-after-commit.use-case.js";
import { PurgePushDeliveryHistoryUseCase } from "./application/use-cases/purge-push-delivery-history.use-case.js";
import { ReconcilePushReceiptsUseCase } from "./application/use-cases/reconcile-push-receipts.use-case.js";
import { PushDeliveryQueueProcessor } from "./infrastructure/jobs/push-delivery-queue.processor.js";
import { notificationPushDispatchesConfig } from "./notification-push-dispatches.config.js";
import { NOTIFICATION_PUSH_DISPATCHES_PROVIDERS } from "./notification-push-dispatches.providers.js";
import { MarketingPushOptOutController } from "./presentation/http/v1/marketing-push-opt-out.controller.js";

@Module({
  // 수신자 설정 캐시가 identity 설정 조회 포트를, 푸시 배지가 알림함의 안 읽은 수 조회를 쓴다
  imports: [
    IdentityUserPreferencesModule,
    NotificationNotificationsQueriesModule,
    NotificationPushDevicesModule,
    ConfigModule.forFeature(notificationPushDispatchesConfig),
  ],
  controllers: [MarketingPushOptOutController],
  providers: [...NOTIFICATION_PUSH_DISPATCHES_PROVIDERS, PushDeliveryQueueProcessor],
  exports: [
    PushDispatchRepositoryPort,
    PublishPushDeliveryAfterCommitUseCase,
    PurgePushDeliveryHistoryUseCase,
    ReconcilePushReceiptsUseCase,
    NotificationRecipientLocaleReaderPort,
    NotificationRecipientTimezoneReaderPort,
    PushQuietHoursReaderPort,
    PushCampaignOutcomeReaderPort,
  ],
})
export class NotificationPushDispatchesModule {}
