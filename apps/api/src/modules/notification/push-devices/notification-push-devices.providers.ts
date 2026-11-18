import type { Provider } from "@nestjs/common";

import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { UserNotificationSettingsPort } from "../shared/application/ports/user-notification-settings.port.js";
import { ActivePushTokenReaderPort } from "./application/ports/active-push-token.reader.port.js";
import { ClientAppVersionReaderPort } from "./application/ports/client-app-version.reader.port.js";
import { PushDeviceRepositoryPort } from "./application/ports/push-device.repository.port.js";
import { PushTokenCachePort } from "./application/ports/push-token-cache.port.js";
import { PushTokenFormatPort } from "./application/ports/push-token-format.port.js";
import { PushTokenRepositoryPort } from "./application/ports/push-token.repository.port.js";
import { UserPreferenceCachePort } from "./application/ports/user-preference-cache.port.js";
import { DeactivateStalePushTokensUseCase } from "./application/use-cases/deactivate-stale-push-tokens.use-case.js";
import { ReportPushDeviceUseCase } from "./application/use-cases/report-push-device.use-case.js";
import { UnregisterPushDeviceByTokenUseCase } from "./application/use-cases/unregister-push-device-by-token.use-case.js";
import { UnregisterPushDeviceUseCase } from "./application/use-cases/unregister-push-device.use-case.js";
import { CachedActivePushTokenReaderAdapter } from "./infrastructure/adapters/cached-active-push-token-reader.adapter.js";
import { ExpoPushTokenFormatAdapter } from "./infrastructure/adapters/expo-push-token-format.adapter.js";
import { UserNotificationSettingsAdapter } from "./infrastructure/adapters/user-notification-settings.adapter.js";
import { PushTokenCacheAdapter } from "./infrastructure/cache/push-token-cache.adapter.js";
import { UserPreferenceCacheAdapter } from "./infrastructure/cache/user-preference-cache.adapter.js";
import { DrizzleClientAppVersionReader } from "./infrastructure/persistence/drizzle-client-app-version.reader.js";
import { DrizzlePushDeviceRepository } from "./infrastructure/persistence/drizzle-push-device.repository.js";
import { DrizzlePushTokenRepository } from "./infrastructure/persistence/drizzle-push-token.repository.js";

// 테스트 하네스가 토큰 형식·설정 어댑터만 바꿔 끼우도록 저장소·조회 어댑터를 따로 묶는다
export const NOTIFICATION_PUSH_DEVICES_PERSISTENCE_PROVIDERS = [
  { provide: PushDeviceRepositoryPort, useClass: DrizzlePushDeviceRepository },
  { provide: PushTokenRepositoryPort, useClass: DrizzlePushTokenRepository },
  { provide: ClientAppVersionReaderPort, useClass: DrizzleClientAppVersionReader },
  { provide: ActivePushTokenReaderPort, useClass: CachedActivePushTokenReaderAdapter },
  { provide: PushTokenCachePort, useClass: PushTokenCacheAdapter },
  { provide: UserPreferenceCachePort, useClass: UserPreferenceCacheAdapter },
] satisfies Provider[];

const NOTIFICATION_PUSH_DEVICES_EXTERNAL_PROVIDERS = [
  { provide: PushTokenFormatPort, useClass: ExpoPushTokenFormatAdapter },
  // 같은 Context의 발송·알림 slice도 이 Module에서 identity 설정 ACL을 받는다
  { provide: UserNotificationSettingsPort, useClass: UserNotificationSettingsAdapter },
] satisfies Provider[];

export const NOTIFICATION_PUSH_DEVICES_USE_CASE_PROVIDERS = [
  provideUseCase(ReportPushDeviceUseCase, {
    pushDeviceRepository: PushDeviceRepositoryPort,
    unitOfWork: UnitOfWorkPort,
    pushTokenFormat: PushTokenFormatPort,
    userSettings: UserNotificationSettingsPort,
    cache: PushTokenCachePort,
    preferenceCache: UserPreferenceCachePort,
    clock: ClockPort,
    logger: loggerFor(ReportPushDeviceUseCase),
  }),
  provideUseCase(UnregisterPushDeviceUseCase, {
    pushDeviceRepository: PushDeviceRepositoryPort,
    pushTokenRepository: PushTokenRepositoryPort,
    unitOfWork: UnitOfWorkPort,
    cache: PushTokenCachePort,
    logger: loggerFor(UnregisterPushDeviceUseCase),
  }),
  provideUseCase(UnregisterPushDeviceByTokenUseCase, {
    pushDeviceRepository: PushDeviceRepositoryPort,
    pushTokenRepository: PushTokenRepositoryPort,
    unitOfWork: UnitOfWorkPort,
    cache: PushTokenCachePort,
    logger: loggerFor(UnregisterPushDeviceByTokenUseCase),
  }),
  provideUseCase(DeactivateStalePushTokensUseCase, {
    pushTokenRepository: PushTokenRepositoryPort,
    cache: PushTokenCachePort,
    clock: ClockPort,
    logger: loggerFor(DeactivateStalePushTokensUseCase),
  }),
] satisfies Provider[];

export const NOTIFICATION_PUSH_DEVICES_PROVIDERS = [
  ...NOTIFICATION_PUSH_DEVICES_PERSISTENCE_PROVIDERS,
  ...NOTIFICATION_PUSH_DEVICES_EXTERNAL_PROVIDERS,
  ...NOTIFICATION_PUSH_DEVICES_USE_CASE_PROVIDERS,
] satisfies Provider[];
