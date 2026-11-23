import { Module } from "@nestjs/common";

import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { PushDeviceRepositoryPort } from "./application/ports/push-device.repository.port.js";
import { PushTokenCachePort } from "./application/ports/push-token-cache.port.js";
import { PushTokenRepositoryPort } from "./application/ports/push-token.repository.port.js";
import { SessionPushDeviceReleaserPort } from "./application/ports/session-push-device-releaser.port.js";
import { ReleaseSessionPushDevicesUseCase } from "./application/use-cases/release-session-push-devices.use-case.js";
import { SessionPushDeviceReleaserAdapter } from "./infrastructure/adapters/session-push-device-releaser.adapter.js";
import { PushTokenCacheAdapter } from "./infrastructure/cache/push-token-cache.adapter.js";
import { DrizzlePushDeviceRepository } from "./infrastructure/persistence/drizzle-push-device.repository.js";
import { DrizzlePushTokenRepository } from "./infrastructure/persistence/drizzle-push-token.repository.js";

// identity 세션 폐기가 기기를 놓는 포트만 둔다. 기능 Module은 identity 설정 Module을 import하고 identity
// 세션 조립이 이 포트를 쓰므로, 이 Module은 다른 Module을 import하지 않아 순환하지 않는다
@Module({
  providers: [
    { provide: PushDeviceRepositoryPort, useClass: DrizzlePushDeviceRepository },
    { provide: PushTokenRepositoryPort, useClass: DrizzlePushTokenRepository },
    { provide: PushTokenCachePort, useClass: PushTokenCacheAdapter },
    provideUseCase(ReleaseSessionPushDevicesUseCase, {
      pushDeviceRepository: PushDeviceRepositoryPort,
      pushTokenRepository: PushTokenRepositoryPort,
      unitOfWork: UnitOfWorkPort,
      cache: PushTokenCachePort,
      logger: loggerFor(ReleaseSessionPushDevicesUseCase),
    }),
    { provide: SessionPushDeviceReleaserPort, useClass: SessionPushDeviceReleaserAdapter },
  ],
  exports: [SessionPushDeviceReleaserPort],
})
export class NotificationPushDevicesQueriesModule {}
