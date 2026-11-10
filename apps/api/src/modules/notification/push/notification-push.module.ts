import { Module } from "@nestjs/common";

import { IdentitySettingsModule } from "#api/modules/identity/identity-settings.public";

import { NotificationHistoryReader } from "../inbox/application/notification-history.reader.js";
import { NotificationInboxModule } from "../inbox/notification-inbox.public.js";
import {
  CLIENT_APP_VERSION_READER,
  ClientAppVersionReaderPort,
} from "./application/ports/client-app-version.reader.port.js";
import {
  NOTIFICATION_RECIPIENT_LOCALE_READER,
  NotificationRecipientLocaleReaderPort,
} from "./application/ports/notification-recipient-locale.reader.port.js";
import {
  NOTIFICATION_RECIPIENT_TIMEZONE_READER,
  NotificationRecipientTimezoneReaderPort,
} from "./application/ports/notification-recipient-timezone.reader.port.js";
import {
  PUSH_CAMPAIGN_OUTCOME_READER,
  PushCampaignOutcomeReaderPort,
} from "./application/ports/push-campaign-outcome.reader.port.js";
import { PushFunnelReaderPort } from "./application/ports/push-funnel.reader.port.js";
import {
  PUSH_QUIET_HOURS_READER,
  PushQuietHoursReaderPort,
} from "./application/ports/push-quiet-hours.reader.port.js";
import {
  SESSION_PUSH_DEVICE_RELEASE,
  SessionPushDeviceReleasePort,
} from "./application/ports/session-push-device-release.port.js";
import { PublishNotificationUseCase } from "./application/use-cases/publish-notification.use-case.js";
import { MarketingConsentReconfirmProcessor } from "./infrastructure/jobs/marketing-consent-reconfirm.processor.js";
import { MarketingConsentReconfirmScheduler } from "./infrastructure/jobs/marketing-consent-reconfirm.scheduler.js";
import { NotificationQueueModule } from "./infrastructure/jobs/notification-queue.module.js";
import { NotificationQueueProcessor } from "./infrastructure/jobs/notification-queue.processor.js";
import { PushDeliveryQueueProcessor } from "./infrastructure/jobs/push-delivery-queue.processor.js";
import { NOTIFICATION_PUSH_PROVIDERS } from "./notification-push.providers.js";
import { PushDeviceController } from "./presentation/http/v1/push-device.controller.js";

@Module({
  // Identity 설정의 역방향 큐 참조는 jobs.public 경계로 분리한다
  imports: [NotificationQueueModule, IdentitySettingsModule, NotificationInboxModule],
  controllers: [PushDeviceController],
  providers: [
    ...NOTIFICATION_PUSH_PROVIDERS,
    PushDeliveryQueueProcessor,
    NotificationQueueProcessor,
    MarketingConsentReconfirmScheduler,
    MarketingConsentReconfirmProcessor,
  ],
  exports: [
    PublishNotificationUseCase,
    NotificationHistoryReader,
    NotificationRecipientLocaleReaderPort,
    NotificationRecipientTimezoneReaderPort,
    ClientAppVersionReaderPort,
    PushQuietHoursReaderPort,
    PushCampaignOutcomeReaderPort,
    PushFunnelReaderPort,
    SessionPushDeviceReleasePort,
    NOTIFICATION_RECIPIENT_LOCALE_READER,
    NOTIFICATION_RECIPIENT_TIMEZONE_READER,
    CLIENT_APP_VERSION_READER,
    PUSH_QUIET_HOURS_READER,
    PUSH_CAMPAIGN_OUTCOME_READER,
    SESSION_PUSH_DEVICE_RELEASE,
    NotificationQueueModule,
    // 알림 캐시·계정 정리 UseCase를 이 모듈에서 받던 곳이 그대로 쓰게 한다
    NotificationInboxModule,
  ],
})
export class NotificationPushModule {}
