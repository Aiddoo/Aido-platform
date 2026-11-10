import type { Provider } from "@nestjs/common";

import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { UserReportNotifierPort } from "./application/ports/user-report-notifier.port.js";
import { UserReportRepositoryPort } from "./application/ports/user-report.repository.port.js";
import { ReportContentUseCase } from "./application/use-cases/report-content.use-case.js";
import { ResolveUserReportUseCase } from "./application/use-cases/resolve-user-report.use-case.js";
import { EmailUserReportNotifierAdapter } from "./infrastructure/adapters/email-user-report-notifier.adapter.js";
import { DrizzleUserReportRepository } from "./infrastructure/persistence/drizzle-user-report.repository.js";

export const SOCIAL_REPORTS_PROVIDERS = [
  { provide: UserReportRepositoryPort, useClass: DrizzleUserReportRepository },
  { provide: UserReportNotifierPort, useClass: EmailUserReportNotifierAdapter },
  provideUseCase(ReportContentUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    userReportRepository: UserReportRepositoryPort,
    notifier: UserReportNotifierPort,
    clock: ClockPort,
    logger: loggerFor(ReportContentUseCase),
  }),
] satisfies Provider[];

export const SOCIAL_REPORTS_ADMIN_PROVIDERS = [
  { provide: UserReportRepositoryPort, useClass: DrizzleUserReportRepository },
  provideUseCase(ResolveUserReportUseCase, {
    unitOfWork: UnitOfWorkPort,
    userReportRepository: UserReportRepositoryPort,
    clock: ClockPort,
  }),
] satisfies Provider[];
