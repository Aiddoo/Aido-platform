import type { Provider } from "@nestjs/common";

import { AccessStateReaderPort } from "#api/modules/access/entitlements/access-entitlements.public";
import { UserMutationLockPort } from "#api/modules/identity/users/identity-users.public";
import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { QuotaChargeRepositoryPort } from "./application/ports/quota-charge.repository.port.js";
import { QuotaLedgerPort } from "./application/ports/quota-ledger.port.js";
import { QuotaUsageRepositoryPort } from "./application/ports/quota-usage.repository.port.js";
import { CheckQuotaRemainingUseCase } from "./application/use-cases/check-quota-remaining.use-case.js";
import { CommitQuotaReservationUseCase } from "./application/use-cases/commit-quota-reservation.use-case.js";
import { GetMeteredFeatureQuotaUseCase } from "./application/use-cases/get-metered-feature-quota.use-case.js";
import { RefundAbandonedQuotaReservationsUseCase } from "./application/use-cases/refund-abandoned-quota-reservations.use-case.js";
import { RefundQuotaReservationUseCase } from "./application/use-cases/refund-quota-reservation.use-case.js";
import { ReopenQuotaReservationUseCase } from "./application/use-cases/reopen-quota-reservation.use-case.js";
import { ReserveQuotaUseCase } from "./application/use-cases/reserve-quota.use-case.js";
import { QuotaLedgerAdapter } from "./infrastructure/adapters/quota-ledger.adapter.js";
import { QuotaAbandonedRefundProcessor } from "./infrastructure/jobs/quota-abandoned-refund.processor.js";
import { QuotaAbandonedRefundScheduler } from "./infrastructure/jobs/quota-abandoned-refund.scheduler.js";
import { DrizzleQuotaChargeRepository } from "./infrastructure/persistence/drizzle-quota-charge.repository.js";
import { DrizzleQuotaUsageRepository } from "./infrastructure/persistence/drizzle-quota-usage.repository.js";

export const ACCESS_QUOTAS_PROVIDERS = [
  { provide: QuotaChargeRepositoryPort, useClass: DrizzleQuotaChargeRepository },
  { provide: QuotaUsageRepositoryPort, useClass: DrizzleQuotaUsageRepository },
  { provide: QuotaLedgerPort, useClass: QuotaLedgerAdapter },
  provideUseCase(ReserveQuotaUseCase, {
    unitOfWork: UnitOfWorkPort,
    userMutationLock: UserMutationLockPort,
    accessStateReader: AccessStateReaderPort,
    quotaChargeRepository: QuotaChargeRepositoryPort,
    quotaUsageRepository: QuotaUsageRepositoryPort,
    clock: ClockPort,
    logger: loggerFor(ReserveQuotaUseCase),
  }),
  provideUseCase(ReopenQuotaReservationUseCase, {
    unitOfWork: UnitOfWorkPort,
    userMutationLock: UserMutationLockPort,
    accessStateReader: AccessStateReaderPort,
    quotaChargeRepository: QuotaChargeRepositoryPort,
    quotaUsageRepository: QuotaUsageRepositoryPort,
    clock: ClockPort,
    logger: loggerFor(ReopenQuotaReservationUseCase),
  }),
  provideUseCase(CommitQuotaReservationUseCase, {
    quotaChargeRepository: QuotaChargeRepositoryPort,
    clock: ClockPort,
    logger: loggerFor(CommitQuotaReservationUseCase),
  }),
  provideUseCase(RefundQuotaReservationUseCase, {
    unitOfWork: UnitOfWorkPort,
    userMutationLock: UserMutationLockPort,
    quotaChargeRepository: QuotaChargeRepositoryPort,
    quotaUsageRepository: QuotaUsageRepositoryPort,
    clock: ClockPort,
    logger: loggerFor(RefundQuotaReservationUseCase),
  }),
  provideUseCase(RefundAbandonedQuotaReservationsUseCase, {
    unitOfWork: UnitOfWorkPort,
    userMutationLock: UserMutationLockPort,
    quotaChargeRepository: QuotaChargeRepositoryPort,
    quotaUsageRepository: QuotaUsageRepositoryPort,
    alert: OperationalAlertPort,
    clock: ClockPort,
    logger: loggerFor(RefundAbandonedQuotaReservationsUseCase),
  }),
  provideUseCase(GetMeteredFeatureQuotaUseCase, {
    accessStateReader: AccessStateReaderPort,
    quotaUsageRepository: QuotaUsageRepositoryPort,
    clock: ClockPort,
  }),
  provideUseCase(CheckQuotaRemainingUseCase, {
    getMeteredFeatureQuota: GetMeteredFeatureQuotaUseCase,
  }),
  QuotaAbandonedRefundProcessor,
  QuotaAbandonedRefundScheduler,
] satisfies Provider[];
