import { Module } from "@nestjs/common";

import { IdentitySettingsModule } from "#api/modules/identity/identity-settings.public";

import { UserNotificationSettingsPort } from "../shared/application/ports/user-notification-settings.port.js";
import { ActivePushTokenReaderPort } from "./application/ports/active-push-token.reader.port.js";
import { ClientAppVersionReaderPort } from "./application/ports/client-app-version.reader.port.js";
import { PushDeviceRepositoryPort } from "./application/ports/push-device.repository.port.js";
import { PushTokenCachePort } from "./application/ports/push-token-cache.port.js";
import { PushTokenRepositoryPort } from "./application/ports/push-token.repository.port.js";
import { SessionPushDeviceReleasePort } from "./application/ports/session-push-device-release.port.js";
import { NOTIFICATION_PUSH_DEVICES_PROVIDERS } from "./notification-push-devices.providers.js";
import { PushDeviceController } from "./presentation/http/v1/push-device.controller.js";

@Module({
  // 설정 ACL과 토큰 캐시 어댑터가 identity 설정 포트를 쓴다
  imports: [IdentitySettingsModule],
  controllers: [PushDeviceController],
  providers: [...NOTIFICATION_PUSH_DEVICES_PROVIDERS],
  exports: [
    PushDeviceRepositoryPort,
    PushTokenRepositoryPort,
    ActivePushTokenReaderPort,
    ClientAppVersionReaderPort,
    PushTokenCachePort,
    UserNotificationSettingsPort,
    SessionPushDeviceReleasePort,
  ],
})
export class NotificationPushDevicesModule {}
