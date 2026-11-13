import type { Provider } from "@nestjs/common";

import { UserMutationLockPort } from "#api/modules/identity/users/identity-users.public";
import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { AfterCommitTaskRegistryPort } from "#api/shared/application/ports/after-commit-task.registry.port";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { QuietHoursReaderPort } from "../shared/application/ports/quiet-hours.reader.port.js";
import { SweepBillingNoticesUseCase } from "../shared/application/use-cases/sweep-billing-notices.use-case.js";
import { PremiumAccessCachePort } from "./application/ports/premium-access-cache.port.js";
import { PremiumAccessReaderPort } from "./application/ports/premium-access.reader.port.js";
import { PremiumGrantEndingNoticeRepositoryPort } from "./application/ports/premium-grant-ending-notice.repository.port.js";
import { PremiumGrantNotifierPort } from "./application/ports/premium-grant-notifier.port.js";
import { PremiumGrantRepositoryPort } from "./application/ports/premium-grant.repository.port.js";
import { PremiumGranterPort } from "./application/ports/premium-granter.port.js";
import { StoreEntitlementReaderPort } from "./application/ports/store-entitlement.reader.port.js";
import { UserSubscriptionProjectionRepositoryPort } from "./application/ports/user-subscription-projection.repository.port.js";
import { GetPremiumAccessUseCase } from "./application/use-cases/get-premium-access.use-case.js";
import { GrantPremiumUseCase } from "./application/use-cases/grant-premium.use-case.js";
import { LoadPremiumEntitlementsUseCase } from "./application/use-cases/load-premium-entitlements.use-case.js";
import { NotifyEndingPremiumGrantsUseCase } from "./application/use-cases/notify-ending-premium-grants.use-case.js";
import { ProjectPremiumAccessUseCase } from "./application/use-cases/project-premium-access.use-case.js";
import { RevokePremiumGrantUseCase } from "./application/use-cases/revoke-premium-grant.use-case.js";
import { SweepPremiumGrantsUseCase } from "./application/use-cases/sweep-premium-grants.use-case.js";
import { PremiumAccessCacheAdapter } from "./infrastructure/adapters/premium-access-cache.adapter.js";
import { PremiumAccessReaderAdapter } from "./infrastructure/adapters/premium-access-reader.adapter.js";
import { PremiumGrantNotifierAdapter } from "./infrastructure/adapters/premium-grant-notifier.adapter.js";
import { PremiumGranterAdapter } from "./infrastructure/adapters/premium-granter.adapter.js";
import { QuietHoursReaderAdapter } from "./infrastructure/adapters/quiet-hours-reader.adapter.js";
import { DrizzlePremiumGrantEndingNoticeRepository } from "./infrastructure/persistence/drizzle-premium-grant-ending-notice.repository.js";
import { DrizzlePremiumGrantRepository } from "./infrastructure/persistence/drizzle-premium-grant.repository.js";
import { DrizzleStoreEntitlementReader } from "./infrastructure/persistence/drizzle-store-entitlement.reader.js";
import { DrizzleUserSubscriptionProjectionRepository } from "./infrastructure/persistence/drizzle-user-subscription-projection.repository.js";

export const BILLING_PREMIUM_GRANTS_PROVIDERS = [
  { provide: PremiumGrantRepositoryPort, useClass: DrizzlePremiumGrantRepository },
  { provide: StoreEntitlementReaderPort, useClass: DrizzleStoreEntitlementReader },
  {
    provide: UserSubscriptionProjectionRepositoryPort,
    useClass: DrizzleUserSubscriptionProjectionRepository,
  },
  {
    provide: PremiumGrantEndingNoticeRepositoryPort,
    useClass: DrizzlePremiumGrantEndingNoticeRepository,
  },
  { provide: PremiumAccessCachePort, useClass: PremiumAccessCacheAdapter },
  { provide: PremiumGrantNotifierPort, useClass: PremiumGrantNotifierAdapter },
  { provide: QuietHoursReaderPort, useClass: QuietHoursReaderAdapter },
  { provide: PremiumGranterPort, useClass: PremiumGranterAdapter },
  { provide: PremiumAccessReaderPort, useClass: PremiumAccessReaderAdapter },
  provideUseCase(LoadPremiumEntitlementsUseCase, {
    storeEntitlementReader: StoreEntitlementReaderPort,
    premiumGrantRepository: PremiumGrantRepositoryPort,
  }),
  provideUseCase(ProjectPremiumAccessUseCase, {
    loadPremiumEntitlements: LoadPremiumEntitlementsUseCase,
    premiumGrantRepository: PremiumGrantRepositoryPort,
    userSubscriptionProjection: UserSubscriptionProjectionRepositoryPort,
  }),
  provideUseCase(GetPremiumAccessUseCase, {
    loadPremiumEntitlements: LoadPremiumEntitlementsUseCase,
    premiumGrantRepository: PremiumGrantRepositoryPort,
    clock: ClockPort,
  }),
  provideUseCase(GrantPremiumUseCase, {
    premiumGrantRepository: PremiumGrantRepositoryPort,
    loadPremiumEntitlements: LoadPremiumEntitlementsUseCase,
    projectPremiumAccess: ProjectPremiumAccessUseCase,
    userLock: UserMutationLockPort,
    unitOfWork: UnitOfWorkPort,
    afterCommit: AfterCommitTaskRegistryPort,
    cache: PremiumAccessCachePort,
    clock: ClockPort,
    logger: loggerFor(GrantPremiumUseCase),
  }),
  provideUseCase(SweepPremiumGrantsUseCase, {
    premiumGrantRepository: PremiumGrantRepositoryPort,
    userSubscriptionProjection: UserSubscriptionProjectionRepositoryPort,
    projectPremiumAccess: ProjectPremiumAccessUseCase,
    userLock: UserMutationLockPort,
    unitOfWork: UnitOfWorkPort,
    cache: PremiumAccessCachePort,
    logger: loggerFor(SweepPremiumGrantsUseCase),
  }),
  provideUseCase(RevokePremiumGrantUseCase, {
    premiumGrantRepository: PremiumGrantRepositoryPort,
    projectPremiumAccess: ProjectPremiumAccessUseCase,
    userLock: UserMutationLockPort,
    unitOfWork: UnitOfWorkPort,
    cache: PremiumAccessCachePort,
    logger: loggerFor(RevokePremiumGrantUseCase),
  }),
  provideUseCase(SweepBillingNoticesUseCase, {
    quietHoursReader: QuietHoursReaderPort,
    unitOfWork: UnitOfWorkPort,
    logger: loggerFor(SweepBillingNoticesUseCase),
  }),
  provideUseCase(NotifyEndingPremiumGrantsUseCase, {
    sweepBillingNotices: SweepBillingNoticesUseCase,
    noticeRepository: PremiumGrantEndingNoticeRepositoryPort,
    notifier: PremiumGrantNotifierPort,
  }),
] satisfies Provider[];
